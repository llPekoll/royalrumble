use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::instructions::transfer_lamports;

#[derive(Accounts)]
pub struct PlaceSpectatorBet<'info> {
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

pub fn place_spectator_bet(
    ctx: Context<PlaceSpectatorBet>,
    amount: u64,
    target: i8,
) -> Result<()> {
    let mut game = ctx.accounts.game.load_mut()?;
    
    // Check game is in spectator phase
    require!(
        game.status == GameStatus::SpectatorPhase,
        GameError::NotInSpectatorPhase
    );
    
    // Check minimum bet amount
    require!(
        amount >= MIN_BET,
        GameError::BetTooSmall
    );
    
    // Check spectator bets not full
    require!(
        game.spectator_bet_count < 64,
        GameError::SpectatorBetsFull
    );
    
    // Check target is valid (0-3, index into top_four array)
    require!(
        target >= 0 && target < 4,
        GameError::InvalidTarget
    );
    
    // Check player is NOT in top four
    let player_key = ctx.accounts.player.key();
    for i in 0..4 {
        if game.top_four[i] >= 0 {
            let top_four_index = game.top_four[i] as usize;
            if top_four_index < game.entry_bet_count as usize {
                require!(
                    game.entry_players[top_four_index] != player_key,
                    GameError::PlayerInTopFour
                );
            }
        }
    }
    
    // Transfer lamports from player to game PDA
    transfer_lamports(
        &ctx.accounts.player.to_account_info(),
        &ctx.accounts.game.to_account_info(),
        amount,
    )?;
    
    // Record the bet
    let bet_index = game.spectator_bet_count as usize;
    game.spectator_bets[bet_index] = amount;
    game.spectator_players[bet_index] = player_key;
    game.spectator_targets[bet_index] = target;
    
    // Update totals
    game.spectator_pool = game.spectator_pool
        .checked_add(amount)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    game.spectator_bet_count = game.spectator_bet_count
        .checked_add(1)
        .ok_or(GameError::ArithmeticOverflow)?;
    
    msg!(
        "Spectator bet placed: player {}, amount {}, target {}, total pool {}",
        player_key,
        amount,
        target,
        game.spectator_pool
    );
    
    Ok(())
}