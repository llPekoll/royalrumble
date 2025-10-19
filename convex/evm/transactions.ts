// Transaction cleanup functions
import { internalMutation } from "./_generated/server";

/**
 * Clean up old transaction records (gameEvents older than 7 days)
 * Called by cron job every 24 hours
 */
export const cleanupOldTransactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    console.log("🧹 Starting transaction cleanup...");

    // Find old gameEvents (transaction records)
    const oldEvents = await ctx.db
      .query("gameEvents")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), sevenDaysAgo))
      .collect();

    let deletedCount = 0;

    // Delete old events in batches
    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old transaction records (older than 7 days)`);
    } else {
      console.log("✨ No old transaction records to clean up");
    }

    return {
      deletedCount,
      cutoffTime: sevenDaysAgo,
      message: `Cleaned up ${deletedCount} transaction records older than 7 days`,
    };
  },
});
