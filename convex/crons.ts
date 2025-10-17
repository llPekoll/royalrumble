// Cron job configuration for the Domin8 game progression
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Event listener - listens to blockchain events for real-time updates
// Runs every 5 seconds to fetch and process recent on-chain events
// This is the PRIMARY update mechanism (faster than polling)
crons.interval(
  "blockchain-event-listener",
  { seconds: 5 },
  internal.eventListener.listenToBlockchainEvents
);

// Game progression check - fallback polling mechanism
// Runs every 15 seconds to check for games that need progression
// This acts as a FALLBACK in case events are missed
crons.interval(
  "game-progression-check",
  { seconds: 15 },
  internal.gameManager.checkAndProgressGames
);

// Transaction cleanup - removes 7-day old transactions
crons.interval("transaction-cleanup", { hours: 24 }, internal.transactions.cleanupOldTransactions);

// Game cleanup - removes 3-day old completed games
crons.interval("game-cleanup", { hours: 24 * 3 }, internal.gameManager.cleanupOldGames);

export default crons;
