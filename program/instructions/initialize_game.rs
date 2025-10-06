use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    pub backend: Signer<'info>,
}

pub fn initialize_game(ctx: Context<InitializeGame>) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    let clock = Clock::get()?;
    
    // Check time lock - current time must be >= last_game_end + TIME_LOCK_SECONDS
    let time_lock_end = game.last_game_end
        .checked_add(TIME_LOCK_SECONDS)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    require!(
        clock.unix_timestamp >= time_lock_end,
        GameError::TimeLockNotMet
    );
    
    // Increment game ID
    game.game_id = game.game_id
        .checked_add(1)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Reset game state
    game.status = GameStatus::EntryPhase;
    game.game_mode = GameMode::Unknown;
    game.entry_pool = 0;
    game.spectator_pool = 0;
    game.entry_bet_count = 0;
    game.spectator_bet_count = 0;
    game.house_collected = false;
    game.entry_winnings_claimed = false;
    game.vrf_seed_top_four = None;
    game.vrf_seed_winner = None;
    
    // Reset arrays
    for i in 0..64 {
        game.entry_bets[i] = 0;
        game.entry_players[i] = Pubkey::default();
        game.spectator_bets[i] = 0;
        game.spectator_players[i] = Pubkey::default();
        game.spectator_targets[i] = -1;
        game.entry_refunded[i] = false;
        game.spectator_refunded[i] = false;
    }
    
    for i in 0..4 {
        game.top_four[i] = -1;
    }
    
    game.winner = -1;
    game.entry_phase_start = clock.unix_timestamp;
    game.entry_phase_duration = 0;
    game.spectator_phase_start = 0;
    game.spectator_phase_duration = 0;
    
    msg!("Game {} initialized", game.game_id);
    
    Ok(())
}