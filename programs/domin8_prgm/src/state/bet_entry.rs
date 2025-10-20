use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BetEntry {
    pub wallet: Pubkey,
    pub bet_amount: u64,
    pub timestamp: i64,
}

impl BetEntry {
    pub const LEN: usize = 32 + 8 + 8;
}
