use anchor_lang::prelude::*;

/// Individual winnings claim entry
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct WinningsEntry {
    pub wallet: Pubkey,
    pub amount: u64,
    pub claimed: bool,
}

impl WinningsEntry {
    pub const LEN: usize = 32 + 8 + 1; // 41 bytes
}

/// Winnings claim tracking account - one per game round
/// Seeds: [b"winnings", round_id.to_le_bytes()]
#[account]
pub struct WinningsClaim {
    pub round_id: u64,
    pub house_fee_collected: bool,
    pub game_reset: bool,
    
    // Track all winnings for this round
    pub winner_winnings: Vec<WinningsEntry>,     // Usually 1 entry for main winner
    pub spectator_winnings: Vec<WinningsEntry>,  // For large games
    
    // Total amounts for verification
    pub total_winner_amount: u64,
    pub total_spectator_amount: u64,
    pub house_fee_amount: u64,
}

impl WinningsClaim {
    /// Account space calculation:
    /// 8 (discriminator) + 8 (round_id) + 1 (house_fee_collected) + 1 (game_reset)
    /// + 4 (winner_winnings vec len) + (10 * 41) (max 10 winner entries for safety)
    /// + 4 (spectator_winnings vec len) + (50 * 41) (max 50 spectator entries)
    /// + 8 (total_winner_amount) + 8 (total_spectator_amount) + 8 (house_fee_amount)
    /// = 8 + 8 + 1 + 1 + 4 + 410 + 4 + 2050 + 8 + 8 + 8 = 2510 bytes (~2.5KB)
    pub const LEN: usize = 8 + 8 + 1 + 1 + 4 + (10 * WinningsEntry::LEN) + 4 + (50 * WinningsEntry::LEN) + 8 + 8 + 8;

    /// Find winnings entry for a wallet
    pub fn find_winner_entry(&self, wallet: &Pubkey) -> Option<&WinningsEntry> {
        self.winner_winnings.iter().find(|entry| entry.wallet == *wallet)
    }

    /// Find spectator winnings entry for a wallet
    pub fn find_spectator_entry(&self, wallet: &Pubkey) -> Option<&WinningsEntry> {
        self.spectator_winnings.iter().find(|entry| entry.wallet == *wallet)
    }

    /// Find mutable winnings entry for a wallet
    pub fn find_winner_entry_mut(&mut self, wallet: &Pubkey) -> Option<&mut WinningsEntry> {
        self.winner_winnings.iter_mut().find(|entry| entry.wallet == *wallet)
    }

    /// Find mutable spectator winnings entry for a wallet
    pub fn find_spectator_entry_mut(&mut self, wallet: &Pubkey) -> Option<&mut WinningsEntry> {
        self.spectator_winnings.iter_mut().find(|entry| entry.wallet == *wallet)
    }

    /// Check if all winnings have been claimed
    pub fn all_winnings_claimed(&self) -> bool {
        self.winner_winnings.iter().all(|entry| entry.claimed) &&
        self.spectator_winnings.iter().all(|entry| entry.claimed)
    }

    /// Calculate total unclaimed winner winnings
    pub fn unclaimed_winner_amount(&self) -> u64 {
        self.winner_winnings.iter()
            .filter(|entry| !entry.claimed)
            .map(|entry| entry.amount)
            .sum()
    }

    /// Calculate total unclaimed spectator winnings
    pub fn unclaimed_spectator_amount(&self) -> u64 {
        self.spectator_winnings.iter()
            .filter(|entry| !entry.claimed)
            .map(|entry| entry.amount)
            .sum()
    }
}