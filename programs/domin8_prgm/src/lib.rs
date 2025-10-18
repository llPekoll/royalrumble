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

declare_id!("9Did6kAH9Mkteyi4xCrrq5x8bjBPQ1o9zZEoGC2hSYnk");

#[program]
pub mod domin8_prgm {
    use super::*;

    /// Initialize the game with configuration
    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        instructions::initialize(ctx, treasury)
    }

    /// Create a new game round with the first bet (called by first player)
    /// `seed` must be provided by the client and used to derive the ORAO request PDA
    pub fn create_game(ctx: Context<CreateGame>, amount: u64, seed: [u8; 32]) -> Result<()> {
        instructions::create_game(ctx, amount, seed)
    }

    /// Place an additional bet in the current game round (called by subsequent players)
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        instructions::place_bet(ctx, amount)
    }

    /// Close betting window and lock game for winner selection
    pub fn close_betting_window(ctx: Context<CloseBettingWindow>) -> Result<()> {
        instructions::close_betting_window(ctx)
    }

    /// Select winner using VRF and distribute payouts
    pub fn select_winner_and_payout(ctx: Context<SelectWinnerAndPayout>) -> Result<()> {
        instructions::select_winner_and_payout(ctx)
    }

    /// Cleanup old game round (backend-triggered after 1 week)
    pub fn cleanup_old_game(ctx: Context<CleanupOldGame>, round_id: u64) -> Result<()> {
        instructions::cleanup_old_game(ctx, round_id)
    }

    // TODO: Add emergency_withdraw instruction for stuck games (24+ hours)
}
