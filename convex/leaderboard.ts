import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get top players on leaderboard
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("wins"),
      v.literal("earnings"),
      v.literal("winRate")
    ))
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const sortBy = args.sortBy || "earnings";

    let entries;

    // Apply sorting based on field
    if (sortBy === "wins") {
      entries = await ctx.db
        .query("leaderboard")
        .withIndex("by_wins")
        .order("desc")
        .take(limit);
    } else if (sortBy === "earnings") {
      entries = await ctx.db
        .query("leaderboard")
        .withIndex("by_earnings")
        .order("desc")
        .take(limit);
    } else {
      // For winRate, we need to get all and sort manually
      const allEntries = await ctx.db.query("leaderboard").collect();
      entries = allEntries
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, limit);
    }

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  },
});

// Get player's leaderboard position
export const getPlayerRank = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("leaderboard")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!entry) return null;

    // Calculate rank by counting players with higher earnings
    const allEntries = await ctx.db.query("leaderboard").collect();
    const higherRanked = allEntries.filter(e => e.totalEarnings > entry.totalEarnings);

    return {
      ...entry,
      rank: higherRanked.length + 1,
    };
  },
});

// Update leaderboard entry (internal, called after games)
export const updateLeaderboardEntry = internalMutation({
  args: {
    walletAddress: v.string(),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return;

    // Get player's betting history
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .filter((q) => q.neq(q.field("status"), "pending"))
      .collect();

    if (bets.length === 0) return;

    // Calculate stats
    const wonBets = bets.filter(b => b.status === "won");
    const totalWins = wonBets.length;
    const totalGames = bets.length;
    const totalEarnings = bets.reduce((sum, bet) =>
      sum + Math.max(0, (bet.payout || 0) - bet.amount), 0
    );
    const winRate = totalGames > 0 ? (totalWins / totalGames) : 0;
    const highestPayout = Math.max(0, ...bets.map(b => b.payout || 0));

    // Check if entry exists
    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    const leaderboardData = {
      period: "alltime",
      startDate: 0,
      playerId: args.playerId,
      walletAddress: args.walletAddress,
      displayName: player.displayName || `Player${args.walletAddress.slice(-4)}`,
      gamesPlayed: totalGames,
      wins: totalWins,
      totalEarnings,
      winRate,
      highestPayout,
      rank: 0, // Will be calculated later
    };

    if (existing) {
      await ctx.db.patch(existing._id, leaderboardData);
    } else {
      await ctx.db.insert("leaderboard", leaderboardData);
    }
  },
});

// Get game statistics
export const getGameStats = query({
  args: {},
  handler: async (ctx) => {
    // Get total games
    const totalGames = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    // Get total unique players
    const allPlayers = await ctx.db.query("players").collect();

    // Get total pot from completed games
    const totalPotValue = totalGames.reduce((sum, game) => sum + game.totalPot, 0);

    // Get active games
    const activeGames = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .collect();

    // Calculate average pot
    const avgPot = totalGames.length > 0
      ? Math.floor(totalPotValue / totalGames.length)
      : 0;

    return {
      totalGames: totalGames.length,
      totalPlayers: allPlayers.length,
      totalPot: totalPotValue,
      averagePot: avgPot,
      activeGames: activeGames.length,
      lastGameTime: totalGames.length > 0
        ? totalGames[totalGames.length - 1].endTime
        : null,
    };
  },
});