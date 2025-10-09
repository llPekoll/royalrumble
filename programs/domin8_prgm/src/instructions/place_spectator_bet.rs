use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{GameRound, GameStatus, SpectatorBet};
use crate::constants::*;
use crate::errors::Domin8Error;

#[derive(Accounts)]
pub struct PlaceSpectatorBet<'info> {
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    /// CHECK: This is the vault PDA that holds game funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub spectator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn place_spectator_bet(
    ctx: Context<PlaceSpectatorBet>,
    amount: u64,
    target_finalist: Pubkey,
) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    let spectator_key = ctx.accounts.spectator.key();
    
    // Validate game state - must be SpectatorBetting
    require!(
        game_round.status == GameStatus::SpectatorBetting,
        Domin8Error::InvalidGameStatus
    );
    
    // Ensure the spectator is not a finalist
    require!(
        !game_round.is_finalist(&spectator_key),
        Domin8Error::NotASpectator
    );
    
    // Validate target finalist exists in the finalists list
    require!(
        game_round.finalists.contains(&target_finalist),
        Domin8Error::FinalistNotFound
    );
    
    // Check spectator bet limit to keep account size manageable
    require!(
        game_round.spectator_bets.len() < MAX_SPECTATOR_BETS,
        Domin8Error::MaxPlayersReached // Reusing error for simplicity
    );
    
    // Validate minimum bet amount
    require!(
        amount >= MIN_BET_LAMPORTS,
        Domin8Error::BetTooSmall
    );
    
    // Transfer SOL to vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.spectator.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // Create spectator bet
    let spectator_bet = SpectatorBet {
        bettor: spectator_key,
        target_finalist,
        amount,
    };
    
    // Add to spectator bets and update pot
    game_round.spectator_bets.push(spectator_bet);
    game_round.spectator_pot = game_round.spectator_pot.saturating_add(amount);
    
    msg!("Spectator bet placed: {} lamports on finalist {}", amount, target_finalist);
    msg!("Total spectator pot: {} lamports", game_round.spectator_pot);
    
    Ok(())
}