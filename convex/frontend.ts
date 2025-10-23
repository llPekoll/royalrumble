/**
 * Frontend API - Public queries for React components
 * Single source of truth for game state
 */
import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get current game state for frontend
 * Returns the most recent game (any status)
 * If latest game is finished, returns null to indicate ready for new game
 */
export const getCurrentGame = query({
  args: {},
  handler: async (ctx) => {
    // Get the most recent game (any status)
    const latestGame = await ctx.db
      .query("games")
      .order("desc")
      .first();

    if (!latestGame) {
      return null;
    }

    // If game is finished, return it with canJoin=false
    // Frontend will show results and "Place bet to start new game"
    // When player bets, blockchain creates new round, event listener creates new Convex game

    // Get all participants (self bets) for this game
    const participants = await ctx.db
      .query("bets")
      .withIndex("by_game_type", (q) =>
        q.eq("gameId", latestGame._id).eq("betType", "self")
      )
      .collect();

    // Get map data
    const map = await ctx.db.get(latestGame.mapId);

    return {
      game: latestGame,
      participants,
      map,
      participantCount: participants.length,
      totalPot: latestGame.totalPot,
      status: latestGame.status,
      canJoin: latestGame.status === "waiting", // Only allow joining if waiting
      isFinished: latestGame.status === "finished", // Flag for UI to show "game over"
    };
  },
});

/**
 * Check if a wallet is participating in the current game
 */
export const isWalletInGame = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    // Get current active game
    const activeGame = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .order("desc")
      .first();

    if (!activeGame) {
      return false;
    }

    // Check if wallet has a bet in this game
    const bet = await ctx.db
      .query("bets")
      .withIndex("by_game_wallet", (q) =>
        q.eq("gameId", activeGame._id).eq("walletAddress", walletAddress)
      )
      .filter((q) => q.eq(q.field("betType"), "self"))
      .first();

    return bet !== null;
  },
});

/**
 * Get player's participants in current game
 */
export const getPlayerParticipants = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    // Get current active game
    const activeGame = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .order("desc")
      .first();

    if (!activeGame) {
      return [];
    }

    // Get all self bets for this wallet in this game
    const participants = await ctx.db
      .query("bets")
      .withIndex("by_game_wallet", (q) =>
        q.eq("gameId", activeGame._id).eq("walletAddress", walletAddress)
      )
      .filter((q) => q.eq(q.field("betType"), "self"))
      .collect();

    // Enrich with character data
    const enrichedParticipants = await Promise.all(
      participants.map(async (p) => {
        const character = p.characterId ? await ctx.db.get(p.characterId) : null;
        return {
          ...p,
          character,
        };
      })
    );

    return enrichedParticipants;
  },
});

/**
 * Get game statistics for display
 */
export const getGameStats = query({
  args: {},
  handler: async (ctx) => {
    // Get current game
    const currentGame = await ctx.db
      .query("games")
      .order("desc")
      .first();

    if (!currentGame) {
      return {
        currentRound: 0,
        status: "idle",
        participantCount: 0,
        totalPot: 0,
      };
    }

    // Get participant count
    const participants = await ctx.db
      .query("bets")
      .withIndex("by_game_type", (q) =>
        q.eq("gameId", currentGame._id).eq("betType", "self")
      )
      .collect();

    return {
      currentRound: currentGame.roundId,
      status: currentGame.status,
      participantCount: participants.length,
      totalPot: currentGame.totalPot,
      endTimestamp: currentGame.endTimestamp,
      phaseStartTime: currentGame.phaseStartTime,
    };
  },
});
