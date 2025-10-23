/**
 * Frontend hook for determining current game phase
 * Uses time-based calculation from timestamps (no polling needed!)
 */

import { useMemo, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  calculateGamePhase,
  getPhaseTimeRemaining,
  getPhaseDescription,
  type GamePhase,
} from "../../convex/lib/gamePhases";

export interface GamePhaseState {
  phase: GamePhase;
  timeRemaining: number;
  description: string;
  gameState: any;
  isDemo: boolean;
}

/**
 * Hook to get current game phase from timestamps
 * Updates automatically every second for smooth countdown
 */
export function useGamePhase(): GamePhaseState {
  const gameState = useQuery(api.gameManagerDb.getGameState);
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000);

  // Update current time every second for smooth countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isDemo = useMemo(() => {
    return !gameState || !gameState.game || gameState.game.status === "finished";
  }, [gameState]);

  const currentPhase = useMemo(() => {
    if (isDemo) return "finished";

    const game = gameState.game;
    if (!game.startTimestamp || !game.endTimestamp) return "finished";

    return calculateGamePhase(
      game.status,
      game.startTimestamp / 1000, // Convert ms to seconds
      game.endTimestamp / 1000,
      game.winner,
      currentTime
    );
  }, [gameState, isDemo, currentTime]);

  const timeRemaining = useMemo(() => {
    if (isDemo || !gameState?.game?.startTimestamp) return 0;

    return getPhaseTimeRemaining(currentPhase, gameState.game.startTimestamp / 1000, currentTime);
  }, [currentPhase, gameState, isDemo, currentTime]);

  return {
    phase: currentPhase,
    timeRemaining: Math.max(0, Math.floor(timeRemaining)), // Floor to whole seconds
    description: getPhaseDescription(currentPhase),
    gameState,
    isDemo,
  };
}
