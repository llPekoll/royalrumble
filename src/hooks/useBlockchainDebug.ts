/**
 * Hook for debugging game state from Convex (single source of truth)
 * Shows Convex's view of the game which orchestrates blockchain
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface BlockchainDebugState {
  // Connection info
  connected: boolean;
  rpcEndpoint: string;
  programId: string;

  // Account states (now from Convex)
  gameConfig: any | null;
  gameCounter: any | null;
  gameRound: any | null;
  vault: { balance: number; address: string } | null;

  // Derived info
  currentRoundId: number;
  gameRoundPDA: string;
  gameExists: boolean;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

export function useBlockchainDebug(): BlockchainDebugState {
  // Query game stats from Convex (single source of truth)
  const gameStats = useQuery(api.frontend.getGameStats);
  const currentGame = useQuery(api.frontend.getCurrentGame);

  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const programId =
    import.meta.env.VITE_GAME_PROGRAM_ID || "EUG7PPKMmzssdsyCrR4XXRcN5xMp1eBLXgF1SAsp28hT";

  // Transform Convex data to match the debug interface
  const isLoading = gameStats === undefined || currentGame === undefined;
  const error = null;

  // Build game round object from Convex data
  // Convert Convex status string to Anchor enum format (e.g., "waiting" -> { waiting: {} })
  const formatStatusForAnchor = (status: string) => {
    const statusMap: Record<string, any> = {
      waiting: { waiting: {} },
      awaitingWinnerRandomness: { awaitingWinnerRandomness: {} },
      finished: { finished: {} },
    };
    return statusMap[status] || { waiting: {} };
  };

  const gameRound = currentGame?.game
    ? {
        roundId: currentGame.game.roundId,
        status: formatStatusForAnchor(currentGame.game.status),
        startTimestamp: currentGame.game.startTimestamp
          ? currentGame.game.startTimestamp / 1000
          : 0,
        endTimestamp: currentGame.game.endTimestamp ? currentGame.game.endTimestamp / 1000 : 0,
        betCount: currentGame.participantCount,
        totalPot: currentGame.game.totalPot,
        betAmounts: currentGame.participants.map((p) => p.amount * 1e9), // Convert SOL to lamports
        winner: currentGame.game.winner || "Not determined",
        vrfRequestPubkey: currentGame.game.vrfRequestPubkey || "N/A",
        randomnessFulfilled: currentGame.game.randomnessFulfilled || false,
      }
    : null;

  // Mock game config (from environment or defaults)
  const gameConfig = {
    authority: "Backend Wallet",
    treasury: "Treasury Wallet",
    minBetLamports: 10_000_000, // 0.01 SOL
    houseFeeBasisPoints: 500, // 5%
    betsLocked: currentGame?.game.status !== "waiting",
    smallGameDurationConfig: {
      waitingPhaseDuration: 30,
    },
  };

  return {
    connected: true,
    rpcEndpoint: rpcUrl,
    programId,
    gameConfig,
    gameCounter: { currentRoundId: gameStats?.currentRound || 0 },
    gameRound,
    vault: { balance: 0, address: "Vault PDA" }, // Vault balance not tracked in Convex yet
    currentRoundId: gameStats?.currentRound || 0,
    gameRoundPDA: "Convex-managed",
    gameExists: currentGame !== null,
    isLoading,
    error,
    refresh: async () => {
      // Convex queries auto-refresh, so this is a no-op
      console.log("Convex queries auto-refresh every few seconds");
    },
  };
}
