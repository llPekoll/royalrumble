use anchor_lang::prelude::*;

// Import modules
pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

// Import everything we need for the program
use instructions::*;

// Re-export public types for external use
pub use constants::*;
pub use errors::*;
pub use state::*;
pub use utils::*;

declare_id!("CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK");

#[program]
pub mod domin8_prgm {
    use super::*;

    /// Initialize the game with configuration
    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        instructions::initialize(ctx, treasury)
    }

    /// Deposit a bet to join the current game round
    pub fn deposit_bet(ctx: Context<DepositBet>, amount: u64) -> Result<()> {
        instructions::deposit_bet(ctx, amount)
    }

    // Removed for small games MVP - large game features only
    // /// Place a spectator bet on a finalist (large games only)
    // pub fn place_spectator_bet(
    //     ctx: Context<PlaceSpectatorBet>,
    //     amount: u64,
    //     target_finalist: Pubkey,
    // ) -> Result<()> {
    //     instructions::place_spectator_bet(ctx, amount, target_finalist)
    // }

    // Old instructions removed - replaced by unified ORAO VRF flow
    // /// Progress game from waiting to resolution phase (crank only)
    // pub fn progress_to_resolution(ctx: Context<ProgressToResolution>) -> Result<()> {
    //     instructions::progress_to_resolution(ctx)
    // }

    // Removed for small games MVP - large game features only
    // /// Progress large game to final battle phase (crank only)
    // pub fn progress_to_final_battle(ctx: Context<ProgressToFinalBattle>) -> Result<()> {
    //     instructions::progress_to_final_battle(ctx)
    // }

    // /// Resolve finalists using Switchboard VRF (crank only)
    // pub fn resolve_finalists(ctx: Context<ResolveFinalists>) -> Result<()> {
    //     instructions::resolve_finalists(ctx)
    // }

    // Old instructions removed - replaced by unified ORAO VRF flow
    // /// Resolve winner using Switchboard VRF (crank only)
    // pub fn resolve_winner(ctx: Context<ResolveWinner>) -> Result<()> {
    //     instructions::resolve_winner(ctx)
    // }

    // /// Distribute winnings and reset game (crank only)
    // pub fn distribute_winnings_and_reset(ctx: Context<DistributeWinnings>) -> Result<()> {
    //     instructions::distribute_winnings_and_reset(ctx)
    // }

    // /// Claim winnings from a completed game round
    // pub fn claim_winnings(ctx: Context<ClaimWinnings>, round_id: u64) -> Result<()> {
    //     instructions::claim_winnings(ctx, round_id)
    // }

    /// UNIFIED INSTRUCTION: Progress game from Waiting directly to AwaitingWinnerRandomness with ORAO VRF
    pub fn unified_progress_to_resolution(ctx: Context<UnifiedProgressToResolution>) -> Result<()> {
        instructions::unified_progress_to_resolution(ctx)
    }

    /// UNIFIED INSTRUCTION: Resolve winner using ORAO VRF and immediately distribute winnings
    pub fn unified_resolve_and_distribute(ctx: Context<UnifiedResolveAndDistribute>) -> Result<()> {
        instructions::unified_resolve_and_distribute(ctx)
    }
}
