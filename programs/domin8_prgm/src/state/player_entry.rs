use anchor_lang::prelude::*;

/// Individual player entry in a game round
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlayerEntry {
    pub wallet: Pubkey,
    pub total_bet: u64,
    pub timestamp: i64,
}

impl PlayerEntry {
    /// Player entry size: 32 (wallet) + 8 (total_bet) + 8 (timestamp) = 48 bytes
    pub const LEN: usize = 32 + 8 + 8;
}

// Removed for small games MVP:
// /// Spectator bet on a finalist (for large games only)
// #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
// pub struct SpectatorBet {
//     pub bettor: Pubkey,
//     pub target_finalist: Pubkey,
//     pub amount: u64,
// }
// 
// impl SpectatorBet {
//     /// Spectator bet size: 32 (bettor) + 32 (target_finalist) + 8 (amount) = 72 bytes
//     pub const LEN: usize = 32 + 32 + 8;
// }