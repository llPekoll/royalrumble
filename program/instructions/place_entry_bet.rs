use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::instructions::transfer_lamports;

#[derive(Accounts)]
pub struct PlaceEntryBet<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn place_entry_bet(ctx: Context<PlaceEntryBet>, amount: u64) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is in entry phase
    require!(
        game.status == GameStatus::EntryPhase,
        GameError::NotInEntryPhase
    );
    
    // Check minimum bet amount
    require!(
        amount >= MIN_BET,
        GameError::BetTooSmall
    );
    
    // Check entry bets not full
    require!(
        game.entry_bet_count < 64,
        GameError::EntryBetsFull
    );
    
    // Transfer lamports from player to game PDA
    transfer_lamports(
        &ctx.accounts.player.to_account_info(),
        &ctx.accounts.game.to_account_info(),
        amount,
    )?;
    
    // Record the bet
    let bet_index = game.entry_bet_count as usize;
    game.entry_bets[bet_index] = amount;
    game.entry_players[bet_index] = ctx.accounts.player.key();
    
    // Update totals
    game.entry_pool = game.entry_pool
        .checked_add(amount)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    game.entry_bet_count = game.entry_bet_count
        .checked_add(1)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    msg!(
        "Entry bet placed: player {}, amount {}, total pool {}",
        ctx.accounts.player.key(),
        amount,
        game.entry_pool
    );
    
    Ok(())
}