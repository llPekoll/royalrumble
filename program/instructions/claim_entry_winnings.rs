use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::instructions::transfer_lamports;

#[derive(Accounts)]
pub struct ClaimEntryWinnings<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    #[account(mut)]
    pub winner: Signer<'info>,
}

pub fn claim_entry_winnings(ctx: Context<ClaimEntryWinnings>) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is settled
    require!(
        game.status == GameStatus::Settled,
        GameError::GameNotSettled
    );
    
    // Check entry winnings not already claimed
    require!(
        !game.entry_winnings_claimed,
        GameError::EntryWinningsAlreadyClaimed
    );
    
    // Check signer is the winner
    let winner_player = game.entry_players[game.winner as usize];
    require!(
        ctx.accounts.winner.key() == winner_player,
        GameError::NotWinner
    );
    
    // Calculate house fee (5% of entry pool)
    let house_fee = game.entry_pool
        .checked_mul(5)
        .ok_or(GameError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Calculate winnings (entry pool minus house fee)
    let winnings = game.entry_pool
        .checked_sub(house_fee)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Transfer winnings to winner
    transfer_lamports(
        &ctx.accounts.game.to_account_info(),
        &ctx.accounts.winner.to_account_info(),
        winnings,
    )?;
    
    // Mark as claimed
    game.entry_winnings_claimed = true;
    
    msg!(
        "Entry winnings claimed: winner {}, amount {}, house fee {}",
        winner_player,
        winnings,
        house_fee
    );
    
    Ok(())
}