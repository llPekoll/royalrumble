use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Betting is closed")]
    BettingClosed,
    #[msg("Bet too small (min 0.01 SOL)")]
    BetTooSmall,
    #[msg("Game is full (max 64 players)")]
    GameFull,
    #[msg("Invalid game status")]
    InvalidGameStatus,
    #[msg("Not enough players (min 2)")]
    NotEnoughPlayers,
    #[msg("VRF not fulfilled yet")]
    VrfNotFulfilled,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Invalid VRF account")]
    InvalidVrfAccount,
    #[msg("Unauthorized - caller is not authority")]
    Unauthorized,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid winner - not in top four")]
    InvalidWinner,
    #[msg("Game already settled")]
    GameAlreadySettled,
    #[msg("Bet amount cannot be zero")]
    BetAmountZero,
    #[msg("Player already placed bet")]
    PlayerAlreadyBet,
    #[msg("VRF request failed")]
    VrfRequestFailed,
    #[msg("Game vault mismatch")]
    GameVaultMismatch,
}
