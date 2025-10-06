use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::solana_program::sysvar::Sysvar;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    let clock = Clock::get()?;
    
    // Check emergency timeout has been reached (24 hours after last game end)
    let emergency_timeout = game.last_game_end
        .checked_add(EMERGENCY_TIMEOUT_HOURS * 3600)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    require!(
        clock.unix_timestamp >= emergency_timeout,
        GameError::EmergencyTimeoutNotReached
    );
    
    // Calculate rent-exempt minimum
    let rent = Rent::get()?;
    let min_rent = rent.minimum_balance(ctx.accounts.game.to_account_info().data_len());
    let current_balance = ctx.accounts.game.to_account_info().lamports();
    
    // Calculate amount to withdraw (all except rent minimum)
    let withdraw_amount = current_balance
        .checked_sub(min_rent)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Transfer all available lamports to admin
    if withdraw_amount > 0 {
        **ctx.accounts.game.to_account_info().try_borrow_mut_lamports()? = min_rent;
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.admin
            .to_account_info()
            .lamports()
            .checked_add(withdraw_amount)
            .ok_or(GameError::ArithmeticOverflow)?;
    }
    
    // Mark game as cancelled
    game.status = GameStatus::Cancelled;
    
    msg!(
        "Emergency withdrawal executed: admin {}, amount {}",
        ctx.accounts.admin.key(),
        withdraw_amount
    );
    
    Ok(())
}