/**
 * Game Phase Calculator
 *
 * Time-based phase calculation system - no polling needed!
 * Both frontend and backend use the same logic to determine game phases.
 *
 * Phases are calculated from timestamps, making them deterministic and efficient.
 */

// Game phase durations (in seconds)
export const PHASE_DURATIONS = {
  WAITING: 30, // Betting window open
  FIGHTING: 10, // VRF requested, animations playing
  RESULTS: 5, // Winner announced, celebration
} as const;

// Total game duration
export const TOTAL_GAME_DURATION =
  PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING + PHASE_DURATIONS.RESULTS;

// Game phases - now matching blockchain states exactly!
// This eliminates confusion and sync issues between frontend and blockchain
export type GamePhase = "waiting" | "awaitingWinnerRandomness" | "finished";

// Blockchain status mapping (same as GamePhase now)
export type BlockchainGameStatus = GamePhase;

/**
 * Calculate current game phase - now simplified to match blockchain exactly!
 * No more complex timestamp calculations that can drift out of sync.
 * The blockchain is the single source of truth.
 */
export function calculateGamePhase(
  blockchainStatus: BlockchainGameStatus,
  _startTimestamp?: number, // Kept for backwards compatibility but not used
  _currentTime?: number // Kept for backwards compatibility but not used
): GamePhase {
  // Simply return the blockchain status - it's already the correct phase!
  return blockchainStatus;
}

/**
 * Get the timestamp when a specific phase starts
 * Note: With blockchain-driven phases, this is less relevant
 * but kept for countdown timers in the waiting phase
 */
export function getPhaseStartTime(phase: GamePhase, gameStartTimestamp: number): number {
  switch (phase) {
    case "waiting":
      return gameStartTimestamp;

    case "awaitingWinnerRandomness":
      return gameStartTimestamp + PHASE_DURATIONS.WAITING;

    case "finished":
      // Finished time is determined by blockchain, not predictable
      return gameStartTimestamp + TOTAL_GAME_DURATION;

    default:
      return gameStartTimestamp;
  }
}

/**
 * Get time remaining in current phase (in seconds)
 * Only really useful for the waiting phase - other phases are blockchain-driven
 */
export function getPhaseTimeRemaining(
  currentPhase: GamePhase,
  startTimestamp: number,
  currentTime: number = Date.now() / 1000
): number {
  const elapsed = currentTime - startTimestamp;

  switch (currentPhase) {
    case "waiting":
      // Show countdown during waiting phase
      return Math.max(0, PHASE_DURATIONS.WAITING - elapsed);

    case "awaitingWinnerRandomness":
      // VRF timing is unpredictable, typically 3-8 seconds
      return 0;

    case "finished":
      // Game is over
      return 0;

    default:
      return 0;
  }
}

/**
 * Check if it's time to execute a specific action
 */
export function shouldExecuteAction(
  action: "CLOSE_BETTING" | "SELECT_WINNER" | "CREATE_NEXT_GAME",
  gameStartTimestamp: number,
  currentTime: number = Date.now() / 1000
): boolean {
  const elapsed = currentTime - gameStartTimestamp;

  switch (action) {
    case "CLOSE_BETTING":
      // Execute when waiting phase ends
      return elapsed >= PHASE_DURATIONS.WAITING;

    case "SELECT_WINNER":
      // Execute when fighting phase ends (give VRF 10s to respond)
      return elapsed >= PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING;

    case "CREATE_NEXT_GAME":
      // Execute when game fully ends
      return elapsed >= TOTAL_GAME_DURATION;

    default:
      return false;
  }
}

/**
 * Get user-friendly phase description
 */
export function getPhaseDescription(phase: GamePhase): string {
  switch (phase) {
    case "waiting":
      return "Betting open! Place your bets!";
    case "awaitingWinnerRandomness":
      return "Battle in progress! Determining winner...";
    case "finished":
      return "Game finished! Place bet to start new round!";
    default:
      return "Unknown phase";
  }
}
