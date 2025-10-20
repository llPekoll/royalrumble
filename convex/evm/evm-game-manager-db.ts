import { internalMutation, internalQuery, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { GameStatus } from "./evm-types";
import type { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// Internal Mutations - Called by actions
// ============================================================================

/**
 * @notice Creates a new game record or updates an existing one based on on-chain data.
 * @dev This is the primary mechanism for keeping the Convex DB in sync with the blockchain.
 */
export const syncGameRecord = internalMutation({
  args: {
    gameRound: v.any(), // Using v.any() to accept the raw struct from the EVM client
  },
  handler: async (ctx: MutationCtx, { gameRound }: any) => {
    const { roundId, status, startTimestamp, endTimestamp, totalPot, winner, vrfRequestId, randomnessFulfilled, bets } = gameRound;
    const now = Date.now();

    const existingGame = await ctx.db
      .query("games")
      .withIndex("by_round_id", (q: any) => q.eq("roundId", roundId))
      .first();

    const gameStatusString = GameStatus[status as number];

    if (existingGame) {
      // Update existing game
      await ctx.db.patch(existingGame._id, {
        status: gameStatusString,
        totalPot: totalPot.toString(),
        winner: winner.wallet, // Extract wallet address from BetEntry
        vrfRequestId: vrfRequestId,
        randomnessFulfilled: randomnessFulfilled,
        playersCount: bets.length,
        lastChecked: now,
        lastUpdated: now,
      });
      return await ctx.db.get(existingGame._id);
    } else {
      // Create new game if it's the first time we've seen this roundId
      const map = await getRandomActiveMap(ctx.db);
      if (!map) throw new Error("No active maps available to create a new game.");
      
      const gameId = await ctx.db.insert("games", {
        roundId,
        status: gameStatusString,
        startTimestamp: startTimestamp * 1000,
        endTimestamp: endTimestamp * 1000,
        totalPot: totalPot.toString(),
        winner: winner.wallet, // Extract wallet address from BetEntry
        playersCount: bets.length,
        vrfRequestId,
        randomnessFulfilled,
        mapId: map._id,
        lastChecked: now,
        lastUpdated: now,
      });
      return await ctx.db.get(gameId);
    }
  },
});

/**
 * @notice Updates the status of a game in the database.
 */
export const updateGameStatus = internalMutation({
    args: { gameId: v.id("games"), status: v.string() },
    handler: async (ctx: MutationCtx, { gameId, status }: any) => {
        await ctx.db.patch(gameId, { status, lastUpdated: Date.now() });
    },
});

/**
 * @notice Logs a game event to the audit trail.
 */
export const logGameEvent = internalMutation({
  args: {
    roundId: v.optional(v.number()),
    event: v.string(),
    details: v.object({
      success: v.boolean(),
      transactionHash: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      fromStatus: v.optional(v.string()),
      toStatus: v.optional(v.string()),
      playersCount: v.optional(v.number()),
      transactionType: v.optional(v.string()),
    }),
  },
  handler: async (ctx: MutationCtx, { roundId, event, details }: any) => {
    await ctx.db.insert("gameEvents", {
      roundId,
      event,
      timestamp: Date.now(),
      ...details,
    });
  },
});

/**
 * @notice Updates a system health component's status.
 */
export const updateSystemHealth = internalMutation({
  args: {
    component: v.string(),
    status: v.string(),
    lastCheck: v.number(),
    lastError: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_component", (q: any) => q.eq("component", args.component))
      .first();

    if (health) {
      await ctx.db.patch(health._id, { ...args });
    } else {
      await ctx.db.insert("systemHealth", { ...args });
    }
  },
});


// ============================================================================
// Internal Queries - Called by actions
// ============================================================================

/**
 * @notice Gets a random active map from the database.
 * @param db The database reader instance.
 */
const getRandomActiveMap = async (db: any) => {
    const activeMaps = await db
      .query("maps")
      .withIndex("by_active", (q: any) => q.eq("isActive", true))
      .collect();
    if (activeMaps.length === 0) return null;
    return activeMaps[Math.floor(Math.random() * activeMaps.length)];
};


/**
 * @notice Gets a game by its round ID.
 */
export const getGameByRoundId = internalQuery({
  args: { roundId: v.number() },
  handler: async (ctx: QueryCtx, { roundId }: any) => {
    return await ctx.db
      .query("games")
      .withIndex("by_round_id", (q: any) => q.eq("roundId", roundId))
      .first();
  },
});


// ============================================================================
// Public Queries - Called by the client
// ============================================================================

/**
 * @notice Public query to get the current game state for the frontend.
 */
export const getGameState = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    // Get the latest game by last checked time
    const game = await ctx.db
      .query("games")
      .withIndex("by_last_checked")
      .order("desc")
      .first();

    if (!game) return null;

    // Get bets for this game
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
      .collect();

    return { game, bets };
  },
});


// ============================================================================
// Cleanup Helpers
// ============================================================================

export const getOldCompletedGames = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx: QueryCtx, { cutoffTime }: any) => {
    return await ctx.db
      .query("games")
      .withIndex("by_last_checked")
      .filter((q: any) => q.and(
          q.eq(q.field("status"), "Finished"),
          q.lt(q.field("lastUpdated"), cutoffTime)
      ))
      .collect();
  },
});

export const getGameBets = internalQuery({
  args: { gameId: v.id("games") },
  handler: async (ctx: QueryCtx, { gameId }: any) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
      .collect();
  },
});

export const deleteBet = internalMutation({
  args: { betId: v.id("bets") },
  handler: async (ctx: MutationCtx, { betId }: any) => await ctx.db.delete(betId),
});

export const deleteGame = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx: MutationCtx, { gameId }: any) => await ctx.db.delete(gameId),
});
