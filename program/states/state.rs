use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum GameStatus {
    EntryPhase = 0,
    SelectingTopFour = 1,
    SpectatorPhase = 2,
    SelectingWinner = 3,
    Settled = 4,
    Cancelled = 5,
}

impl Default for GameStatus {
    fn default() -> Self {
        GameStatus::EntryPhase
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum GameMode {
    Unknown = 0,
    Short = 1,
    Long = 2,
}

impl Default for GameMode {
    fn default() -> Self {
        GameMode::Unknown
    }
}

#[account(zero_copy)]
#[repr(C)]
pub struct Game {
    pub game_id: u64,
    pub status: GameStatus,
    pub game_mode: GameMode,

    // Pools
    pub entry_pool: u64,
    pub spectator_pool: u64,

    // Entry phase arrays (max 64 bets)
    pub entry_bets: [u64; 64],
    pub entry_players: [Pubkey; 64],
    pub entry_bet_count: u8,

    // Spectator phase arrays (max 64 bets)
    pub spectator_bets: [u64; 64],
    pub spectator_players: [Pubkey; 64],
    pub spectator_targets: [i8; 64],
    pub spectator_bet_count: u8,

    // Winners
    pub top_four: [i8; 4],
    pub winner: i8,

    // Timing
    pub entry_phase_start: i64,
    pub entry_phase_duration: i64,
    pub spectator_phase_start: i64,
    pub spectator_phase_duration: i64,

    // Flags
    pub house_collected: bool,
    pub entry_winnings_claimed: bool,

    // Refund tracking
    pub entry_refunded: [bool; 64],
    pub spectator_refunded: [bool; 64],

    // Other
    pub last_game_end: i64,
    pub vrf_seed_top_four: Option<Pubkey>,
    pub vrf_seed_winner: Option<Pubkey>,
    pub house_wallet: Pubkey,
    pub bump: u8,
}

impl Default for Game {
    fn default() -> Self {
        Self {
            game_id: 0,
            status: GameStatus::EntryPhase,
            game_mode: GameMode::Unknown,
            entry_pool: 0,
            spectator_pool: 0,
            entry_bets: [0; 64],
            entry_players: [Pubkey::default(); 64],
            entry_bet_count: 0,
            spectator_bets: [0; 64],
            spectator_players: [Pubkey::default(); 64],
            spectator_targets: [-1; 64],
            spectator_bet_count: 0,
            top_four: [-1; 4],
            winner: -1,
            entry_phase_start: 0,
            entry_phase_duration: 0,
            spectator_phase_start: 0,
            spectator_phase_duration: 0,
            house_collected: false,
            entry_winnings_claimed: false,
            entry_refunded: [false; 64],
            spectator_refunded: [false; 64],
            last_game_end: 0,
            vrf_seed_top_four: None,
            vrf_seed_winner: None,
            house_wallet: Pubkey::default(),
            bump: 0,
        }
    }
}

pub const MIN_BET: u64 = 10_000_000; // 0.01 SOL
pub const TIME_LOCK_SECONDS: i64 = 5;
pub const EMERGENCY_TIMEOUT_HOURS: i64 = 24;