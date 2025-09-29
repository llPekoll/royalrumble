use anchor_lang::prelude::*;

#[account]
pub struct VrfState {
    pub authority: Pubkey,
    pub nonce: u64,
}

impl VrfState {
    pub const SIZE: usize = 32 + 8; // pubkey + u64
}

#[account]
pub struct GameSeed {
    pub game_id: String,       // 4 + 32 bytes max
    pub round: u8,             // 1 byte
    pub random_seed: [u8; 32], // 32 bytes
    pub timestamp: i64,        // 8 bytes
    pub used: bool,            // 1 byte
}

impl GameSeed {
    pub const SIZE: usize = 4 + 32 + 1 + 32 + 8 + 1; // Total: 78 bytes

    pub const MAX_GAME_ID_LENGTH: usize = 32;
}