use anchor_lang::prelude::*;

/// Configuration for game durations
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GameDurationConfig {
    pub waiting_phase_duration: u64,
    pub elimination_phase_duration: u64,
    pub spectator_betting_duration: u64,
    pub resolving_phase_duration: u64,
}

impl GameDurationConfig {
    pub const LEN: usize = 8 + 8 + 8 + 8; // 32 bytes
}

/// Global game configuration stored as singleton PDA
/// Seeds: [b"game_config"]
#[account]
pub struct GameConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub house_fee_basis_points: u16,     // 500 = 5%
    pub min_bet_lamports: u64,           // 10,000,000 = 0.01 SOL
    pub small_game_duration_config: GameDurationConfig,
    pub large_game_duration_config: GameDurationConfig,
}

impl GameConfig {
    /// Account space calculation:
    /// 8 (discriminator) + 32 (authority) + 32 (treasury) + 2 (house_fee) + 8 (min_bet) 
    /// + 32 (small_game_config) + 32 (large_game_config) = 146 bytes
    pub const LEN: usize = 8 + 32 + 32 + 2 + 8 + GameDurationConfig::LEN + GameDurationConfig::LEN;

    /// Calculate house fee from pot amount
    pub fn calculate_house_fee(&self, pot_amount: u64) -> u64 {
        pot_amount
            .saturating_mul(self.house_fee_basis_points as u64)
            .saturating_div(10_000)
    }

    /// Calculate winner payout after house fee
    pub fn calculate_winner_payout(&self, pot_amount: u64) -> u64 {
        pot_amount.saturating_sub(self.calculate_house_fee(pot_amount))
    }

    /// Validate if a bet amount meets minimum requirements
    pub fn is_valid_bet_amount(&self, amount: u64) -> bool {
        amount >= self.min_bet_lamports
    }
}