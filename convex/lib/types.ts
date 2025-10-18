// Solana and Anchor types for the Domin8 program
"use node";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

// Program ID
export const DOMIN8_PROGRAM_ID = new PublicKey("9Did6kAH9Mkteyi4xCrrq5x8bjBPQ1o9zZEoGC2hSYnk");

// Game Status enum from the Solana program (simplified for small games MVP)
export enum GameStatus {
  Idle = "idle",
  Waiting = "waiting",
  AwaitingWinnerRandomness = "awaitingWinnerRandomness",
  Finished = "finished",
}

// Game configuration structure (simplified for small games MVP)
// Note: PublicKeys are serialized as strings for Convex compatibility
export interface GameConfig {
  authority: string; // PublicKey as base58 string
  treasury: string; // PublicKey as base58 string
  houseFeeBasisPoints: number;
  minBetLamports: number;
  smallGameDurationConfig: GameDurationConfig;
  betsLocked: boolean; // Whether new bets are currently locked
}

// Game duration configuration (simplified for small games MVP)
export interface GameDurationConfig {
  waitingPhaseDuration: number;
  // Only one duration field in the small games MVP - no elimination or spectator phases
}

// Bet entry in the game (renamed from PlayerEntry)
// Note: PublicKeys are serialized as strings for Convex compatibility
export interface BetEntry {
  wallet: string; // PublicKey as base58 string
  betAmount: number;
  timestamp: number;
}

// Game round state (simplified for small games MVP)
// Note: PublicKeys are serialized as strings for Convex compatibility
export interface GameRound {
  roundId: number;
  status: GameStatus;
  startTimestamp: number;
  endTimestamp: number; // When betting window closes
  bets: BetEntry[];
  totalPot: number; // Total accumulated pot from all bets
  winner: string | null; // PublicKey as base58 string, or null if no winner yet
  // ORAO VRF integration
  vrfRequestPubkey: string | null; // PublicKey as base58 string, or null if not requested
  vrfSeed: number[];
  randomnessFulfilled: boolean;
}

// PDA seeds
export const PDA_SEEDS = {
  GAME_CONFIG: Buffer.from("game_config"),
  GAME_COUNTER: Buffer.from("game_counter"),
  GAME_ROUND: Buffer.from("game_round"),
  VAULT: Buffer.from("vault"),
} as const;

// Transaction types for logging
export const TRANSACTION_TYPES = {
  CLOSE_BETTING_WINDOW: "close_betting_window",
  SELECT_WINNER_AND_PAYOUT: "select_winner_and_payout",
  CLEANUP_OLD_GAME: "cleanup_old_game",
} as const;

// Instruction names
export const INSTRUCTION_NAMES = {
  INITIALIZE: "initialize",
  CREATE_GAME: "create_game",
  PLACE_BET: "place_bet",
  CLOSE_BETTING_WINDOW: "close_betting_window",
  SELECT_WINNER_AND_PAYOUT: "select_winner_and_payout",
  CLEANUP_OLD_GAME: "cleanup_old_game",
} as const;
