use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::instructions::transfer_lamports;

#[derive(Accounts)]
pub struct ClaimSpectatorWinnings<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
}

pub fn claim_spectator_winnings(ctx: Context<ClaimSpectatorWinnings>) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is settled
    require!(
        game.status == GameStatus::Settled,
        GameError::GameNotSettled
    );
    
    // Check game mode is long (spectator phase only exists in long games)
    require!(
        game.game_mode == GameMode::Long,
        GameError::GameModeNotLong
    );
    
    let player_key = ctx.accounts.player.key();
    
    // Find which top_four index contains the winner
    let mut winner_top_four_index = -1i8;
    for i in 0..4 {
        if game.top_four[i] == game.winner {
            winner_top_four_index = i as i8;
            break;
        }
    }
    
    require!(winner_top_four_index >= 0, GameError::InvalidWinnerPosition);
    
    // Find player's winning bets and calculate total
    let mut player_winning_bets = 0u64;
    let mut total_winning_bets = 0u64;
    let mut player_bet_indices = Vec::new();
    
    for i in 0..game.spectator_bet_count as usize {
        if game.spectator_targets[i] == winner_top_four_index {
            total_winning_bets = total_winning_bets
                .checked_add(game.spectator_bets[i])
                .ok_or(GameError::ArithmeticOverflow)?;
            
            if game.spectator_players[i] == player_key && !game.spectator_refunded[i] {
                player_winning_bets = player_winning_bets
                    .checked_add(game.spectator_bets[i])
                    .ok_or(GameError::ArithmeticOverflow)?;
                player_bet_indices.push(i);
            }
        }
    }
    
    // Check player has winning bets
    require!(
        player_winning_bets > 0,
        GameError::NoSpectatorWinnings
    );
    
    // Calculate house fee (5% of spectator pool)
    let house_fee = game.spectator_pool
        .checked_mul(5)
        .ok_or(GameError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Calculate total winnings pool (spectator pool minus house fee)
    let total_winnings_pool = game.spectator_pool
        .checked_sub(house_fee)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Calculate player's proportional share
    let player_winnings = total_winnings_pool
        .checked_mul(player_winning_bets)
        .ok_or(GameError::ArithmeticOverflow)?
        .checked_div(total_winning_bets)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Transfer winnings to player
    transfer_lamports(
        &ctx.accounts.game.to_account_info(),
        &ctx.accounts.player.to_account_info(),
        player_winnings,
    )?;
    
    // Mark player's bets as refunded to prevent double claiming
    for &index in &player_bet_indices {
        game.spectator_refunded[index] = true;
    }
    
    msg!(
        "Spectator winnings claimed: player {}, amount {}, winning bets {}",
        player_key,
        player_winnings,
        player_winning_bets
    );
    
    Ok(())
}