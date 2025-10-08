/**
 * Demo Mode Timing Configuration
 * All timings are in milliseconds unless otherwise specified
 */

export const DEMO_TIMINGS = {
  // Spawning Phase
  SPAWNING_PHASE_DURATION: 30000, // 30 seconds
  BOT_SPAWN_MIN_INTERVAL: 800, // Minimum 0.8 seconds between spawns
  BOT_SPAWN_MAX_INTERVAL: 2500, // Maximum 2.5 seconds between spawns

  // Arena Phase
  ARENA_PHASE_MIN_DURATION: 2000, // Minimum 5 seconds
  ARENA_PHASE_MAX_DURATION: 3000, // Maximum 8 seconds
  ARENA_PHASE_RANDOM_RANGE: 1000, // Random additional time (0-3 seconds)

  // Results Phase
  RESULTS_PHASE_DURATION: 5000, // 5 seconds

  // Testing (for small bot counts)
  TEST_MODE_SPAWN_INTERVAL: 1000, // 1 second per bot when testing with ≤3 bots
} as const;

/**
 * Calculate random arena phase duration
 * @returns Duration in milliseconds (5000-8000ms)
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
