/**
 * Convex Cron Jobs for Domin8 Game Management
 *
 * Scheduled functions for periodic maintenance tasks.
 * Note: Game state progression now uses ctx.scheduler.runAfter() instead of polling.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Transaction cleanup - removes 7-day old transactions
 */
crons.interval(
  "transaction-cleanup",
  { hours: 24 },
  internal.transactions.cleanupOldTransactions
);

/**
 * Game cleanup - removes old completed games
 */
crons.interval(
  "game-cleanup",
  { hours: 24 },
  internal.gameManagerDb.cleanupOldGames
);

export default crons;
