use anchor_lang::prelude::*;
use crate::state::BetEntry;

/// Game status enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum GameStatus {
    Idle,                        // Waiting for first player
    Waiting,                     // Accepting bets
    AwaitingWinnerRandomness,   // Waiting for Switchboard VRF for winner selection
    Finished,                    // Game concluded, winner selected
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
    
    // Individual bets (max 64)
    pub bets: Vec<BetEntry>,
    
    
    // Pot tracking
    pub initial_pot: u64,
    
    // Winner
    pub winner: Pubkey,
    
    // ORAO VRF integration
    pub vrf_request_pubkey: Pubkey,    // ORAO VRF request account
    pub vrf_seed: [u8; 32],           // Seed used for VRF request
    pub randomness_fulfilled: bool,    // Track if randomness is ready
}

impl GameRound {
    /// Account space calculation for small games MVP with ORAO VRF:
    /// 8 (discriminator) + 8 (round_id) + 1 (status) + 8 (start_timestamp)
    /// + 4 (bets vec len) + (64 * 48) (max bets)
    /// + 8 (initial_pot) + 32 (winner) 
    /// + 32 (vrf_request_pubkey) + 32 (vrf_seed) + 1 (randomness_fulfilled)
    /// = 8 + 8 + 1 + 8 + 4 + 3072 + 8 + 32 + 32 + 32 + 1 = 3206 bytes (~3.1KB)
    pub const LEN: usize = 8 + 8 + GameStatus::LEN + 8 + 4 + (64 * BetEntry::LEN) + 8 + 32 + 32 + 32 + 1;

    /// Check if the game is in a state where bets can be placed
    pub fn can_accept_bets(&self) -> bool {
        matches!(self.status, GameStatus::Idle | GameStatus::Waiting)
    }

    /// Check if the game is a small game (2+ bets) - all games are small games in MVP
    pub fn is_small_game(&self) -> bool {
        self.bets.len() >= 2
    }

    /// Get bet entry by wallet address
    pub fn find_bet(&self, wallet: &Pubkey) -> Option<&BetEntry> {
        self.bets.iter().find(|b| b.wallet == *wallet)
    }

    /// Get mutable bet entry by wallet address
    pub fn find_bet_mut(&mut self, wallet: &Pubkey) -> Option<&mut BetEntry> {
        self.bets.iter_mut().find(|b| b.wallet == *wallet)
    }

    /// Calculate total pot value (just initial pot in small games MVP)
    pub fn total_pot(&self) -> u64 {
        self.initial_pot
    }
}