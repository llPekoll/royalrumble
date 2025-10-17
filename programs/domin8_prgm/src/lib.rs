use anchor_lang::prelude::*;

// Import modules
pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

// Import everything we need for the program
use instructions::*;

// Re-export public types for external use
pub use constants::*;
pub use errors::*;
pub use state::*;

declare_id!("8KTP4omvYrCqK1paqMcXmhktszqJvMSPSkBb3QH1urM8");

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

    /// UNIFIED INSTRUCTION: Progress game from Waiting directly to AwaitingWinnerRandomness with ORAO VRF
    pub fn unified_progress_to_resolution(ctx: Context<UnifiedProgressToResolution>) -> Result<()> {
        instructions::unified_progress_to_resolution(ctx)
    }

    /// UNIFIED INSTRUCTION: Resolve winner using ORAO VRF and immediately distribute winnings
    pub fn unified_resolve_and_distribute(ctx: Context<UnifiedResolveAndDistribute>) -> Result<()> {
        instructions::unified_resolve_and_distribute(ctx)
    }

    /// EMERGENCY INSTRUCTION: Refund all players proportionally when game is stuck for >24 hours
    /// Only callable by program authority as a last resort when VRF or other systems fail
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        instructions::emergency_withdraw(ctx)
    }
}
