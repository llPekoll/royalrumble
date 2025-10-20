use crate::state::BetEntry;
use anchor_lang::prelude::*;

/// Game status enumeration
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum GameStatus {
    Idle,                     // Waiting for first player
    Waiting,                  // Accepting bets
    AwaitingWinnerRandomness, // Waiting for Switchboard VRF for winner selection
    Finished,                 // Game concluded, winner selected
}

impl GameStatus {
    pub const LEN: usize = 1; // Enum is 1 byte
}

/// Current game round state stored as singleton PDA
/// Seeds: [b"game_round"]
#[account]
pub struct GameRound {
    pub round_id: u64,
    pub status: GameStatus,
    pub start_timestamp: i64,
    pub end_timestamp: i64, // When betting window closes

    // Individual bets (unlimited - dynamically grows via realloc)

    // Pot tracking
    pub total_pot: u64,

    // Winner
    pub winner: Pubkey,
    pub winning_bet_index: u32, // Index of the winning bet (for UI display)

    // ORAO VRF integration
    pub vrf_request_pubkey: Pubkey, // ORAO VRF request account
    pub vrf_seed: [u8; 32],         // Seed used for VRF request
    pub randomness_fulfilled: bool, // Track if randomness is ready
    pub bet_index: u8,              // Track if randomness is ready
    pub bets: [BetEntry; 8],
}

impl GameRound {
    pub const LEN: usize =
        8 + GameStatus::LEN + 8 + 8 + 8 + 32 + 4 + 32 + 32 + 1 + 1 + (BetEntry::LEN * 8) + 8;

    /// Check if the game is in a state where bets can be placed
    pub fn can_accept_bets(&self) -> bool {
        matches!(self.status, GameStatus::Idle | GameStatus::Waiting)
    }

    /// Check if the game is a small game (2+ bets) - all games are small games in MVP
    pub fn is_small_game(&self) -> bool {
        self.bets.len() >= 2
    }
    pub fn add_bet(&mut self, bet: BetEntry) {
        self.bet_index += 1;
        self.bets[self.bet_index as usize] = bet;
    }

    /// Get bet entry by wallet address
    pub fn find_bet(&self, wallet: &Pubkey) -> Option<&BetEntry> {
        self.bets.iter().find(|b| b.wallet == *wallet)
    }

    /// Get mutable bet entry by wallet address
    pub fn find_bet_mut(&mut self, wallet: &Pubkey) -> Option<&mut BetEntry> {
        self.bets.iter_mut().find(|b| b.wallet == *wallet)
    }

    /// Calculate total pot value
    pub fn get_total_pot(&self) -> u64 {
        self.total_pot
    }
}
