import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// One-time seed data creation (runs once at startup)
crons.interval(
  "seed initial data",
  { seconds: 30 },
  internal.seedData.seedInitialData
);

// Main game loop - check for new games every 10 seconds
crons.interval(
  "game loop",
  { seconds: 1 },
  internal.games.gameLoop
);

// Process transaction queue every 30 seconds
crons.interval(
  "process transaction queue",
  { seconds: 30 },
  api.solana.processTransactionQueue
);

// Clean up old completed transactions every hour
crons.cron(
  "cleanup old transactions",
  "0 * * * *", // Every hour
  api.transactions.cleanupOldTransactions
);

// Clean up old completed games every 6 hours
crons.cron(
  "cleanup old games",
  "0 */6 * * *", // Every 6 hours
  internal.games.cleanupOldGames
);

export default crons;
