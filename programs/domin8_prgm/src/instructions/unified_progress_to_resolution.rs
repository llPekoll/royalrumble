use anchor_lang::prelude::*;
use orao_solana_vrf::cpi::accounts::RequestV2;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::cpi::request_v2;
use crate::state::{GameRound, GameConfig, GameStatus};
use crate::errors::Domin8Error;
use crate::constants::{GAME_ROUND_SEED, GAME_CONFIG_SEED};

#[derive(Accounts)]
pub struct UnifiedProgressToResolution<'info> {
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
    
    /// The crank authority
    #[account(
        mut,
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,
    
    /// ORAO VRF Program
    pub vrf_program: Program<'info, OraoVrf>,
    
    /// ORAO Network State
    /// CHECK: ORAO VRF program validates this
    #[account(mut)]
    pub network_state: AccountInfo<'info>,
    
    /// ORAO Treasury
    /// CHECK: ORAO VRF program validates this  
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    /// VRF Request Account (PDA derived from game_round + seed)
    /// CHECK: Will be created by ORAO VRF program
    #[account(mut)]
    pub vrf_request: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

/// UNIFIED INSTRUCTION: Progress game from Waiting directly to AwaitingWinnerRandomness
/// This replaces the old progress_to_resolution + separate VRF request
pub fn unified_progress_to_resolution(ctx: Context<UnifiedProgressToResolution>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let game_round = &mut ctx.accounts.game_round;
    let clock = Clock::get()?;

    // Validate game state
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );

    // ⭐ Validate betting window has closed (prevents early progression)
    require!(
        clock.unix_timestamp >= game_round.end_timestamp,
        Domin8Error::BettingWindowStillOpen
    );

    // ⭐ Lock the game to prevent new bets during resolution
    config.game_locked = true;

    let bet_count = game_round.bets.len();
    msg!("Unified progress: transitioning game {} with {} bets", game_round.round_id, bet_count);
    msg!("Game locked - no new bets allowed during resolution");
    
    match bet_count {
        0 => {
            return Err(Domin8Error::InvalidGameStatus.into());
        },
        1 => {
            // Single bet - immediate finish with refund
            game_round.status = GameStatus::Finished;
            game_round.winner = game_round.bets[0].wallet;
            msg!("Single bet game - immediate finish with refund");
            return Ok(());
        },
        2..=64 => {
            // Multi-bet game - request ORAO VRF and transition to AwaitingWinnerRandomness
            
            // Generate deterministic seed for this game round
            let seed: [u8; 32] = generate_vrf_seed(game_round.round_id);
            game_round.vrf_seed = seed;
            game_round.vrf_request_pubkey = ctx.accounts.vrf_request.key();
            
            // Make CPI call to ORAO VRF
            let cpi_program = ctx.accounts.vrf_program.to_account_info();
            let cpi_accounts = RequestV2 {
                payer: ctx.accounts.crank.to_account_info(),
                network_state: ctx.accounts.network_state.to_account_info(),
                treasury: ctx.accounts.treasury.to_account_info(),
                request: ctx.accounts.vrf_request.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            };
            
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            request_v2(cpi_ctx, seed)?;
            
            // Update game state to AwaitingWinnerRandomness
            game_round.status = GameStatus::AwaitingWinnerRandomness;
            game_round.randomness_fulfilled = false;
            
            msg!("ORAO VRF requested - game {} now awaiting winner randomness", game_round.round_id);
        },
        _ => return Err(Domin8Error::InvalidGameStatus.into()),
    }
    
    Ok(())
}

fn generate_vrf_seed(round_id: u64) -> [u8; 32] {
    let mut seed = [0u8; 32];
    seed[0..8].copy_from_slice(&round_id.to_le_bytes());
    seed[8..16].copy_from_slice(&Clock::get().unwrap().unix_timestamp.to_le_bytes());
    seed
}