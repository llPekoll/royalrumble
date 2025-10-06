use anchor_lang::prelude::*;

#[error_code]
pub enum GameError {
    #[msg("Bet amount is too small")]
    BetTooSmall,
    #[msg("Game is not in entry phase")]
    NotInEntryPhase,
    #[msg("Entry bets are full")]
    EntryBetsFull,
    #[msg("Game is not in spectator phase")]
    NotInSpectatorPhase,
    #[msg("Spectator bets are full")]
    SpectatorBetsFull,
    #[msg("Invalid target index")]
    InvalidTarget,
    #[msg("Player is in top four and cannot place spectator bet")]
    PlayerInTopFour,
    #[msg("Game is not in selecting top four phase")]
    NotInSelectingTopFour,
    #[msg("Invalid top four positions")]
    InvalidTopFourPositions,
    #[msg("Game is not in selecting winner phase")]
    NotInSelectingWinner,
    #[msg("Invalid winner position")]
    InvalidWinnerPosition,
    #[msg("Winner must be in top four for long games")]
    WinnerNotInTopFour,
    #[msg("Game is not settled")]
    GameNotSettled,
    #[msg("Not the winner")]
    NotWinner,
    #[msg("Entry winnings already claimed")]
    EntryWinningsAlreadyClaimed,
    #[msg("Game mode is not long")]
    GameModeNotLong,
    #[msg("No spectator winnings to claim")]
    NoSpectatorWinnings,
    #[msg("House fees already collected")]
    HouseFeesAlreadyCollected,
    #[msg("Game is not cancelled")]
    GameNotCancelled,
    #[msg("Player has no bets to refund")]
    NoBetsToRefund,
    #[msg("Emergency timeout not reached")]
    EmergencyTimeoutNotReached,
    #[msg("Insufficient funds in game account")]
    InsufficientFunds,
    #[msg("Time lock not met")]
    TimeLockNotMet,
    #[msg("Unauthorized backend")]
    UnauthorizedBackend,
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Already refunded")]
    AlreadyRefunded,
}