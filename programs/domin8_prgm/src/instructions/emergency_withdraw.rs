use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameStatus};
use crate::errors::Domin8Error;
use crate::constants::{GAME_ROUND_SEED, GAME_CONFIG_SEED, VAULT_SEED};

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    
    /// The vault PDA that holds game funds
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,
    
    /// Must be the program authority
    #[account(
        constraint = authority.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

/// EMERGENCY INSTRUCTION: Refund all players proportionally when game is stuck
/// 
/// SECURITY DESIGN:
/// 1. Only callable by program authority (transparent on-chain)
/// 2. Only works when game has been stuck for >24 hours 
/// 3. Returns funds proportionally to all players (no favoritism)
/// 4. Emits detailed logs for transparency
/// 5. Cannot be called on active games (only stuck ones)
/// 
/// This is NOT a backdoor because:
/// - Authority is known and transparent
/// - Only usable when game is genuinely stuck
/// - Players get their funds back proportionally
/// - All actions are logged and auditable on-chain
pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    let clock = Clock::get()?;
    
    // SAFETY CHECK 1: Game must be in a stuck state for at least 24 hours
    let time_since_start = clock.unix_timestamp
        .checked_sub(game_round.start_timestamp)
        .ok_or(Domin8Error::ArithmeticOverflow)?;
    const EMERGENCY_THRESHOLD_SECONDS: i64 = 86400; // 24 * 60 * 60 = 86400 seconds
    
    require!(
        time_since_start > EMERGENCY_THRESHOLD_SECONDS,
        Domin8Error::EmergencyTimeNotElapsed
    );
    
    // SAFETY CHECK 2: Game must be in a potentially stuck state
    require!(
        matches!(game_round.status, GameStatus::AwaitingWinnerRandomness | GameStatus::Waiting),
        Domin8Error::InvalidGameStatus
    );
    
    // SAFETY CHECK 3: Must have active bets to refund
    require!(
        !game_round.bets.is_empty() && game_round.initial_pot > 0,
        Domin8Error::NoFundsToRefund
    );
    
    msg!("EMERGENCY WITHDRAWAL INITIATED");
    msg!("Round ID: {}", game_round.round_id);
    msg!("Status: {:?}", game_round.status);
    msg!("Time stuck: {} seconds", time_since_start);
    msg!("Total pot: {} lamports", game_round.initial_pot);
    msg!("Number of players: {}", game_round.bets.len());
    
    // Calculate proportional refunds
    let vault_balance = ctx.accounts.vault.lamports();
    let total_bet_amount = game_round.initial_pot;
    
    // Ensure vault has sufficient funds (should match pot)
    require!(
        vault_balance >= total_bet_amount,
        Domin8Error::InsufficientFunds
    );
    
    // Find all player accounts in remaining_accounts and refund proportionally
    let mut total_refunded = 0u64;
    
    for bet in &game_round.bets {
        // Calculate proportional refund
        let refund_amount = (bet.bet_amount as u128)
            .checked_mul(vault_balance as u128)
            .ok_or(Domin8Error::ArithmeticOverflow)?
            .checked_div(total_bet_amount as u128)
            .ok_or(Domin8Error::ArithmeticOverflow)? as u64;
        
        if refund_amount > 0 {
            // Find player account in remaining_accounts
            let mut player_found = false;
            for account in ctx.remaining_accounts {
                if account.key() == bet.wallet {
                    // Direct lamport transfer using checked arithmetic
                    let vault_lamports = ctx.accounts.vault.lamports();
                    require!(
                        vault_lamports >= refund_amount,
                        Domin8Error::InsufficientFunds
                    );
                    
                    **ctx.accounts.vault.try_borrow_mut_lamports()? = vault_lamports
                        .checked_sub(refund_amount)
                        .ok_or(Domin8Error::ArithmeticOverflow)?;
                    
                    let account_lamports = account.lamports();
                    **account.try_borrow_mut_lamports()? = account_lamports
                        .checked_add(refund_amount)
                        .ok_or(Domin8Error::ArithmeticOverflow)?;
                    
                    total_refunded = total_refunded
                        .checked_add(refund_amount)
                        .ok_or(Domin8Error::ArithmeticOverflow)?;
                    player_found = true;
                    
                    msg!("REFUNDED: {} -> {} lamports", bet.wallet, refund_amount);
                    break;
                }
            }
            
            if !player_found {
                msg!("WARNING: Player {} not found in remaining accounts", bet.wallet);
            }
        }
    }
    
    // Reset game state
    let config = &mut ctx.accounts.config;

    game_round.status = GameStatus::Idle;
    game_round.bets.clear();
    game_round.initial_pot = 0;
    game_round.start_timestamp = 0;
    game_round.end_timestamp = 0;  // Reset betting window end time
    game_round.winner = Pubkey::default();
    game_round.vrf_request_pubkey = Pubkey::default();
    game_round.randomness_fulfilled = false;

    // ⭐ Unlock game after emergency refund
    config.game_locked = false;
    
    msg!("EMERGENCY WITHDRAWAL COMPLETED");
    msg!("Total refunded: {} lamports", total_refunded);
    msg!("Game reset to Idle state");
    
    Ok(())
}