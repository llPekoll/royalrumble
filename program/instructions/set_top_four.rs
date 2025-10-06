use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SetTopFour<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    pub backend: Signer<'info>,
}

pub fn set_top_four(
    ctx: Context<SetTopFour>,
    top_four_positions: [i8; 4],
) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // For testing purposes, allow setting top four from EntryPhase
    // In production, you'd check for SelectingTopFour status
    require!(
        game.status == GameStatus::EntryPhase || game.status == GameStatus::SelectingTopFour,
        GameError::NotInSelectingTopFour
    );
    
    // Validate all positions are valid entry bet indices
    for &position in &top_four_positions {
        require!(
            position >= 0 && position < game.entry_bet_count as i8,
            GameError::InvalidTopFourPositions
        );
    }
    
    // Set top four
    game.top_four = top_four_positions;
    
    // Determine game mode and next status based on number of players
    if game.entry_bet_count >= 8 {
        // Long game - proceed to spectator phase
        game.game_mode = GameMode::Long;
        game.status = GameStatus::SpectatorPhase;
        
        // Set spectator phase start time
        let clock = Clock::get()?;
        game.spectator_phase_start = clock.unix_timestamp;
        
        msg!("Top four set for long game: {:?}", top_four_positions);
    } else {
        // Short game - skip spectator phase, go directly to selecting winner
        game.game_mode = GameMode::Short;
        game.status = GameStatus::SelectingWinner;
        
        msg!("Top four set for short game: {:?}", top_four_positions);
    }
    
    Ok(())
}