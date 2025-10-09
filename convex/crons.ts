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

// Health monitoring cron job
// Runs every minute to monitor system health
crons.interval("health-check", { seconds: 60 }, internal.monitoring.systemHealthCheck);

// Cleanup old events cron job
// Runs every hour to clean up old game events (keep last 7 days)
crons.interval("cleanup-old-events", { minutes: 60 }, internal.cleanup.cleanupOldEvents);

export default crons;
