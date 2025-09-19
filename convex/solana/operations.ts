import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Initiate a deposit transaction
export const initiateDeposit = mutation({
  args: {
    walletAddress: v.string(),
    solAmount: v.number()
  },
  handler: async (ctx, args) => {
    const houseWallet = process.env.HOUSE_WALLET;
    if (!houseWallet) {
      throw new Error("House wallet not configured");
    }

    // Ensure player exists
    let player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      const playerId = await ctx.db.insert("players", {
        walletAddress: args.walletAddress,
        gameCoins: 0,
        pendingCoins: 0,
        lastActive: Date.now(),
      });
      player = await ctx.db.get(playerId);
    }

    // Convert SOL to game coins (1 SOL = 1000 coins)
    const gameCoins = Math.floor(args.solAmount * 1000);

    // Queue the deposit transaction
    const transactionId = await ctx.db.insert("transactionQueue", {
      walletAddress: args.walletAddress,
      amount: gameCoins,
      solAmount: args.solAmount,
      type: "deposit",
      status: "queued",
      queuedAt: Date.now(),
      priority: 1,
    });

    // Update pending coins for immediate UX feedback
    await ctx.db.patch(player!._id, {
      pendingCoins: player!.pendingCoins + gameCoins,
    });

    return {
      transactionId,
      gameCoins,
      houseWallet,
      message: `Send ${args.solAmount} SOL to ${houseWallet} to complete deposit`
    };
  },
});

// Initiate a withdrawal transaction
export const initiateWithdrawal = mutation({
  args: {
    walletAddress: v.string(),
    gameCoins: v.number()
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    if (player.gameCoins < args.gameCoins) {
      throw new Error("Insufficient game coins");
    }

    // Convert game coins to SOL (1000 coins = 1 SOL)
    const solAmount = args.gameCoins / 1000;

    // Queue the withdrawal transaction
    const transactionId = await ctx.db.insert("transactionQueue", {
      walletAddress: args.walletAddress,
      amount: args.gameCoins,
      solAmount: solAmount,
      type: "withdrawal",
      status: "queued",
      queuedAt: Date.now(),
      priority: 2, // Higher priority for withdrawals
    });

    // Deduct from game coins immediately
    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.gameCoins,
      pendingCoins: player.pendingCoins - args.gameCoins,
    });

    return {
      transactionId,
      solAmount,
      message: `Withdrawal of ${args.gameCoins} coins (${solAmount} SOL) queued for processing`
    };
  },
});