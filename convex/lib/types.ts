// Solana and Anchor types for the Domin8 program
import { PublicKey } from "@solana/web3.js";

// Program ID
export const DOMIN8_PROGRAM_ID = new PublicKey("CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK");

// Game Status enum from the Solana program (simplified for small games MVP)
export enum GameStatus {
  Idle = "idle",
  Waiting = "waiting", 
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
  // ORAO VRF configuration
  vrfFeeLamports: number;
  vrfNetworkState: PublicKey;
  vrfTreasury: PublicKey;
}

// Game duration configuration (simplified for small games MVP)
export interface GameDurationConfig {
  waitingPhaseDuration: number;
  // Only one duration field in the small games MVP - no elimination or spectator phases
}

// Player entry in the game
export interface PlayerEntry {
  wallet: PublicKey;
  totalBet: number;
  timestamp: number;
}


// Game round state (simplified for small games MVP)
export interface GameRound {
  roundId: number;
  status: GameStatus;
  startTimestamp: number;
  players: PlayerEntry[];
  initialPot: number;
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
  PROGRESS_TO_RESOLUTION: "progressToResolution",
  RESOLVE_WINNER: "resolveWinner",
  DISTRIBUTE_WINNINGS_AND_RESET: "distributeWinningsAndReset",
  CLAIM_WINNINGS: "claimWinnings",
} as const;