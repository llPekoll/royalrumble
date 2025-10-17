// Solana and Anchor types for the Domin8 program
"use node";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

// Program ID
export const DOMIN8_PROGRAM_ID = new PublicKey("AgmSbCQZ98aYtqntEk8w7aLedYxfvQurNU4pLtKbtpk4");

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
  // ORAO VRF configuration
  vrfFeeLamports: number;
  vrfNetworkState: string; // PublicKey as base58 string
  vrfTreasury: string; // PublicKey as base58 string
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
  initialPot: number;
  entryPool: number; // Alias for initialPot (used by gameManager)
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

// Transaction types for logging (simplified for small games MVP)
export const TRANSACTION_TYPES = {
  PROGRESS_TO_RESOLUTION: "progress_to_resolution",
  RESOLVE_WINNER: "resolve_winner",
  DISTRIBUTE_WINNINGS: "distribute_winnings_and_reset",
  CLAIM_WINNINGS: "claim_winnings",

  // ORAO VRF unified transaction types
  UNIFIED_PROGRESS_TO_RESOLUTION: "unified_progress_to_resolution",
  UNIFIED_RESOLVE_AND_DISTRIBUTE: "unified_resolve_and_distribute",
} as const;

// Instruction names (simplified for small games MVP)
export const INSTRUCTION_NAMES = {
  INITIALIZE: "initialize",
  CREATE_GAME: "create_game",
  PLACE_BET: "place_bet",
  UNIFIED_PROGRESS_TO_RESOLUTION: "unified_progress_to_resolution",
  UNIFIED_RESOLVE_AND_DISTRIBUTE: "unified_resolve_and_distribute",
} as const;
