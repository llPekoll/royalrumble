// Cron job configuration for the Domin8 game progression
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Main game progression cron job
// Runs every 5 seconds to check for games that need progression (real games only)
crons.interval(
  "game-progression-check",
  { seconds: 5 },
  internal.gameManager.checkAndProgressGames
);

// TODO: Add these cron jobs once the corresponding functions are implemented:

// Transaction cleanup - removes 7-day old transactions
crons.interval("transaction-cleanup", { hours: 24 }, internal.transactions.cleanupOldTransactions);

// Game cleanup - removes 3-day old completed games
crons.interval("game-cleanup", { hours: 24 * 3 }, internal.gameManager.cleanupOldGames);

export default crons;
