// Database operations for game management (mutations and queries)
// These run in the standard Convex runtime (not Node.js)
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// Internal Mutations - Database write operations called by actions
// ============================================================================

/**
 * Create new game state tracking record
 */
export const createGameStateRecord = internalMutation({
  args: { gameId: v.string(), gameRound: v.any(), gameConfig: v.any() },
  handler: async (ctx, { gameId, gameRound, gameConfig }) => {
    const now = Date.now();

    const gameStateId = await ctx.db.insert("gameStates", {
      gameId,
      status: gameRound.status,
      phaseStartTime: gameRound.startTimestamp * 1000,
      waitingDuration: gameConfig.smallGameDurationConfig.waitingPhaseDuration,
      playersCount: gameRound.players.length,
      lastChecked: now,
    });

    return await ctx.db.get(gameStateId);
  },
});

/**
 * Update game state record
 */
export const updateGameState = internalMutation({
  args: {
    gameStateId: v.id("gameStates"),
    lastChecked: v.optional(v.number()),
    status: v.optional(v.string()),
    gameType: v.optional(v.string()),
    resolvingPhaseEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { gameStateId, ...updates } = args;
    await ctx.db.patch(gameStateId, updates);
  },
});

/**
 * Log game events for audit trail
 */
export const logGameEventRecord = internalMutation({
  args: {
    gameId: v.string(),
    event: v.string(),
    details: v.object({
      success: v.boolean(),
      transactionHash: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      fromStatus: v.optional(v.any()),
      toStatus: v.optional(v.any()),
      playersCount: v.optional(v.number()),
      transactionType: v.optional(v.string()),
      processingTimeMs: v.optional(v.number()),
      retryCount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { gameId, event, details }) => {
    await ctx.db.insert("gameEvents", {
      gameId,
      event,
      timestamp: Date.now(),
      success: details.success,
      transactionHash: details.transactionHash,
      errorMessage: details.errorMessage,
      fromStatus: details.fromStatus,
      toStatus: details.toStatus,
      playersCount: details.playersCount,
      transactionType: details.transactionType,
      processingTimeMs: details.processingTimeMs,
      retryCount: details.retryCount || 0,
    });
  },
});

/**
 * Update system health record
 */
export const updateSystemHealth = internalMutation({
  args: {
    component: v.string(),
    status: v.string(),
    lastCheck: v.number(),
    lastError: v.optional(v.string()),
    slot: v.optional(v.number()),
    errorCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_component", (q) => q.eq("component", args.component))
      .first();

    if (!health) {
      await ctx.db.insert("systemHealth", {
        component: args.component,
        status: args.status,
        lastCheck: args.lastCheck,
        lastError: args.lastError,
        metadata: args.slot ? { slot: args.slot } : undefined,
        errorCount: args.errorCount || 0,
      });
    } else {
      await ctx.db.patch(health._id, {
        status: args.status,
        lastCheck: args.lastCheck,
        lastError: args.lastError,
        metadata: args.slot ? { slot: args.slot } : undefined,
        errorCount: args.errorCount !== undefined ? args.errorCount : health.errorCount,
      });
    }
  },
});

// ============================================================================
// Internal Queries - Database read operations called by actions
// ============================================================================

/**
 * Get game state by game ID
 */
export const getGameStateByGameId = internalQuery({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    return await ctx.db
      .query("gameStates")
      .withIndex("by_game_id", (q) => q.eq("gameId", gameId))
      .first();
  },
});

/**
 * Get system health error count
 */
export const getSystemHealthErrorCount = internalQuery({
  args: { component: v.string() },
  handler: async (ctx, { component }) => {
    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_component", (q) => q.eq("component", component))
      .first();

    return health?.errorCount || 0;
  },
});

/**
 * Public query: Get current game state for frontend
 */
export const getGameState = query({
  args: {},
  handler: async (ctx) => {
    // Get latest game state
    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_last_checked")
      .order("desc")
      .first();

    if (!gameState) {
      return null;
    }

    // Get recent events for this game
    const recentEvents = await ctx.db
      .query("gameEvents")
      .withIndex("by_game_id", (q) => q.eq("gameId", gameState.gameId))
      .order("desc")
      .take(10);

    return {
      gameState,
      recentEvents,
    };
  },
});

/**
 * Public query: Get system health status
 */
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const healthRecords = await ctx.db.query("systemHealth").collect();

    return healthRecords.map((record) => ({
      component: record.component,
      status: record.status,
      lastCheck: record.lastCheck,
      errorCount: record.errorCount,
      lastError: record.lastError,
    }));
  },
});
