// Core game management functions using scheduler-based flow
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Start a new game when first bet is placed
 * This triggers the scheduler chain for automatic game progression
 */
export const startGame = internalMutation({
  args: {
    roundId: v.number(),
    gameRound: v.any(),
    gameConfig: v.any(),
    mapId: v.id("maps"),
  },
  handler: async (ctx, { roundId, gameRound, gameConfig, mapId }) => {
    const now = Date.now();

    // Create game record
    const gameId = await ctx.db.insert("games", {
      // Blockchain fields
      roundId,
      status: gameRound.status,
      startTimestamp: gameRound.startTimestamp ? gameRound.startTimestamp * 1000 : undefined,
      endTimestamp: gameRound.endTimestamp ? gameRound.endTimestamp * 1000 : undefined,
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

    // Log game started
    await ctx.db.insert("gameEvents", {
      roundId,
      event: "game_started",
      timestamp: now,
      success: true,
      fromStatus: "finished",
      toStatus: "waiting",
    });

    // Schedule betting window closure after waiting duration (default 30 seconds)
    const waitingDurationMs =
      (gameConfig.smallGameDurationConfig?.waitingPhaseDuration || 30) * 1000;

    await ctx.scheduler.runAfter(waitingDurationMs, internal.gameActions.closeBettingWindow, {
      gameId,
    });

    console.log(`Game ${roundId} started, betting window closes in ${waitingDurationMs}ms`);

    return gameId;
  },
});
