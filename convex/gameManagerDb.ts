// Database operations for game management (mutations and queries)
// These run in the standard Convex runtime (not Node.js)
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// Internal Mutations - Database write operations called by actions
// ============================================================================

/**
 * Create new game record (unified games table)
 */
export const createGameRecord = internalMutation({
  args: {
    roundId: v.number(),
    gameRound: v.any(),
    gameConfig: v.any(),
    mapId: v.id("maps"),
  },
  handler: async (ctx, { roundId, gameRound, gameConfig, mapId }) => {
    const now = Date.now();

    const gameId = await ctx.db.insert("games", {
      // Blockchain fields
      roundId,
      status: gameRound.status,
      startTimestamp: gameRound.startTimestamp ? gameRound.startTimestamp * 1000 : undefined,
      endTimestamp: gameRound.endTimestamp ? gameRound.endTimestamp * 1000 : undefined, // Betting window end time
      totalPot: gameRound.totalPot || 0,
      winner: gameRound.winner,
      playersCount: gameRound.bets?.length || 0,

      // VRF fields
      vrfRequestPubkey: gameRound.vrfRequestPubkey,
      randomnessFulfilled: gameRound.randomnessFulfilled || false,

      // UI enhancement fields
      mapId,
      winnerId: undefined,

      // Essential timing
      phaseStartTime: gameRound.startTimestamp ? gameRound.startTimestamp * 1000 : now,
      waitingDuration: gameConfig.smallGameDurationConfig?.waitingPhaseDuration || 30,

      // Cron management
      lastChecked: now,
      lastUpdated: now,
    });

    return await ctx.db.get(gameId);
  },
});

/**
 * Update game record
 */
export const updateGame = internalMutation({
  args: {
    gameId: v.id("games"),
    lastChecked: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
    status: v.optional(v.string()),
    endTimestamp: v.optional(v.number()), // Allow updating betting window end time
    totalPot: v.optional(v.number()),
    winner: v.optional(v.string()),
    winnerId: v.optional(v.id("bets")), // Updated to reference bets table
    playersCount: v.optional(v.number()),
    vrfRequestPubkey: v.optional(v.string()),
    randomnessFulfilled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { gameId, ...updates } = args;
    await ctx.db.patch(gameId, updates);
  },
});

/**
 * Log game events for audit trail
 */
export const logGameEventRecord = internalMutation({
  args: {
    roundId: v.number(),
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
  handler: async (ctx, { roundId, event, details }) => {
    await ctx.db.insert("gameEvents", {
      roundId,
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
 * Get game by round ID
 */
export const getGameByRoundId = internalQuery({
  args: { roundId: v.number() },
  handler: async (ctx, { roundId }) => {
    return await ctx.db
      .query("games")
      .withIndex("by_round_id", (q) => q.eq("roundId", roundId))
      .first();
  },
});

/**
 * Get a random active map
 */
export const getRandomActiveMap = internalQuery({
  args: {},
  handler: async (ctx) => {
    const activeMaps = await ctx.db
      .query("maps")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    if (activeMaps.length === 0) {
      throw new Error("No active maps available");
    }

    // Select random map
    const randomIndex = Math.floor(Math.random() * activeMaps.length);
    return activeMaps[randomIndex];
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
    // Get latest game
    const game = await ctx.db
      .query("games")
      .withIndex("by_last_checked")
      .order("desc")
      .first();

    if (!game) {
      return null;
    }

    // Get players for this game from bets table (only self/bank bets represent participants)
    const playerBets = await ctx.db
      .query("bets")
      .withIndex("by_game_type", (q) => q.eq("gameId", game._id).eq("betType", "self"))
      .collect();

    // Transform bets into player objects for frontend compatibility
    const players = playerBets.map(bet => ({
      wallet: bet.walletAddress,
      playerId: bet.playerId,
      betId: bet._id,
      characterId: bet.characterId,
      amount: bet.amount,
      eliminated: bet.eliminated || false,
    }));

    // Get recent events for this game
    const recentEvents = await ctx.db
      .query("gameEvents")
      .withIndex("by_round_id", (q) => q.eq("roundId", game.roundId))
      .order("desc")
      .take(10);

    return {
      game: {
        ...game,
        players, // Add the players list to the game object
      },
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

// ============================================================================
// Cleanup Helper Queries and Mutations
// ============================================================================

/**
 * Get old completed games for cleanup
 */
export const getOldCompletedGames = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, { cutoffTime }) => {
    // Get games that have been updated before the cutoff time
    // and are in finished status
    const allGames = await ctx.db.query("games").collect();

    return allGames.filter(
      (game) => game.status === "finished" && game.lastUpdated < cutoffTime
    );
  },
});

/**
 * Get game participants for cleanup (now from bets table)
 */
export const getGameParticipants = internalQuery({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    // Get self bets which represent participants in the consolidated schema
    return await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .filter((q) => q.eq(q.field("betType"), "self"))
      .collect();
  },
});

/**
 * Get game bets for cleanup (all bets including spectator bets)
 */
export const getGameBets = internalQuery({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    return await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
  },
});

/**
 * Delete a participant (now deletes bet record)
 */
export const deleteParticipant = internalMutation({
  args: { participantId: v.id("bets") }, // Now references bet ID instead
  handler: async (ctx, { participantId }) => {
    await ctx.db.delete(participantId);
  },
});

/**
 * Delete a bet
 */
export const deleteBet = internalMutation({
  args: { betId: v.id("bets") },
  handler: async (ctx, { betId }) => {
    await ctx.db.delete(betId);
  },
});

/**
 * Delete a game
 */
export const deleteGame = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    await ctx.db.delete(gameId);
  },
});

// ============================================================================
// Event Listener Helpers
// ============================================================================

/**
 * Get last processed event slot
 */
export const getLastProcessedEventSlot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const metadata = await ctx.db
      .query("systemHealth")
      .withIndex("by_component", (q) => q.eq("component", "event_listener"))
      .first();

    return metadata?.metadata?.lastProcessedSlot || null;
  },
});

/**
 * Update last processed event slot
 */
export const updateLastProcessedEventSlot = internalMutation({
  args: { slot: v.number() },
  handler: async (ctx, { slot }) => {
    const metadata = await ctx.db
      .query("systemHealth")
      .withIndex("by_component", (q) => q.eq("component", "event_listener"))
      .first();

    if (metadata) {
      await ctx.db.patch(metadata._id, {
        metadata: { ...metadata.metadata, lastProcessedSlot: slot },
      });
    } else {
      await ctx.db.insert("systemHealth", {
        component: "event_listener",
        status: "healthy",
        lastCheck: Date.now(),
        metadata: { lastProcessedSlot: slot },
        errorCount: 0,
      });
    }
  },
});

/**
 * Create or update bet record from event
 */
export const createOrUpdateBet = internalMutation({
  args: {
    gameId: v.id("games"),
    playerWallet: v.string(),
    amount: v.number(),
    txSignature: v.string(),
    onChainConfirmed: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if bet already exists
    const existingBet = await ctx.db
      .query("bets")
      .withIndex("by_tx_signature", (q) => q.eq("txSignature", args.txSignature))
      .first();

    if (existingBet) {
      // Update existing bet
      await ctx.db.patch(existingBet._id, {
        onChainConfirmed: args.onChainConfirmed,
      });
      return existingBet._id;
    } else {
      // Create new bet record
      return await ctx.db.insert("bets", {
        gameId: args.gameId,
        walletAddress: args.playerWallet,
        amount: args.amount,
        txSignature: args.txSignature,
        onChainConfirmed: args.onChainConfirmed,
        betType: "self", // Entry bets are self bets
        status: "pending", // Required field
        placedAt: Date.now(), // Required field
        timestamp: Date.now(), // Optional field for event listener tracking
      });
    }
  },
});
