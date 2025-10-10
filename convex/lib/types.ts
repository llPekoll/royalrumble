// Solana and Anchor types for the Domin8 program
import { PublicKey } from "@solana/web3.js";

// Program ID
export const DOMIN8_PROGRAM_ID = new PublicKey("CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK");

// Game Status enum from the Solana program (simplified for small games MVP)
export enum GameStatus {
  Idle = "idle",
  Waiting = "waiting", 
  // AwaitingFinalistRandomness - removed for small games MVP
  // SpectatorBetting - removed for small games MVP
  AwaitingWinnerRandomness = "awaitingWinnerRandomness",
  Finished = "finished"
}

// Game configuration structure (simplified for small games MVP)
export interface GameConfig {
  authority: PublicKey;
  treasury: PublicKey;
  houseFeeBasisPoints: number;
  minBetLamports: number;
  smallGameDurationConfig: GameDurationConfig;
  // largeGameDurationConfig - removed for small games MVP
}

// Game duration configuration (simplified for small games MVP)
export interface GameDurationConfig {
  waitingPhaseDuration: number;
  // eliminationPhaseDuration - not used in small games MVP
  // spectatorBettingDuration - removed for small games MVP
  resolvingPhaseDuration: number;
}

// Player entry in the game
export interface PlayerEntry {
  wallet: PublicKey;
  totalBet: number;
  timestamp: number;
}

// SpectatorBet interface - commented out for small games MVP
// export interface SpectatorBet {
//   bettor: PublicKey;
//   targetFinalist: PublicKey;
//   amount: number;
// }

// Game round state (simplified for small games MVP)
export interface GameRound {
  roundId: number;
  status: GameStatus;
  startTimestamp: number;
  players: PlayerEntry[];
  // finalists - removed for small games MVP
  // spectatorBets - removed for small games MVP
  initialPot: number;
  // spectatorPot - removed for small games MVP
  winner: PublicKey;
  // ORAO VRF integration
  vrfRequestPubkey: PublicKey;
  vrfSeed: number[];
  randomnessFulfilled: boolean;
}

// PDA seeds
export const PDA_SEEDS = {
  GAME_CONFIG: Buffer.from("game_config"),
  GAME_ROUND: Buffer.from("game_round"),
  VAULT: Buffer.from("vault"),
} as const;

// Transaction types for logging (simplified for small games MVP)
export const TRANSACTION_TYPES = {
  PROGRESS_TO_RESOLUTION: "progress_to_resolution",
  // RESOLVE_FINALISTS - removed for small games MVP
  // PROGRESS_TO_FINAL_BATTLE - removed for small games MVP
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
  DEPOSIT_BET: "deposit_bet",
  // PLACE_SPECTATOR_BET - removed for small games MVP
  PROGRESS_TO_RESOLUTION: "progressToResolution",
  // PROGRESS_TO_FINAL_BATTLE - removed for small games MVP
  // RESOLVE_FINALISTS - removed for small games MVP
  RESOLVE_WINNER: "resolveWinner",
  DISTRIBUTE_WINNINGS_AND_RESET: "distributeWinningsAndReset",
  CLAIM_WINNINGS: "claimWinnings",
} as const;