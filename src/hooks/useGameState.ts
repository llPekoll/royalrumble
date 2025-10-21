import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface BetEntry {
  walletAddress: string;
  amount: string;
  placedAt: number;
  status: "pending" | "won" | "lost" | "refunded";
}

export interface GameState {
  roundId: number;
  status: "Idle" | "Waiting" | "AwaitingWinnerRandomness" | "Finished";
  startTimestamp: number | null;
  endTimestamp: number | null;
  bets: BetEntry[];
  totalPot: string;
  winner: string | null;
  vrfRequestId: string | null;
  randomnessFulfilled: boolean | null;
  playersCount: number;
}

export interface GameConfig {
  authority: string;
  treasury: string;
  houseFeeBasisPoints: number;
  minBet: string;
  gameDurationConfig: {
    waitingPhaseDuration: number;
  };
}

export function useGameState() {
  const gameStateData = useQuery(api.evm["evm-game-manager-db"].getGameState);

  if (!gameStateData) {
    return {
      gameState: null,
      gameConfig: null,
      loading: true,
      error: null,
      refresh: () => {} // Convex handles refreshing automatically
    };
  }

  const { game, bets } = gameStateData;

  // Transform Convex data to match the expected interface
  const gameState: GameState = {
    roundId: game.roundId,
    status: game.status as GameState["status"],
    startTimestamp: game.startTimestamp,
    endTimestamp: game.endTimestamp,
    bets: bets.map((bet: any) => ({
      walletAddress: bet.walletAddress,
      amount: bet.amount,
      placedAt: bet.placedAt,
      status: bet.status,
    })),
    totalPot: game.totalPot,
    winner: game.winner,
    vrfRequestId: game.vrfRequestId,
    randomnessFulfilled: game.randomnessFulfilled,
    playersCount: game.playersCount,
  };

  // For now, return static game config (could be fetched separately if needed)
  const gameConfig: GameConfig = {
    authority: "0x0000000000000000000000000000000000000000", // Placeholder
    treasury: "0x0000000000000000000000000000000000000000", // Placeholder
    houseFeeBasisPoints: 500, // 5%
    minBet: "10000000000000000", // 0.01 ETH in wei
    gameDurationConfig: {
      waitingPhaseDuration: 300, // 5 minutes
    },
  };

  return {
    gameState,
    gameConfig,
    loading: false,
    error: null,
    refresh: () => {} // Convex handles refreshing automatically
  };
}
