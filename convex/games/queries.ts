import { query } from "../_generated/server";
import { v } from "convex/values";

// Get current active game
export const getCurrentGame = query({
  args: {},
  handler: async (ctx) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) =>
        q.neq(q.field("status"), "completed")
      )
      .order("desc")
      .first();

    if (!game) return null;

    // Get participants
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
      .collect();

    return {
      ...game,
      participants,
      timeRemaining: Math.max(0, game.nextPhaseTime - Date.now())
    };
  },
});

// Get game by ID
export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
      .collect();

    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
      .collect();

    return {
      ...game,
      participants,
      bets,
    };
  },
});

// Get recent games
export const getRecentGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const games = await ctx.db
      .query("games")
      .withIndex("by_start_time")
      .order("desc")
      .take(limit);

    return games;
  },
});

// Get player's game history
export const getPlayerGames = query({
  args: { walletAddress: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get player's bets
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_wallet", (q: any) => q.eq("walletAddress", args.walletAddress))
      .order("desc")
      .take(limit);

    // Get unique game IDs
    const gameIds = [...new Set(bets.map(b => b.gameId))];

    // Get games
    const games = await Promise.all(
      gameIds.map(id => ctx.db.get(id))
    );

    return games.filter(Boolean);
  },
});