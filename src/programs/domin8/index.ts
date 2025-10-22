/**
 * Domin8 Program Frontend Integration
 *
 * This module provides type-safe access to the Domin8 Solana program
 * from the frontend. It includes the IDL and TypeScript types.
 *
 * Usage:
 * ```typescript
 * import { Domin8PrgmIDL, Domin8Prgm, DOMIN8_PROGRAM_ID } from '@/programs/domin8';
 * import { Program, AnchorProvider } from '@coral-xyz/anchor';
 *
 * const program = new Program<Domin8Prgm>(Domin8PrgmIDL, provider);
 * await program.methods.placeBet(new BN(amount)).accounts({...}).rpc();
 * ```
 */

import { PublicKey } from '@solana/web3.js';
import type { Domin8Prgm } from './domin8_prgm';
import Domin8PrgmIDL from './domin8_prgm.json';

// Export the IDL (for creating Program instances)
export { Domin8PrgmIDL };

// Export the TypeScript type (for type safety)
export type { Domin8Prgm };

// Export the Program ID from the IDL
export const DOMIN8_PROGRAM_ID = new PublicKey(Domin8PrgmIDL.address);

// Re-export useful types from the generated types file
export type {
  GameConfig,
  GameCounter,
  GameRound,
  BetEntry,
  GameStatus,
  GameDurationConfig,
} from './domin8_prgm';
