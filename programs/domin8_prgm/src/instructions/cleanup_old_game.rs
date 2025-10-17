use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameCounter};
use crate::errors::Domin8Error;
use crate::constants::{GAME_ROUND_SEED, GAME_CONFIG_SEED, GAME_COUNTER_SEED};

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct CleanupOldGame<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(
        seeds = [GAME_COUNTER_SEED],
        bump
    )]
    pub counter: Account<'info, GameCounter>,

    #[account(
        mut,
        seeds = [GAME_ROUND_SEED, round_id.to_le_bytes().as_ref()],
        bump,
        close = crank
    )]
    pub game_round: Account<'info, GameRound>,

    /// The crank authority (backend wallet)
    #[account(
        mut,
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Backend-triggered cleanup for old game rounds (1 week after completion)
/// This instruction closes the game_round PDA and reclaims rent to the crank authority
///
/// Safety checks:
/// - Game must be finished (not active)
/// - Game must be older than 1 week (604800 seconds)
/// - Game must be from a previous round (not current round)
pub fn cleanup_old_game(
    ctx: Context<CleanupOldGame>,
    round_id: u64,
) -> Result<()> {
    let game_round = &ctx.accounts.game_round;
    let current_round_id = ctx.accounts.counter.current_round_id;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Safety check 1: Game must not be the current active round
    require!(
        round_id < current_round_id,
        Domin8Error::CannotCleanupActiveGame
    );

    // Safety check 2: Game must be in finished state
    require!(
        game_round.status == crate::state::GameStatus::Finished,
        Domin8Error::CannotCleanupActiveGame
    );

    // Safety check 3: Game must be older than 1 week (604800 seconds)
    const ONE_WEEK_SECONDS: i64 = 7 * 24 * 60 * 60; // 604800 seconds

    let game_age = current_time
        .checked_sub(game_round.start_timestamp)
        .ok_or(Domin8Error::ArithmeticOverflow)?;

    require!(
        game_age >= ONE_WEEK_SECONDS,
        Domin8Error::GameTooRecentToCleanup
    );

    msg!("Cleaning up old game round {}", round_id);
    msg!("Game age: {} seconds ({} days)", game_age, game_age / 86400);
    msg!("Rent reclaimed to crank authority: {}", ctx.accounts.crank.key());

    // The game_round account is automatically closed via the close constraint
    // Rent is returned to the crank authority

    Ok(())
}
