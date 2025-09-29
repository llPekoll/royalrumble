use anchor_lang::prelude::*;

#[error_code]
pub enum VrfError {
    #[msg("Round must be 1 or 2")]
    InvalidRound,

    #[msg("Game ID too long (max 32 bytes)")]
    GameIdTooLong,

    #[msg("Unauthorized: Only the authority can perform this action")]
    Unauthorized,

    #[msg("Seed has already been used")]
    SeedAlreadyUsed,

    #[msg("VRF state already initialized")]
    AlreadyInitialized,
}