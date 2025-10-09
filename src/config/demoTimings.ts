/**
 * Demo Mode Timing Configuration
 * All timings are in milliseconds unless otherwise specified
 * NEW: More dramatic variance for unpredictable feel
 */

export const DEMO_TIMINGS = {
  // Spawning Phase - characters spawn over 20 seconds
  SPAWNING_PHASE_DURATION: 20000, // 20 seconds total (was 30s)
  BOT_SPAWN_MIN_INTERVAL: 200, // Minimum 0.2 seconds between spawns (faster bursts)
  BOT_SPAWN_MAX_INTERVAL: 3000, // Maximum 3 seconds between spawns (longer gaps)

  // Arena Phase
  ARENA_PHASE_MIN_DURATION: 2000, // Minimum 2 seconds
  ARENA_PHASE_MAX_DURATION: 3000, // Maximum 3 seconds
  ARENA_PHASE_RANDOM_RANGE: 1000, // Random additional time (0-1 seconds)

  // Results Phase
  RESULTS_PHASE_DURATION: 15000, // 15 seconds (enjoy the celebration)

  // Testing (for small bot counts)
  TEST_MODE_SPAWN_INTERVAL: 1000, // 1 second per bot when testing with ≤3 bots
} as const;

/**
 * Calculate random arena phase duration
 * @returns Duration in milliseconds (2000-3000ms)
 */
export function getRandomArenaDuration(): number {
  return (
    DEMO_TIMINGS.ARENA_PHASE_MIN_DURATION + Math.random() * DEMO_TIMINGS.ARENA_PHASE_RANDOM_RANGE
  );
}

/**
 * Calculate total demo cycle duration
 * @returns Object with min, max, and average cycle times
 */
export function getDemoCycleDuration() {
  return {
    min:
      DEMO_TIMINGS.SPAWNING_PHASE_DURATION +
      DEMO_TIMINGS.ARENA_PHASE_MIN_DURATION +
      DEMO_TIMINGS.RESULTS_PHASE_DURATION,
    max:
      DEMO_TIMINGS.SPAWNING_PHASE_DURATION +
      DEMO_TIMINGS.ARENA_PHASE_MAX_DURATION +
      DEMO_TIMINGS.RESULTS_PHASE_DURATION,
    average:
      DEMO_TIMINGS.SPAWNING_PHASE_DURATION +
      (DEMO_TIMINGS.ARENA_PHASE_MIN_DURATION + DEMO_TIMINGS.ARENA_PHASE_MAX_DURATION) / 2 +
      DEMO_TIMINGS.RESULTS_PHASE_DURATION,
  };
}
