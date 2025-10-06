use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::instructions::transfer_lamports;

#[derive(Accounts)]
pub struct CancelAndRefund<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    /// CHECK: This is the player to refund
    #[account(mut)]
    pub player_account: UncheckedAccount<'info>,
    
    pub backend: Signer<'info>,
}

pub fn cancel_and_refund(ctx: Context<CancelAndRefund>, player: Pubkey) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is cancelled
    require!(
        game.status == GameStatus::Cancelled,
        GameError::GameNotCancelled
    );
    
    // Verify player account matches the provided pubkey
    require!(
        ctx.accounts.player_account.key() == player,
        GameError::UnauthorizedBackend
    );
    
    let mut total_refund = 0u64;
    let mut has_bets_to_refund = false;
    
    // Find and refund entry bets
    for i in 0..game.entry_bet_count as usize {
        if game.entry_players[i] == player && !game.entry_refunded[i] {
            total_refund = total_refund
                .checked_add(game.entry_bets[i])
                .ok_or(GameError::ArithmeticOverflow)?;
            game.entry_refunded[i] = true;
            has_bets_to_refund = true;
        }
    }
    
    // Find and refund spectator bets
    for i in 0..game.spectator_bet_count as usize {
        if game.spectator_players[i] == player && !game.spectator_refunded[i] {
            total_refund = total_refund
                .checked_add(game.spectator_bets[i])
                .ok_or(GameError::ArithmeticOverflow)?;
            game.spectator_refunded[i] = true;
            has_bets_to_refund = true;
        }
    }
    
    // Check player has bets to refund
    require!(has_bets_to_refund, GameError::NoBetsToRefund);
    
    // Transfer refund to player
    if total_refund > 0 {
        transfer_lamports(
            &ctx.accounts.game.to_account_info(),
            &ctx.accounts.player_account.to_account_info(),
            total_refund,
        )?;
    }
    
    msg!(
        "Player refunded: {}, amount {}",
        player,
        total_refund
    );
    
    Ok(())
}