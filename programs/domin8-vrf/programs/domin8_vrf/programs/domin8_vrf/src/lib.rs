use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF");

#[program]
pub mod domin8_vrf {
    use super::*;

    /// Initialize the VRF program with an authority
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Request VRF for a game
    /// game_id: Unique identifier from your database
    /// round: 1 for first round/quick games, 2 for final round in long games
    pub fn request_vrf(
        ctx: Context<RequestVrf>,
        game_id: String,
        round: u8,
    ) -> Result<()> {
        instructions::request_vrf::handler(ctx, game_id, round)
    }

    /// Mark a game seed as used (optional, for tracking)
    pub fn mark_seed_used(ctx: Context<MarkSeedUsed>) -> Result<()> {
        instructions::mark_seed_used::handler(ctx)
    }
}