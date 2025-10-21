use crate::constants::*;
use crate::errors::Domin8Error;
use crate::events::BetPlaced;
use crate::state::{BetEntry, GameConfig, GameCounter, GameRound, GameStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use orao_solana_vrf::cpi::accounts::RequestV2;
use orao_solana_vrf::cpi::request_v2;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::state::NetworkState;
use orao_solana_vrf::{CONFIG_ACCOUNT_SEED, ID as ORAO_VRF_ID};

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [GAME_COUNTER_SEED],
        bump
    )]
    pub counter: Account<'info, GameCounter>,

    #[account(
        init,
        payer = player,
        space = GameRound::LEN,
        seeds = [GAME_ROUND_SEED, counter.current_round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_round: Account<'info, GameRound>,

    /// First bet entry PDA (bet_index = 0)
    #[account(
        init,
        payer = player,
        space = BetEntry::LEN,
        seeds = [b"bet", counter.current_round_id.to_le_bytes().as_ref(), 0u32.to_le_bytes().as_ref()],
        bump
    )]
    pub bet_entry: Account<'info, BetEntry>,

    /// CHECK: This is the vault PDA that holds game funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub player: Signer<'info>,

    /// ORAO VRF Program
    pub vrf_program: Program<'info, OraoVrf>,

    /// ORAO Network State (validated as PDA from ORAO VRF program)
    #[account(
        mut,
        seeds = [CONFIG_ACCOUNT_SEED],
        bump,
        seeds::program = ORAO_VRF_ID
    )]
    pub network_state: Account<'info, NetworkState>,

    /// ORAO Treasury
    /// CHECK: ORAO VRF program validates this
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    /// VRF Request Account (will be created by ORAO VRF program)
    /// CHECK: Orao randomness account - derived from force field in instruction logic
    #[account(mut)]
    pub vrf_request: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Create a new game round with the first bet
/// This instruction is called by the first player to place a bet in a new round
pub fn create_game(ctx: Context<CreateGame>, amount: u64) -> Result<()> {
    msg!("Initializing game round creation");
    let config = &ctx.accounts.config;
    let counter = &ctx.accounts.counter;
    let game_round = &mut ctx.accounts.game_round;
    let player_key = ctx.accounts.player.key();
    let clock = Clock::get()?;

    // ⭐ Check if bets are locked (prevents bets during resolution)
    require!(!config.bets_locked, Domin8Error::BetsLocked);

    // Validate bet amount meets minimum requirement
    require!(amount >= MIN_BET_LAMPORTS, Domin8Error::BetTooSmall);

    // Initialize new game round with current counter value
    game_round.round_id = counter.current_round_id;
    game_round.status = GameStatus::Waiting;
    game_round.start_timestamp = clock.unix_timestamp;
    // ⭐ Set betting window end time (30 seconds from now)
    game_round.end_timestamp = clock
        .unix_timestamp
        .checked_add(DEFAULT_SMALL_GAME_WAITING_DURATION as i64)
        .ok_or(Domin8Error::ArithmeticOverflow)?;
    game_round.total_pot = amount;
    game_round.winner = Pubkey::default();
    game_round.winning_bet_index = 0; // Initialize to 0
    game_round.randomness_fulfilled = false;
    msg!("Basci set");

    // ⭐ REQUEST VRF FIRST (before transferring bet) - gives ORAO 30 seconds to fulfill during waiting period
    // Use force field from config for VRF seed (like riskdotfun)
    // This ensures unique VRF request PDAs for each game
    let seed: [u8; 32] = config.force;
    game_round.vrf_seed = seed;
    game_round.vrf_request_pubkey = ctx.accounts.vrf_request.key();

    // Make CPI call to ORAO VRF (charges VRF fee from player)
    let cpi_program = ctx.accounts.vrf_program.to_account_info();
    let cpi_accounts = RequestV2 {
        payer: ctx.accounts.player.to_account_info(),
        network_state: ctx.accounts.network_state.to_account_info(),
        treasury: ctx.accounts.treasury.to_account_info(),
        request: ctx.accounts.vrf_request.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    msg!("mamadou");

    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    request_v2(cpi_ctx, seed)?;
    msg!("req2 passed");

    // Transfer SOL to vault (AFTER VRF request so player has enough for VRF fee)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    msg!("New game round created: {}", counter.current_round_id);
    msg!(
        "Game started by first bet - betting window closes at {}",
        game_round.end_timestamp
    );
    msg!("ORAO VRF requested immediately - will fulfill during waiting period");
    msg!("VRF seed (first 16 bytes): {:?}", &seed[0..16]);
    msg!("VRF request account: {}", ctx.accounts.vrf_request.key());

    // Initialize the first bet entry PDA
    let bet_entry = &mut ctx.accounts.bet_entry;
    bet_entry.game_round_id = game_round.round_id;
    bet_entry.bet_index = 0; // First bet
    bet_entry.wallet = player_key;
    bet_entry.bet_amount = amount;
    bet_entry.timestamp = clock.unix_timestamp;

    // Increment bet count
    game_round.bet_count = 1;

    msg!(
        "First bet placed: {}, amount: {}, total bets: {}",
        player_key,
        amount,
        game_round.bet_count
    );
    msg!("Total pot: {} lamports", game_round.total_pot);
    msg!("game round ->{}", game_round.get_lamports());
    msg!("game Len ->{}", game_round.to_account_info().data_len());
    msg!("Rent {}", Rent::get()?.minimum_balance(GameRound::LEN));
    // logger tout les accounts
    // check ta

    // ⭐ Emit bet placed event
    emit!(BetPlaced {
        round_id: game_round.round_id,
        player: player_key,
        amount,
        bet_count: game_round.bets.len() as u8,
        total_pot: game_round.total_pot,
        end_timestamp: game_round.end_timestamp,
        is_first_bet: true,
    });

    Ok(())
}
