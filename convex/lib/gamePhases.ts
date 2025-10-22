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
  WAITING: 30,        // Betting window open
  FIGHTING: 10,       // VRF requested, animations playing
  RESULTS: 5,         // Winner announced, celebration
} as const;

// Total game duration
export const TOTAL_GAME_DURATION =
  PHASE_DURATIONS.WAITING +
  PHASE_DURATIONS.FIGHTING +
  PHASE_DURATIONS.RESULTS;

// Game phases enum
export type GamePhase =
  | 'IDLE'              // No active game
  | 'WAITING'           // Betting window open (0-30s)
  | 'BETTING_CLOSED'    // Transitioning to fighting
  | 'FIGHTING'          // Characters fighting, waiting for VRF (30-40s)
  | 'VRF_DELAYED'       // VRF taking longer than expected
  | 'RESULTS'           // Winner announced (40-45s)
  | 'FINISHED'          // Game complete, ready for next round
  | 'ERROR';            // Something went wrong

// Blockchain status mapping
export type BlockchainGameStatus =
  | 'idle'
  | 'waiting'
  | 'awaitingWinnerRandomness'
  | 'finished';

/**
 * Calculate current game phase from timestamps
 * Pure function - can be called from anywhere (frontend/backend)
 */
export function calculateGamePhase(
  blockchainStatus: BlockchainGameStatus,
  startTimestamp: number,  // Unix timestamp (seconds)
  endTimestamp: number,    // Unix timestamp (seconds)
  winner?: string | null,  // Winner public key (or null/default)
  currentTime: number = Date.now() / 1000  // Unix timestamp (seconds)
): GamePhase {
  // Handle null/undefined winner (default Solana pubkey means no winner)
  const DEFAULT_PUBKEY = '11111111111111111111111111111111';
  const hasWinner = winner && winner !== DEFAULT_PUBKEY;

  // If blockchain says idle, game hasn't started
  if (blockchainStatus === 'idle') {
    return 'IDLE';
  }

  // Calculate elapsed time since game start
  const elapsed = currentTime - startTimestamp;

  // Phase 1: WAITING (0 - 30s)
  // Betting window is open, players can join
  if (elapsed < PHASE_DURATIONS.WAITING) {
    return 'WAITING';
  }

  // Phase 2: BETTING_CLOSED (brief transition)
  // Betting window just closed, about to request VRF
  if (elapsed < PHASE_DURATIONS.WAITING + 2) {
    return 'BETTING_CLOSED';
  }

  // Phase 3: FIGHTING (30s - 40s)
  // VRF requested, characters fighting, waiting for random number
  if (elapsed < PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING) {
    // Check blockchain status for VRF
    if (blockchainStatus === 'awaitingWinnerRandomness') {
      // If we're past the expected VRF time (8+ seconds), show delay message
      if (elapsed > PHASE_DURATIONS.WAITING + 8) {
        return 'VRF_DELAYED';
      }
      return 'FIGHTING';
    }

    // If blockchain says finished but we're still in fighting window, show results early
    if (blockchainStatus === 'finished' && hasWinner) {
      return 'RESULTS';
    }

    return 'FIGHTING';
  }

  // Phase 4: RESULTS (40s - 45s)
  // Winner determined, show celebration
  if (elapsed < PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING + PHASE_DURATIONS.RESULTS) {
    // If no winner yet, something went wrong
    if (!hasWinner) {
      return 'VRF_DELAYED';
    }
    return 'RESULTS';
  }

  // Phase 5: FINISHED (45s+)
  // Game complete, ready for next round
  if (blockchainStatus === 'finished' && hasWinner) {
    return 'FINISHED';
  }

  // Fallback: if game is taking too long, show error
  if (elapsed > TOTAL_GAME_DURATION + 30) {
    return 'ERROR';
  }

  return 'FINISHED';
}

/**
 * Get the timestamp when a specific phase starts
 */
export function getPhaseStartTime(
  phase: GamePhase,
  gameStartTimestamp: number
): number {
  switch (phase) {
    case 'WAITING':
      return gameStartTimestamp;

    case 'FIGHTING':
      return gameStartTimestamp + PHASE_DURATIONS.WAITING;

    case 'RESULTS':
      return gameStartTimestamp + PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING;

    case 'FINISHED':
      return gameStartTimestamp + TOTAL_GAME_DURATION;

    default:
      return gameStartTimestamp;
  }
}

/**
 * Get time remaining in current phase (in seconds)
 */
export function getPhaseTimeRemaining(
  currentPhase: GamePhase,
  startTimestamp: number,
  currentTime: number = Date.now() / 1000
): number {
  const elapsed = currentTime - startTimestamp;

  switch (currentPhase) {
    case 'WAITING':
      return Math.max(0, PHASE_DURATIONS.WAITING - elapsed);

    case 'FIGHTING':
      return Math.max(0, PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING - elapsed);

    case 'RESULTS':
      return Math.max(0, TOTAL_GAME_DURATION - elapsed);

    default:
      return 0;
  }
}

/**
 * Check if it's time to execute a specific action
 */
export function shouldExecuteAction(
  action: 'CLOSE_BETTING' | 'SELECT_WINNER' | 'CREATE_NEXT_GAME',
  gameStartTimestamp: number,
  currentTime: number = Date.now() / 1000
): boolean {
  const elapsed = currentTime - gameStartTimestamp;

  switch (action) {
    case 'CLOSE_BETTING':
      // Execute when waiting phase ends
      return elapsed >= PHASE_DURATIONS.WAITING;

    case 'SELECT_WINNER':
      // Execute when fighting phase ends (give VRF 10s to respond)
      return elapsed >= PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING;

    case 'CREATE_NEXT_GAME':
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
    case 'IDLE':
      return 'Waiting for players...';
    case 'WAITING':
      return 'Betting open! Place your bets!';
    case 'BETTING_CLOSED':
      return 'Betting closed! Get ready to fight!';
    case 'FIGHTING':
      return 'Battle in progress! Waiting for winner...';
    case 'VRF_DELAYED':
      return 'Random number generation taking longer than expected...';
    case 'RESULTS':
      return 'Winner announced!';
    case 'FINISHED':
      return 'Game finished! Starting new round...';
    case 'ERROR':
      return 'Game error - please refresh';
    default:
      return 'Unknown phase';
  }
}
