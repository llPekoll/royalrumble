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

export default crons;
