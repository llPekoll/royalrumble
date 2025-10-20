use crate::constants::*;
use crate::errors::Domin8Error;
use crate::events::BetPlaced;
use crate::state::{BetEntry, GameConfig, GameCounter, GameRound, GameStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

#[derive(Accounts)]
pub struct PlaceBet<'info> {
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
        seeds = [GAME_ROUND_SEED, counter.current_round_id.to_le_bytes().as_ref()],
        bump,
        realloc = game_round.to_account_info().data_len() + std::mem::size_of::<BetEntry>(),
        realloc::payer = player,
        realloc::zero = false,
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

    pub system_program: Program<'info, System>,
}

/// Place an additional bet in the current game round
/// This instruction is called by players after the first bet has been placed
pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    let counter = &ctx.accounts.counter;
    let game_round = &mut ctx.accounts.game_round;
    let player_key = ctx.accounts.player.key();
    let clock = Clock::get()?;

    // Security: ensure bets only on current round (prevent betting on old games)
    require!(
        game_round.round_id == counter.current_round_id,
        Domin8Error::InvalidGameStatus
    );

    // ⭐ Check if bets are locked (prevents bets during resolution)
    require!(!config.bets_locked, Domin8Error::BetsLocked);

    // Validate game state - must be Idle or Waiting
    require!(game_round.can_accept_bets(), Domin8Error::InvalidGameStatus);

    // ⭐ Validate betting window hasn't closed (for Waiting status)
    // Betting is allowed while: current_time < end_timestamp
    if game_round.status == GameStatus::Waiting {
        require!(
            clock.unix_timestamp < game_round.end_timestamp,
            Domin8Error::BettingWindowClosed
        );
    }

    // Validate bet amount meets minimum requirement
    require!(amount >= MIN_BET_LAMPORTS, Domin8Error::BetTooSmall);

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

    // Add to existing pot
    game_round.total_pot = game_round.total_pot.saturating_add(amount);

    // Find existing bet or add new one
    // New bet - add to vector (account was already reallocated)
    let bet_entry = BetEntry {
        wallet: player_key,
        bet_amount: amount,
        timestamp: clock.unix_timestamp,
    };

    game_round.add_bet(bet_entry);

    msg!(
        "New bet placed: {}, amount: {}, total bets: {}",
        player_key,
        amount,
        game_round.bets.len()
    );

    msg!("Total pot: {} lamports", game_round.total_pot);

    // ⭐ Emit bet placed event
    emit!(BetPlaced {
        round_id: game_round.round_id,
        player: player_key,
        amount,
        bet_count: game_round.bets.len() as u8,
        total_pot: game_round.total_pot,
        end_timestamp: game_round.end_timestamp,
        is_first_bet: false,
    });

    Ok(())
}
