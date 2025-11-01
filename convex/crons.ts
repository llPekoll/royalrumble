// Cron job configuration for the Domin8 game progression
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Main game progression cron job
// Runs every 15 seconds to check for games that need progression
crons.interval(
  "game-progression-check",
  { seconds: 15 },
  internal.gameManager.checkAndProgressGames
);

// NOTE: Health monitoring and cleanup cron jobs removed during Phase 1 cleanup
// These will be re-implemented in a simplified way in later phases if needed

export default crons;
