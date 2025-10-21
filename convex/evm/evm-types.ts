"use node";

/**
 * @notice Enum representing the possible statuses of a game round, matching the Solidity contract.
 */
export enum GameStatus {
  Idle,
  Waiting,
  AwaitingWinnerRandomness,
  Finished,
}

/**
 * @notice Represents the configuration for game durations, matching the Solidity contract.
 */
export interface GameDurationConfig {
  waitingPhaseDuration: number;
}

/**
 * @notice Represents the core game configuration, matching the Solidity contract.
 * @dev Wallet addresses are strings in the standard '0x...' format.
 */
export interface GameConfig {
  authority: string;
  treasury: string;
  houseFeeBasisPoints: number;
  minBet: string; // Using string to handle large numbers (uint256)
  gameDurationConfig: GameDurationConfig;
}

/**
 * @notice Represents an individual bet entry, matching the Solidity contract.
 */
export interface BetEntry {
  roundId: number;
  betIndex: number;
  wallet: string;
  betAmount: number;
  timestamp: number;
}

/**
 * @notice Represents the state of a game round, matching the Solidity contract.
 */
export interface GameRound {
  roundId: number;
  status: GameStatus;
  startTimestamp: number;
  endTimestamp: number;
  betCount: number;
  totalPot: string; // Using string to handle large numbers (uint256)
  winner: BetEntry | null;
  randomnessFulfilled: boolean;
  vrfRequestId: string; // bytes32 from Solidity is a hex string
}

/**
 * @notice Constants for transaction types used in logging within the Convex backend.
 */
export const TRANSACTION_TYPES = {
  CLOSE_BETTING_WINDOW: "close_betting_window",
  SELECT_WINNER_AND_PAYOUT: "select_winner_and_payout",
} as const;
