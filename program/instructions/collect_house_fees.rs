use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::instructions::transfer_lamports;

#[derive(Accounts)]
pub struct CollectHouseFees<'info> {
    #[account(
        mut,
        seeds = [b"game"],
        bump = game.load()?.bump
    )]
    pub game: AccountLoader<'info, Game>,
    
    /// CHECK: This is the house wallet from game state
    #[account(mut)]
    pub house_wallet: UncheckedAccount<'info>,
    
    pub backend: Signer<'info>,
}

pub fn collect_house_fees(ctx: Context<CollectHouseFees>) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is settled
    require!(
        game.status == GameStatus::Settled,
        GameError::GameNotSettled
    );
    
    // Check house fees not already collected
    require!(
        !game.house_collected,
        GameError::HouseFeesAlreadyCollected
    );
    
    // Verify house wallet matches game state
    require!(
        ctx.accounts.house_wallet.key() == game.house_wallet,
        GameError::UnauthorizedBackend
    );
    
    // Calculate entry fee (5% of entry pool)
    let entry_fee = game.entry_pool
        .checked_mul(5)
        .ok_or(GameError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Calculate spectator fee (5% of spectator pool)
    let spectator_fee = game.spectator_pool
        .checked_mul(5)
        .ok_or(GameError::ArithmeticOverflow)?
        .checked_div(100)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Calculate total fees
    let total_fees = entry_fee
        .checked_add(spectator_fee)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    // Transfer fees to house wallet
    if total_fees > 0 {
        transfer_lamports(
            &ctx.accounts.game.to_account_info(),
            &ctx.accounts.house_wallet.to_account_info(),
            total_fees,
        )?;
    }
    
    // Mark as collected
    game.house_collected = true;
    
    msg!(
        "House fees collected: entry fee {}, spectator fee {}, total {}",
        entry_fee,
        spectator_fee,
        total_fees
    );
    
    Ok(())
}