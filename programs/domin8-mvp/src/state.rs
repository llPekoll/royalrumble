use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub house_fee_bps: u16,
    pub current_game_id: u64,
}

impl Config {
    pub const LEN: usize = 32 + 32 + 2 + 8;
}

#[account]
pub struct Game {
    pub game_id: u64,
    pub status: GameStatus,
    pub start_time: i64,
    pub total_pot: u64,
    pub bet_count: u8,
    pub winner_index: Option<u8>,
    pub vrf_request: Pubkey,
}

impl Game {
    pub const LEN: usize = 8 + 1 + 8 + 8 + 1 + 2 + 32;
}

#[account]
pub struct BetEntry {
    pub game_id: u64,
    pub bet_index: u8,
    pub player: Pubkey,
    pub amount: u64,
}

impl BetEntry {
    pub const LEN: usize = 8 + 1 + 32 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GameStatus {
    Waiting,
    AwaitingVrf,
    Finished,
}
