import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

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