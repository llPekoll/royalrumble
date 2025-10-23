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
        bump
    )]
    pub game_round: Account<'info, GameRound>,

    /// CREATE: BetEntry PDA for storing bet details
    #[account(
        init,
        payer = player,
        space = BetEntry::LEN,
        seeds = [
            BET_ENTRY_SEED,
            counter.current_round_id.to_le_bytes().as_ref(),
            game_round.bet_count.to_le_bytes().as_ref()
        ],
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

    // ⭐ Validate bet amount doesn't exceed maximum (prevent whale dominance)
    require!(amount <= MAX_BET_LAMPORTS, Domin8Error::BetTooLarge);

    // ⭐ Check if user has sufficient funds (like Risk.fun)
    require!(
        ctx.accounts.player.lamports() >= amount,
        Domin8Error::InsufficientFunds
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

    // Check if we've reached max bets
    require!(
        game_round.bet_count < 64,
        Domin8Error::MaxBetsReached
    );

    // Add to existing pot
    game_round.total_pot = game_round.total_pot.saturating_add(amount);

    // Store bet amount in array for efficient winner selection
    let bet_index = game_round.bet_count as usize;
    game_round.bet_amounts[bet_index] = amount;
    game_round.bet_count += 1;

    // Create BetEntry PDA for detailed tracking
    let bet_entry = &mut ctx.accounts.bet_entry;
    bet_entry.game_round_id = game_round.round_id;
    bet_entry.bet_index = bet_index as u32;
    bet_entry.wallet = player_key;
    bet_entry.bet_amount = amount;
    bet_entry.timestamp = clock.unix_timestamp;
    bet_entry.payout_collected = false;

    msg!(
        "New bet placed: {}, amount: {}, total bets: {}",
        player_key,
        amount,
        game_round.bet_count
    );

    msg!("Total pot: {} lamports", game_round.total_pot);

    // ⭐ Emit bet placed event
    emit!(BetPlaced {
        round_id: game_round.round_id,
        player: player_key,
        amount,
        bet_count: game_round.bet_count as u8,
        total_pot: game_round.total_pot,
        end_timestamp: game_round.end_timestamp,
        is_first_bet: false,
        timestamp: clock.unix_timestamp,
        bet_index: bet_index as u32,
    });

    Ok(())
}
