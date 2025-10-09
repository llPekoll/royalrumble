use anchor_lang::prelude::*;
use crate::state::PlayerEntry;
// Removed SpectatorBet import for small games MVP

/// Game status enumeration
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum GameStatus {
    Idle,                        // Waiting for first player
    Waiting,                     // Accepting bets
    // Removed for small games MVP:
    // AwaitingFinalistRandomness,  // Waiting for Switchboard VRF for finalist selection
    // SpectatorBetting,           // Eliminated players betting on finalists
    AwaitingWinnerRandomness,   // Waiting for Switchboard VRF for winner selection
    Finished,                   // Game complete, ready for payout/reset
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
    
    // Players (max 64)
    pub players: Vec<PlayerEntry>,
    
    // Removed for small games MVP:
    // Large game specific data
    // pub finalists: Vec<Pubkey>,                    // Max 4 finalists
    // pub spectator_bets: Vec<SpectatorBet>,
    
    // Pot tracking
    pub initial_pot: u64,
    // pub spectator_pot: u64,  // Removed for small games MVP
    
    // Winner
    pub winner: Pubkey,
    
    // Switchboard VRF accounts
    // pub finalist_randomness_account: Pubkey,  // Removed for small games MVP
    pub winner_randomness_account: Pubkey,
    pub randomness_commit_slot: u64,
}

impl GameRound {
    /// Account space calculation for small games MVP:
    /// 8 (discriminator) + 8 (round_id) + 1 (status) + 8 (start_timestamp)
    /// + 4 (players vec len) + (64 * 48) (max players)
    /// + 8 (initial_pot) + 32 (winner) 
    /// + 32 (winner_randomness) + 8 (commit_slot)
    /// = 8 + 8 + 1 + 8 + 4 + 3072 + 8 + 32 + 32 + 8 = 3181 bytes (~3.1KB)
    pub const LEN: usize = 8 + 8 + GameStatus::LEN + 8 + 4 + (64 * PlayerEntry::LEN) + 8 + 32 + 32 + 8;

    /// Check if the game is in a state where players can join
    pub fn can_accept_players(&self) -> bool {
        matches!(self.status, GameStatus::Idle | GameStatus::Waiting)
    }

    /// Check if the game is a small game (2+ players) - all games are small games in MVP
    pub fn is_small_game(&self) -> bool {
        self.players.len() >= 2
    }

    // Removed for small games MVP:
    // /// Check if the game is a large game (8-64 players)
    // pub fn is_large_game(&self) -> bool {
    //     self.players.len() >= 8
    // }

    /// Get player by wallet address
    pub fn find_player(&self, wallet: &Pubkey) -> Option<&PlayerEntry> {
        self.players.iter().find(|p| p.wallet == *wallet)
    }

    /// Get mutable player by wallet address
    pub fn find_player_mut(&mut self, wallet: &Pubkey) -> Option<&mut PlayerEntry> {
        self.players.iter_mut().find(|p| p.wallet == *wallet)
    }

    // Removed for small games MVP:
    // /// Check if a wallet is a finalist
    // pub fn is_finalist(&self, wallet: &Pubkey) -> bool {
    //     self.finalists.contains(wallet)
    // }

    /// Calculate total pot value (just initial pot in small games MVP)
    pub fn total_pot(&self) -> u64 {
        self.initial_pot
    }
}