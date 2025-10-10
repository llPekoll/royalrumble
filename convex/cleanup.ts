// Cleanup and maintenance functions
import { internalMutation } from "./_generated/server";

/**
 * Clean up old events - called by cron job
 */
export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    try {
      // Clean up old game events (keep last 7 days)
      const oldEvents = await ctx.db
        .query("gameEvents")
        .withIndex("by_timestamp")
        .filter((q: any) => q.lt(q.field("timestamp"), cutoffTime))
        .collect();
      
      let deletedEventsCount = 0;
      for (const event of oldEvents) {
        await ctx.db.delete(event._id);
        deletedEventsCount++;
        
        // Batch processing to avoid timeouts
        if (deletedEventsCount % 100 === 0) {
          console.log(`Deleted ${deletedEventsCount} old events...`);
        }
      }
      
      // Clean up old VRF requests (keep last 7 days)
      const oldVrfRequests = await ctx.db
        .query("vrfRequests")
        .filter((q: any) => q.lt(q.field("requestedAt"), cutoffTime))
        .collect();
      
      let deletedVrfCount = 0;
      for (const request of oldVrfRequests) {
        await ctx.db.delete(request._id);
        deletedVrfCount++;
      }
      
      // Clean up old game states for completed games (keep last 24 hours)
      const gameStateCutoff = now - (24 * 60 * 60 * 1000); // 24 hours ago
      const oldGameStates = await ctx.db
        .query("gameStates")
        .filter((q: any) => 
          q.and(
            q.eq(q.field("status"), "idle"),
            q.lt(q.field("lastChecked"), gameStateCutoff)
          )
        )
        .collect();
      
      let deletedGameStatesCount = 0;
      for (const gameState of oldGameStates) {
        await ctx.db.delete(gameState._id);
        deletedGameStatesCount++;
      }
      
      // Log cleanup completion
      await ctx.db.insert("gameEvents", {
        gameId: "system",
        event: "cleanup_completed",
        timestamp: now,
        success: true,
        metadata: {
          deletedEvents: deletedEventsCount,
          deletedVrfRequests: deletedVrfCount,
          deletedGameStates: deletedGameStatesCount,
        }
      });
      
      console.log(`Cleanup completed: ${deletedEventsCount} events, ${deletedVrfCount} VRF requests, ${deletedGameStatesCount} game states`);
      
    } catch (error) {
      console.error("Cleanup failed:", error);
      
      // Log cleanup failure
      await ctx.db.insert("gameEvents", {
        gameId: "system",
        event: "cleanup_failed",
        timestamp: now,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },
});