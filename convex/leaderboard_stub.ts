// TEMPORARY STUB - This will be removed after frontend integration is complete
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()), sortBy: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Return empty array for now - leaderboard not in MVP
    return [];
  },
});

export const getPlayerRank = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    // Return null for now - leaderboard not in MVP
    return null;
  },
});

export const getGameStats = query({
  args: {},
  handler: async (ctx, args) => {
    // Return empty stats for now - leaderboard not in MVP
    return {
      totalGames: 0,
      totalPlayers: 0,
      totalPot: 0,
      averageGameDuration: 0,
    };
  },
});