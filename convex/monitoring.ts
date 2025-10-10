// System monitoring and maintenance functions
import { internalMutation, query } from "convex/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { SolanaClient } from "./lib/solana";

/**
 * System health check - monitors all components
 */
export const systemHealthCheck = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const now = Date.now();
    
    // Check Solana RPC health
    await checkSolanaRPCHealth(ctx, now);
    
    // Check database health
    await checkDatabaseHealth(ctx, now);
    
    // Check for stuck games
    await checkForStuckGames(ctx, now);
    
    // Update overall system status
    await updateOverallSystemHealth(ctx, now);
  },
});

/**
 * Check Solana RPC connectivity and performance
 */
async function checkSolanaRPCHealth(ctx: MutationCtx, now: number) {
  const component = "solana_rpc";
  let status = "healthy";
  let errorMessage = "";
  let responseTime = 0;
  
  try {
    const startTime = Date.now();
    
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
    const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;
    
    if (!authorityKey) {
      throw new Error("CRANK_AUTHORITY_PRIVATE_KEY not configured");
    }
    
    const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
    const health = await solanaClient.healthCheck();
    
    responseTime = Date.now() - startTime;
    
    if (!health.healthy) {
      status = "degraded";
      errorMessage = health.message;
    }
    
    // Check response time
    if (responseTime > 5000) { // 5 second threshold
      status = "degraded";
      errorMessage = `Slow response time: ${responseTime}ms`;
    }
    
  } catch (error) {
    status = "unhealthy";
    errorMessage = error instanceof Error ? error.message : String(error);
    responseTime = Date.now() - now;
  }
  
  // Update health record
  await updateComponentHealth(ctx, component, status, now, errorMessage, {
    responseTime,
    endpoint: process.env.SOLANA_RPC_ENDPOINT
  });
}

/**
 * Check database health and performance
 */
async function checkDatabaseHealth(ctx: MutationCtx, now: number) {
  const component = "database";
  let status = "healthy";
  let errorMessage = "";
  let responseTime = 0;
  
  try {
    const startTime = Date.now();
    
    // Test basic database operations
    const testRecord = await ctx.db.insert("systemHealth", {
      component: "test_record",
      status: "test",
      lastCheck: now,
      errorCount: 0,
    });
    
    await ctx.db.delete(testRecord);
    
    responseTime = Date.now() - startTime;
    
    // Check if response time is acceptable
    if (responseTime > 1000) { // 1 second threshold
      status = "degraded";
      errorMessage = `Slow database response: ${responseTime}ms`;
    }
    
  } catch (error) {
    status = "unhealthy";
    errorMessage = error instanceof Error ? error.message : String(error);
    responseTime = Date.now() - now;
  }
  
  await updateComponentHealth(ctx, component, status, now, errorMessage, {
    responseTime
  });
}

/**
 * Check for games that might be stuck in a state
 */
async function checkForStuckGames(ctx: MutationCtx, now: number) {
  const component = "game_progression";
  let status = "healthy";
  let errorMessage = "";
  const stuckThreshold = 5 * 60 * 1000; // 5 minutes
  
  try {
    // Find games that haven't been checked in a while
    const stuckGames = await ctx.db
      .query("gameStates")
      .filter((q: any) => q.lt(q.field("lastChecked"), now - stuckThreshold))
      .collect();
    
    if (stuckGames.length > 0) {
      status = "degraded";
      errorMessage = `Found ${stuckGames.length} games stuck for more than 5 minutes`;
      
      // Log stuck games for investigation
      for (const game of stuckGames) {
        await ctx.db.insert("gameEvents", {
          gameId: game.gameId,
          event: "game_stuck_detected",
          timestamp: now,
          success: false,
          errorMessage: `Game stuck in ${game.status} for ${Math.round((now - game.lastChecked) / 60000)} minutes`,
        });
      }
    }
    
    // Check for games in non-idle status for too long (>1 hour)
    const longRunningThreshold = 60 * 60 * 1000; // 1 hour
    const longRunningGames = await ctx.db
      .query("gameStates")
      .filter((q: any) => 
        q.and(
          q.neq(q.field("status"), "idle"),
          q.lt(q.field("phaseStartTime"), now - longRunningThreshold)
        )
      )
      .collect();
    
    if (longRunningGames.length > 0) {
      status = "unhealthy";
      errorMessage = `Found ${longRunningGames.length} games running for more than 1 hour`;
    }
    
  } catch (error) {
    status = "unhealthy";
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  
  await updateComponentHealth(ctx, component, status, now, errorMessage, {
    stuckGameCount: 0 // Will be updated in actual implementation
  });
}

/**
 * Update overall system health based on component health
 */
async function updateOverallSystemHealth(ctx: MutationCtx, now: number) {
  const components = await ctx.db.query("systemHealth").collect();
  
  let overallStatus = "healthy";
  let unhealthyCount = 0;
  let degradedCount = 0;
  
  for (const component of components) {
    if (component.status === "unhealthy") {
      unhealthyCount++;
    } else if (component.status === "degraded") {
      degradedCount++;
    }
  }
  
  if (unhealthyCount > 0) {
    overallStatus = "unhealthy";
  } else if (degradedCount > 0) {
    overallStatus = "degraded";
  }
  
  await updateComponentHealth(ctx, "overall_system", overallStatus, now, "", {
    unhealthyComponents: unhealthyCount,
    degradedComponents: degradedCount,
    totalComponents: components.length
  });
}

/**
 * Helper to update component health records
 */
async function updateComponentHealth(
  ctx: any, 
  component: string, 
  status: string, 
  lastCheck: number, 
  errorMessage: string,
  metadata: any = {}
) {
  let health = await ctx.db
    .query("systemHealth")
    .withIndex("by_component", (q) => q.eq("component", component))
    .first();
  
  if (health) {
    const errorCount = status === "unhealthy" ? health.errorCount + 1 : 0;
    
    await ctx.db.patch(health._id, {
      status,
      lastCheck,
      lastError: errorMessage || undefined,
      errorCount,
      metadata,
    });
  } else {
    await ctx.db.insert("systemHealth", {
      component,
      status,
      lastCheck,
      lastError: errorMessage || undefined,
      errorCount: status === "unhealthy" ? 1 : 0,
      metadata,
    });
  }
}

/**
 * Get system health dashboard data
 */
export const getSystemHealthDashboard = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const healthRecords = await ctx.db.query("systemHealth").collect();
    
    // Get recent error events
    const recentErrors = await ctx.db
      .query("gameEvents")
      .withIndex("by_success")
      .filter((q) => q.eq("success", false))
      .order("desc")
      .take(20);
    
    // Get system metrics
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentEvents = await ctx.db
      .query("gameEvents")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
      .collect();
    
    const successRate = recentEvents.length > 0 
      ? (recentEvents.filter((e: Doc<"gameEvents">) => e.success).length / recentEvents.length) * 100
      : 100;
    
    const avgResponseTime = recentEvents
      .filter((e: Doc<"gameEvents">) => e.processingTimeMs)
      .reduce((sum: number, e: Doc<"gameEvents">) => sum + (e.processingTimeMs || 0), 0) / 
      Math.max(1, recentEvents.filter((e: Doc<"gameEvents">) => e.processingTimeMs).length);
    
    return {
      healthRecords: healthRecords.map((record: Doc<"systemHealth">) => ({
        component: record.component,
        status: record.status,
        lastCheck: record.lastCheck,
        errorCount: record.errorCount,
        lastError: record.lastError,
        metadata: record.metadata,
      })),
      recentErrors: recentErrors.map((error: Doc<"gameEvents">) => ({
        gameId: error.gameId,
        event: error.event,
        timestamp: error.timestamp,
        errorMessage: error.errorMessage,
        transactionType: error.transactionType,
      })),
      metrics: {
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        totalEventsLastHour: recentEvents.length,
        errorEventsLastHour: recentEvents.filter((e: Doc<"gameEvents">) => !e.success).length,
      }
    };
  },
});

/**
 * Emergency function to reset stuck games
 */
export const resetStuckGame = internalMutation({
  args: {
    gameId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx: MutationCtx, args: { gameId: string; reason: string }) => {
    const now = Date.now();
    
    try {
      // Find the stuck game
      const gameState = await ctx.db
        .query("gameStates")
        .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
        .first();
      
      if (!gameState) {
        throw new Error(`Game ${args.gameId} not found`);
      }
      
      // Log the reset action
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "manual_reset",
        timestamp: now,
        success: true,
        errorMessage: args.reason,
        transactionType: "manual_intervention",
      });
      
      // Reset the game state
      await ctx.db.patch(gameState._id, {
        status: "idle",
        lastChecked: now,
      });
      
      console.log(`Game ${args.gameId} manually reset: ${args.reason}`);
      
    } catch (error) {
      console.error("Failed to reset game:", error);
      
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "manual_reset_failed",
        timestamp: now,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },
});