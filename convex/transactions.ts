import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getPendingTransactions = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactionQueue")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "processing")
        )
      )
      .collect();

    return transactions.sort((a, b) => b.queuedAt - a.queuedAt);
  },
});

export const getAllTransactions = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactionQueue")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .collect();

    return transactions.sort((a, b) => b.queuedAt - a.queuedAt);
  },
});

export const queueDeposit = mutation({
  args: {
    walletAddress: v.string(),
    amount: v.number(),
    solAmount: v.optional(v.number()),
    priority: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const transactionId = await ctx.db.insert("transactionQueue", {
      walletAddress: args.walletAddress,
      amount: args.amount,
      solAmount: args.solAmount,
      type: "deposit",
      status: "queued",
      queuedAt: Date.now(),
      priority: args.priority || 1,
    });

    // Update pending coins immediately for UX
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (player) {
      await ctx.db.patch(player._id, {
        pendingCoins: player.pendingCoins + args.amount,
      });
    }

    return transactionId;
  },
});

export const queueWithdrawal = mutation({
  args: {
    walletAddress: v.string(),
    amount: v.number(),
    solAmount: v.optional(v.number()),
    priority: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Check if player has sufficient game coins
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player || player.gameCoins < args.amount) {
      throw new Error("Insufficient game coins for withdrawal");
    }

    const transactionId = await ctx.db.insert("transactionQueue", {
      walletAddress: args.walletAddress,
      amount: args.amount,
      solAmount: args.solAmount,
      type: "withdrawal",
      status: "queued",
      queuedAt: Date.now(),
      priority: args.priority || 1,
    });

    // Deduct from game coins and add to pending
    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.amount,
      pendingCoins: player.pendingCoins - args.amount,
    });

    return transactionId;
  },
});

export const updateTransactionStatus = mutation({
  args: {
    transactionId: v.id("transactionQueue"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    transactionSignature: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const updateData: any = {
      status: args.status,
    };

    if (args.transactionSignature) {
      updateData.transactionSignature = args.transactionSignature;
    }

    if (args.status === "processing" || args.status === "completed" || args.status === "failed") {
      updateData.processedAt = Date.now();
    }

    await ctx.db.patch(args.transactionId, updateData);

    // Handle status changes
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", transaction.walletAddress))
      .first();

    if (player) {
      if (args.status === "completed") {
        if (transaction.type === "deposit") {
          // Move from pending to game coins
          await ctx.db.patch(player._id, {
            gameCoins: player.gameCoins + transaction.amount,
            pendingCoins: Math.max(0, player.pendingCoins - transaction.amount),
          });
        }
        // For withdrawals, coins were already deducted when queued
      } else if (args.status === "failed") {
        if (transaction.type === "deposit") {
          // Remove from pending coins
          await ctx.db.patch(player._id, {
            pendingCoins: Math.max(0, player.pendingCoins - transaction.amount),
          });
        } else {
          // Refund withdrawal
          await ctx.db.patch(player._id, {
            gameCoins: player.gameCoins + transaction.amount,
            pendingCoins: Math.max(0, player.pendingCoins + transaction.amount),
          });
        }
      }
    }

    return transaction;
  },
});

export const getQueuedTransactions = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db
      .query("transactionQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    return transactions.sort((a, b) => b.priority - a.priority || a.queuedAt - b.queuedAt);
  },
});

export const getProcessingTransactions = query({
  args: {},
  handler: async (ctx) => {
    const transactions = await ctx.db
      .query("transactionQueue")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    return transactions;
  },
});

export const cleanupOldTransactions = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    const oldTransactions = await ctx.db
      .query("transactionQueue")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "completed"),
            q.eq(q.field("status"), "failed")
          ),
          q.lt(q.field("queuedAt"), cutoffTime)
        )
      )
      .collect();

    let deleted = 0;
    for (const transaction of oldTransactions) {
      await ctx.db.delete(transaction._id);
      deleted++;
    }

    return { deleted, message: `Cleaned up ${deleted} old transactions` };
  },
});