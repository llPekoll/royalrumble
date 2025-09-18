import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Main game loop - check for new games every 10 seconds
crons.interval(
  "game loop",
  { seconds: 10 },
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

export default crons;