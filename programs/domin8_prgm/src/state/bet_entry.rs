use anchor_lang::prelude::*;

/// Individual bet entry in a game round
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BetEntry {
    pub wallet: Pubkey,
    pub bet_amount: u64,
    pub timestamp: i64,
}

impl BetEntry {
    /// Bet entry size: 32 (wallet) + 8 (bet_amount) + 8 (timestamp) = 48 bytes
    pub const LEN: usize = 32 + 8 + 8;
}