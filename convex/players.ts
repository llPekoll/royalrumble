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

// Get player with current character
export const getPlayerWithCharacter = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      return null;
    }

    let character = null;
    if (player.currentCharacterId) {
      character = await ctx.db.get(player.currentCharacterId);
    }

    return {
      ...player,
      currentCharacter: character,
    };
  },
});

export const createPlayer = mutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (existingPlayer) {
      return existingPlayer._id;
    }

    // Get a random character for new player
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    let randomCharacterId = null;
    if (characters.length > 0) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomCharacterId = characters[randomIndex]._id;
    }

    const playerId = await ctx.db.insert("players", {
      walletAddress: args.walletAddress,
      displayName: args.displayName,
      gameCoins: 1000, // Start with 1000 coins
      pendingCoins: 0, // Start with 0 pending coins
      lastActive: Date.now(),
      currentCharacterId: randomCharacterId as any,
      characterRerolls: 0,
      lastRerollTime: undefined,
      totalGamesPlayed: 0,
      totalWins: 0,
      totalEarnings: 0,
      achievements: [],
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

export const updateDisplayName = mutation({
  args: {
    walletAddress: v.string(),
    displayName: v.string()
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    // Validate display name
    const trimmedName = args.displayName.trim();
    if (trimmedName.length < 3) {
      throw new Error("Display name must be at least 3 characters long");
    }
    if (trimmedName.length > 20) {
      throw new Error("Display name must be less than 20 characters");
    }

    await ctx.db.patch(player._id, {
      displayName: trimmedName,
      lastActive: Date.now(),
    });

    return trimmedName;
  },
});

// Reroll current character (limited uses per day)
export const rerollCharacter = mutation({
  args: {
    walletAddress: v.string(),
    cost: v.optional(v.number()), // Cost in game coins
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    // Check daily reroll limit (max 3 per day)
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    if (player.lastRerollTime && player.lastRerollTime > oneDayAgo) {
      if (player.characterRerolls >= 3) {
        throw new Error("Daily reroll limit reached (3 per day)");
      }
    }

    const cost = args.cost || 100; // Default cost 100 coins
    if (player.gameCoins < cost) {
      throw new Error("Insufficient game coins for reroll");
    }

    // Get a random character (different from current)
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const availableCharacters = characters.filter(c => c._id !== player.currentCharacterId);

    if (availableCharacters.length === 0) {
      throw new Error("No other characters available");
    }

    const randomIndex = Math.floor(Math.random() * availableCharacters.length);
    const newCharacter = availableCharacters[randomIndex];

    // Reset daily counter if it's a new day
    const isNewDay = !player.lastRerollTime || player.lastRerollTime <= oneDayAgo;
    const newRerollCount = isNewDay ? 1 : player.characterRerolls + 1;

    await ctx.db.patch(player._id, {
      currentCharacterId: newCharacter._id,
      gameCoins: player.gameCoins - cost,
      characterRerolls: newRerollCount,
      lastRerollTime: now,
      lastActive: now,
    });

    return {
      newCharacter,
      rerollsRemaining: 3 - newRerollCount,
      coinsRemaining: player.gameCoins - cost,
    };
  },
});

// Update player statistics after game
export const updatePlayerStats = mutation({
  args: {
    playerId: v.id("players"),
    won: v.boolean(),
    earnings: v.number(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    await ctx.db.patch(args.playerId, {
      totalGamesPlayed: player.totalGamesPlayed + 1,
      totalWins: player.totalWins + (args.won ? 1 : 0),
      totalEarnings: player.totalEarnings + args.earnings,
      lastActive: Date.now(),
    });
  },
});

// Add pending coins (typically from deposits)
export const addPendingCoins = mutation({
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
      pendingCoins: player.pendingCoins + args.amount,
      lastActive: Date.now(),
    });

    return player.pendingCoins + args.amount;
  },
});

// Process pending coins into game coins (when transaction is confirmed)
export const processPendingCoins = mutation({
  args: {
    walletAddress: v.string(),
    amount: v.optional(v.number()) // If not specified, processes all pending coins
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    const amountToProcess = args.amount || player.pendingCoins;
    
    if (player.pendingCoins < amountToProcess) {
      throw new Error("Insufficient pending coins");
    }

    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins + amountToProcess,
      pendingCoins: player.pendingCoins - amountToProcess,
      lastActive: Date.now(),
    });

    return {
      gameCoins: player.gameCoins + amountToProcess,
      pendingCoins: player.pendingCoins - amountToProcess,
      processedAmount: amountToProcess,
    };
  },
});

// Add achievement to player
export const addAchievement = mutation({
  args: {
    playerId: v.id("players"),
    achievementId: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    const achievements = player.achievements || [];
    if (!achievements.includes(args.achievementId)) {
      achievements.push(args.achievementId);

      await ctx.db.patch(args.playerId, {
        achievements,
      });
    }
  },
});
