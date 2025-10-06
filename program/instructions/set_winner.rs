use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct SetWinner<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    pub backend: Signer<'info>,
}

pub fn set_winner(ctx: Context<SetWinner>, winner_position: i8) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is in selecting winner phase
    require!(
        game.status == GameStatus::SelectingWinner,
        GameError::NotInSelectingWinner
    );
    
    // Check winner position is valid entry bet index
    require!(
        winner_position >= 0 && winner_position < game.entry_bet_count as i8,
        GameError::InvalidWinnerPosition
    );
    
    // For long games, winner must be in top four
    if game.game_mode == GameMode::Long {
        let mut winner_in_top_four = false;
        for &top_four_position in &game.top_four {
            if top_four_position == winner_position {
                winner_in_top_four = true;
                break;
            }
        }
        require!(winner_in_top_four, GameError::WinnerNotInTopFour);
    }
    
    // Set winner
    game.winner = winner_position;
    game.status = GameStatus::Settled;
    
    // Update last game end timestamp
    let clock = Clock::get()?;
    game.last_game_end = clock.unix_timestamp;
    
    let winner_player = game.entry_players[winner_position as usize];
    msg!(
        "Winner set: position {}, player {}, game settled",
        winner_position,
        winner_player
    );
    
    Ok(())
}