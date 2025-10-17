use anchor_lang::prelude::*;
use anchor_lang::system_program;
use orao_solana_vrf::cpi::accounts::RequestV2;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::cpi::request_v2;
use crate::state::{GameRound, GameConfig, GameCounter, GameStatus, BetEntry};
use crate::constants::*;
use crate::errors::Domin8Error;
use crate::events::BetPlaced;

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

    /// ORAO Network State
    /// CHECK: ORAO VRF program validates this
    #[account(mut)]
    pub network_state: AccountInfo<'info>,

    /// ORAO Treasury
    /// CHECK: ORAO VRF program validates this
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    /// VRF Request Account (PDA derived from game_round + seed)
    /// CHECK: Will be created by ORAO VRF program
    #[account(mut)]
    pub vrf_request: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Create a new game round with the first bet
/// This instruction is called by the first player to place a bet in a new round
pub fn create_game(
    ctx: Context<CreateGame>,
    amount: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let counter = &ctx.accounts.counter;
    let game_round = &mut ctx.accounts.game_round;
    let player_key = ctx.accounts.player.key();
    let clock = Clock::get()?;

    // ⭐ Check if bets are locked (prevents bets during resolution)
    require!(!config.bets_locked, Domin8Error::BetsLocked);

    // Validate bet amount meets minimum requirement
    require!(
        amount >= MIN_BET_LAMPORTS,
        Domin8Error::BetTooSmall
    );

    // Transfer SOL to vault
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

    // Initialize new game round with current counter value
    game_round.round_id = counter.current_round_id;
    game_round.status = GameStatus::Waiting;
    game_round.start_timestamp = clock.unix_timestamp;
    // ⭐ Set betting window end time (30 seconds from now)
    game_round.end_timestamp = clock.unix_timestamp
        .checked_add(DEFAULT_SMALL_GAME_WAITING_DURATION as i64)
        .ok_or(Domin8Error::ArithmeticOverflow)?;
    game_round.total_pot = amount;
    game_round.winner = Pubkey::default();
    game_round.randomness_fulfilled = false;

    // ⭐ REQUEST VRF IMMEDIATELY - gives ORAO 30 seconds to fulfill during waiting period
    // Generate deterministic seed for this game round
    let seed: [u8; 32] = generate_vrf_seed(game_round.round_id, clock.unix_timestamp);
    game_round.vrf_seed = seed;
    game_round.vrf_request_pubkey = ctx.accounts.vrf_request.key();

    // Make CPI call to ORAO VRF
    let cpi_program = ctx.accounts.vrf_program.to_account_info();
    let cpi_accounts = RequestV2 {
        payer: ctx.accounts.player.to_account_info(),
        network_state: ctx.accounts.network_state.to_account_info(),
        treasury: ctx.accounts.treasury.to_account_info(),
        request: ctx.accounts.vrf_request.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    request_v2(cpi_ctx, seed)?;

    msg!("New game round created: {}", counter.current_round_id);
    msg!("Game started by first bet - betting window closes at {}", game_round.end_timestamp);
    msg!("ORAO VRF requested immediately - will fulfill during waiting period");
    msg!("VRF seed (first 16 bytes): {:?}", &seed[0..16]);
    msg!("VRF request account: {}", ctx.accounts.vrf_request.key());

    // Reallocate account to fit first bet
    let new_size = game_round.to_account_info().data_len() + std::mem::size_of::<BetEntry>();
    game_round.to_account_info().resize(new_size)?;

    let bet_entry = BetEntry {
        wallet: player_key,
        bet_amount: amount,
        timestamp: clock.unix_timestamp,
    };

    game_round.bets = vec![bet_entry];

    msg!("First bet placed: {}, amount: {}, total bets: {}",
         player_key, amount, game_round.bets.len());
    msg!("Total pot: {} lamports", game_round.total_pot);

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

fn generate_vrf_seed(round_id: u64, timestamp: i64) -> [u8; 32] {
    let mut seed = [0u8; 32];
    seed[0..8].copy_from_slice(&round_id.to_le_bytes());
    seed[8..16].copy_from_slice(&timestamp.to_le_bytes());
    seed
}
