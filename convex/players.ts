import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getPlayer = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      return null;
    }

    return player;
  },
});

export const createPlayer = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (existingPlayer) {
      return existingPlayer._id;
    }

    const playerId = await ctx.db.insert("players", {
      walletAddress: args.walletAddress,
      gameCoins: 0,
      pendingCoins: 0,
      createdAt: Date.now(),
      lastActive: Date.now(),
    });

    return playerId;
  },
});

export const updateLastActive = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (player) {
      await ctx.db.patch(player._id, {
        lastActive: Date.now(),
      });
    }
  },
});

export const addGameCoins = mutation({
  args: {
    walletAddress: v.string(),
    amount: v.number()
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins + args.amount,
      lastActive: Date.now(),
    });

    return player.gameCoins + args.amount;
  },
});

export const deductGameCoins = mutation({
  args: {
    walletAddress: v.string(),
    amount: v.number()
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    if (player.gameCoins < args.amount) {
      throw new Error("Insufficient game coins");
    }

    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.amount,
      lastActive: Date.now(),
    });

    return player.gameCoins - args.amount;
  },
});

export const updatePendingCoins = mutation({
  args: {
    walletAddress: v.string(),
    amount: v.number()
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    await ctx.db.patch(player._id, {
      pendingCoins: Math.max(0, player.pendingCoins + args.amount),
      lastActive: Date.now(),
    });

    return player.pendingCoins + args.amount;
  },
});