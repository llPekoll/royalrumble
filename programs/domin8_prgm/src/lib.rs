use anchor_lang::prelude::*;

// Import modules
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Import everything we need for the program
use instructions::*;

// Re-export public types for external use
pub use constants::*;
pub use errors::*;
pub use events::*;
pub use state::*;

declare_id!("AgmSbCQZ98aYtqntEk8w7aLedYxfvQurNU4pLtKbtpk4");

#[program]
pub mod domin8_prgm {
    use super::*;

    /// Initialize the game with configuration
    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        instructions::initialize(ctx, treasury)
    }

    /// Create a new game round with the first bet (called by first player)
    pub fn create_game(ctx: Context<CreateGame>, amount: u64) -> Result<()> {
        instructions::create_game(ctx, amount)
    }

    /// Place an additional bet in the current game round (called by subsequent players)
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        instructions::place_bet(ctx, amount)
    }

    /// UNIFIED INSTRUCTION: Progress game from Waiting directly to AwaitingWinnerRandomness with ORAO VRF
    pub fn unified_progress_to_resolution(ctx: Context<UnifiedProgressToResolution>) -> Result<()> {
        instructions::unified_progress_to_resolution(ctx)
    }

    /// UNIFIED INSTRUCTION: Resolve winner using ORAO VRF and immediately distribute winnings
    pub fn unified_resolve_and_distribute(ctx: Context<UnifiedResolveAndDistribute>) -> Result<()> {
        instructions::unified_resolve_and_distribute(ctx)
    }

    /// Cleanup old game round (backend-triggered after 1 week)
    pub fn cleanup_old_game(ctx: Context<CleanupOldGame>, round_id: u64) -> Result<()> {
        instructions::cleanup_old_game(ctx, round_id)
    }

    // TODO: Add emergency_withdraw instruction for stuck games (24+ hours)
}
