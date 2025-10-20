use anchor_lang::prelude::*;

/// Event emitted when a new game round is initialized
#[event]
pub struct GameInitialized {
    pub round_id: u64,
    pub start_timestamp: i64,
    pub end_timestamp: i64,
}

/// Event emitted when a bet is placed
#[event]
pub struct BetPlaced {
    pub round_id: u64,
    pub player: Pubkey,
    pub amount: u64,
    pub bet_count: u8,
    pub total_pot: u64,
    pub end_timestamp: i64,
    pub is_first_bet: bool,
}

/// Event emitted when game is locked (betting window closes)
#[event]
pub struct GameLocked {
    pub round_id: u64,
    pub final_bet_count: u8,
    pub total_pot: u64,
    pub vrf_request_pubkey: Pubkey,
}

/// Event emitted when winner is determined
#[event]
pub struct WinnerSelected {
    pub round_id: u64,
    pub winner: Pubkey,
    pub winning_bet_index: u32, // Index of the winning bet (for UI animations)
    pub total_pot: u64,
    pub house_fee: u64,
    pub winner_payout: u64,
}

/// Event emitted when game is reset for next round
#[event]
pub struct GameReset {
    pub old_round_id: u64,
    pub new_round_id: u64,
}
