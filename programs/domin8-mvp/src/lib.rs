use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("11111111111111111111111111111112");

#[program]
pub mod domin8_mvp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, house_fee_bps: u16) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.house_fee_bps = house_fee_bps;
        config.current_game_id = 0;
        msg!("Config initialized");
        Ok(())
    }

    pub fn create_game(ctx: Context<CreateGame>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let game = &mut ctx.accounts.game;

        config.current_game_id = config.current_game_id.checked_add(1).unwrap();

        game.game_id = config.current_game_id;
        game.status = GameStatus::Waiting;
        game.start_time = Clock::get()?.unix_timestamp;
        game.total_pot = 0;
        game.bet_count = 0;
        game.winner_index = None;
        game.vrf_request = Pubkey::default();

        msg!("Game {} created", game.game_id);
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let bet = &mut ctx.accounts.bet_entry;

        require!(game.status == GameStatus::Waiting, ErrorCode::BettingClosed);
        require!(amount > 0, ErrorCode::BetAmountZero);
        require!(amount >= 10_000_000, ErrorCode::BetTooSmall);
        require!(game.bet_count < 64, ErrorCode::GameFull);

        // Transfer to vault
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Store bet in separate PDA
        bet.game_id = game.game_id;
        bet.bet_index = game.bet_count;
        bet.player = ctx.accounts.player.key();
        bet.amount = amount;

        game.bet_count += 1;
        game.total_pot = game.total_pot.checked_add(amount).unwrap();

        msg!("Bet #{}: {} SOL", bet.bet_index, amount as f64 / 1e9);
        Ok(())
    }

    pub fn close_betting(ctx: Context<CloseBetting>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.status == GameStatus::Waiting, ErrorCode::InvalidGameStatus);
        require!(game.bet_count >= 2, ErrorCode::NotEnoughPlayers);

        game.status = GameStatus::AwaitingVrf;

        // Request VRF
        let cpi_program = ctx.accounts.vrf_program.to_account_info();
        let cpi_accounts = orao_solana_vrf::cpi::accounts::Request {
            payer: ctx.accounts.crank.to_account_info(),
            network_state: ctx.accounts.vrf_state.to_account_info(),
            treasury: ctx.accounts.vrf_treasury.to_account_info(),
            request: ctx.accounts.vrf_request.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };

        let mut seed = [0u8; 32];
        seed[0..8].copy_from_slice(&game.game_id.to_le_bytes());

        orao_solana_vrf::cpi::request(CpiContext::new(cpi_program, cpi_accounts), seed)?;

        game.vrf_request = ctx.accounts.vrf_request.key();

        msg!("Betting closed, VRF requested");
        Ok(())
    }

    pub fn select_winner(ctx: Context<SelectWinner>) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.status == GameStatus::AwaitingVrf, ErrorCode::InvalidGameStatus);
        require!(game.winner_index.is_none(), ErrorCode::GameAlreadySettled);

        // Read VRF
        let vrf_data = ctx.accounts.vrf_request.data.borrow();
        require!(vrf_data.len() >= 49, ErrorCode::InvalidVrfAccount);
        require!(vrf_data[48] != 0, ErrorCode::VrfNotFulfilled);

        let randomness = u64::from_le_bytes(vrf_data[40..48].try_into().unwrap());
        msg!("VRF: {}", randomness);

        // Calculate winner using remaining accounts (bet entries)
        let total_weight: u64 = ctx.remaining_accounts.iter()
            .take(game.bet_count as usize)
            .filter_map(|acc| {
                let data = acc.try_borrow_data().ok()?;
                if data.len() < 8 + BetEntry::LEN { return None; }
                let amount_bytes: [u8; 8] = data[8+8+1+32..8+8+1+32+8].try_into().ok()?;
                Some(u64::from_le_bytes(amount_bytes))
            })
            .sum();

        let selection = randomness % total_weight;
        let mut cumulative = 0u64;
        let mut winner_index = 0u8;
        let mut winner_pubkey = Pubkey::default();

        for (i, acc) in ctx.remaining_accounts.iter().take(game.bet_count as usize).enumerate() {
            let data = acc.try_borrow_data().unwrap();
            let amount_bytes: [u8; 8] = data[8+8+1+32..8+8+1+32+8].try_into().unwrap();
            let amount = u64::from_le_bytes(amount_bytes);

            cumulative += amount;
            if selection < cumulative {
                winner_index = i as u8;
                let player_bytes: [u8; 32] = data[8+8+1..8+8+1+32].try_into().unwrap();
                winner_pubkey = Pubkey::new_from_array(player_bytes);
                break;
            }
        }

        game.winner_index = Some(winner_index);
        game.status = GameStatus::Finished;

        msg!("Winner: Bet #{} - {}", winner_index, winner_pubkey);

        // Payouts
        let house_fee = (game.total_pot as u128)
            .checked_mul(ctx.accounts.config.house_fee_bps as u128)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::ArithmeticOverflow)? as u64;
        let winner_payout = game.total_pot
            .checked_sub(house_fee)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        // Verify vault has sufficient funds
        let vault_balance = ctx.accounts.vault.lamports();
        require!(vault_balance >= game.total_pot, ErrorCode::InsufficientFunds);

        let game_id_bytes = game.game_id.to_le_bytes();
        let seeds = &[b"vault".as_ref(), &game_id_bytes[..], &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];

        // Pay winner
        if winner_payout > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.winner.to_account_info(),
                    },
                    signer,
                ),
                winner_payout,
            )?;
        }

        // Pay house
        if house_fee > 0 {
            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                    signer,
                ),
                house_fee,
            )?;
        }

        msg!("Game {} completed", game.game_id);
        Ok(())
    }
}

// Accounts
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Config::LEN, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Treasury
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(mut, seeds = [b"config"], bump, has_one = authority)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        space = 8 + Game::LEN,
        seeds = [b"game", config.current_game_id.checked_add(1).unwrap().to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    #[account(seeds = [b"vault", config.current_game_id.checked_add(1).unwrap().to_le_bytes().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut, seeds = [b"game", game.game_id.to_le_bytes().as_ref()], bump)]
    pub game: Account<'info, Game>,
    #[account(
        init,
        payer = player,
        space = 8 + BetEntry::LEN,
        seeds = [b"bet", game.game_id.to_le_bytes().as_ref(), &[game.bet_count]],
        bump
    )]
    pub bet_entry: Account<'info, BetEntry>,
    #[account(mut, seeds = [b"vault", game.game_id.to_le_bytes().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseBetting<'info> {
    #[account(seeds = [b"config"], bump, has_one = authority)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"game", game.game_id.to_le_bytes().as_ref()], bump)]
    pub game: Account<'info, Game>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub crank: Signer<'info>,
    /// CHECK: ORAO VRF
    pub vrf_program: AccountInfo<'info>,
    /// CHECK: ORAO VRF network state
    #[account(mut)]
    pub vrf_state: AccountInfo<'info>,
    /// CHECK: ORAO VRF treasury
    #[account(mut)]
    pub vrf_treasury: AccountInfo<'info>,
    /// CHECK: ORAO VRF request account
    #[account(mut)]
    pub vrf_request: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectWinner<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"game", game.game_id.to_le_bytes().as_ref()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [b"vault", game.game_id.to_le_bytes().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    #[account(constraint = crank.key() == config.authority)]
    pub crank: Signer<'info>,
    /// CHECK: VRF
    pub vrf_request: AccountInfo<'info>,
    /// CHECK: Winner
    #[account(mut)]
    pub winner: AccountInfo<'info>,
    /// CHECK: Treasury
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    // Remaining accounts: BetEntry PDAs (ordered by bet_index)
}

// State
#[account]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub house_fee_bps: u16,
    pub current_game_id: u64,
}

impl Config {
    pub const LEN: usize = 32 + 32 + 2 + 8;
}

#[account]
pub struct Game {
    pub game_id: u64,
    pub status: GameStatus,
    pub start_time: i64,
    pub total_pot: u64,
    pub bet_count: u8,
    pub winner_index: Option<u8>,
    pub vrf_request: Pubkey,
}

impl Game {
    pub const LEN: usize = 8 + 1 + 8 + 8 + 1 + 2 + 32;
}

#[account]
pub struct BetEntry {
    pub game_id: u64,
    pub bet_index: u8,
    pub player: Pubkey,
    pub amount: u64,
}

impl BetEntry {
    pub const LEN: usize = 8 + 1 + 32 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GameStatus {
    Waiting,
    AwaitingVrf,
    Finished,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Betting is closed")]
    BettingClosed,
    #[msg("Bet too small (min 0.01 SOL)")]
    BetTooSmall,
    #[msg("Game is full (max 64 players)")]
    GameFull,
    #[msg("Invalid game status")]
    InvalidGameStatus,
    #[msg("Not enough players (min 2)")]
    NotEnoughPlayers,
    #[msg("VRF not fulfilled yet")]
    VrfNotFulfilled,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Invalid VRF account")]
    InvalidVrfAccount,
    #[msg("Unauthorized - caller is not authority")]
    Unauthorized,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid winner - not in top four")]
    InvalidWinner,
    #[msg("Game already settled")]
    GameAlreadySettled,
    #[msg("Bet amount cannot be zero")]
    BetAmountZero,
    #[msg("Player already placed bet")]
    PlayerAlreadyBet,
    #[msg("VRF request failed")]
    VrfRequestFailed,
    #[msg("Game vault mismatch")]
    GameVaultMismatch,
}
