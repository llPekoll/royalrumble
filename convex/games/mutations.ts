import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Join game and place initial bet
export const joinGame = mutation({
  args: {
    walletAddress: v.string(),
    betAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate bet amount
    if (args.betAmount < 10 || args.betAmount > 10000) {
      throw new Error("Bet amount must be between 10 and 10,000 coins");
    }

    // Get current game in waiting phase
    const game = await ctx.db
      .query("games")
      .withIndex("by_status", (q: any) => q.eq("status", "waiting"))
      .first();

    if (!game) {
      throw new Error("No game available to join");
    }

    // Check if player already joined
    const existingParticipant = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game_wallet", (q: any) =>
        q.eq("gameId", game._id).eq("walletAddress", args.walletAddress)
      )
      .first();

    if (existingParticipant) {
      throw new Error("Already joined this game");
    }

    // Get player
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q: any) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    if (player.gameCoins < args.betAmount) {
      throw new Error("Insufficient game coins");
    }

    // Deduct coins
    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.betAmount,
      lastActive: Date.now(),
    });

    // Create participant using player's display name from database
    const participantId = await ctx.db.insert("gameParticipants", {
      gameId: game._id,
      playerId: player._id,
      walletAddress: args.walletAddress,
      displayName: player.displayName || `Player${args.walletAddress.slice(-4)}`,
      spriteIndex: Math.floor(Math.random() * 16), // Random sprite 0-15
      colorHue: Math.floor(Math.random() * 360),
      isBot: false,
      betAmount: args.betAmount,
      position: {
        x: Math.random() * 800, // Random starting position
        y: Math.random() * 600
      },
      eliminated: false,
    });

    // Create self bet
    await ctx.db.insert("bets", {
      gameId: game._id,
      playerId: player._id,
      walletAddress: args.walletAddress,
      betType: "self",
      targetParticipantId: participantId,
      amount: args.betAmount,
      status: "pending",
      placedAt: Date.now(),
    });

    // Update game stats
    await ctx.db.patch(game._id, {
      playerCount: game.playerCount + 1,
      totalPot: game.totalPot + args.betAmount,
    });

    return {
      gameId: game._id,
      participantId,
      message: "Successfully joined the game!"
    };
  },
});

// Place spectator bet on top 4
export const placeSpectatorBet = mutation({
  args: {
    walletAddress: v.string(),
    gameId: v.id("games"),
    targetParticipantId: v.id("gameParticipants"),
    betAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate bet amount
    if (args.betAmount < 10 || args.betAmount > 10000) {
      throw new Error("Bet amount must be between 10 and 10,000 coins");
    }

    // Get game
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "betting") {
      throw new Error("Game not in betting phase");
    }

    // Get player
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q: any) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    if (player.gameCoins < args.betAmount) {
      throw new Error("Insufficient game coins");
    }

    // Check target is in top 4
    const participant = await ctx.db.get(args.targetParticipantId);
    if (!participant || participant.eliminated) {
      throw new Error("Invalid bet target");
    }

    // Deduct coins
    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.betAmount,
      lastActive: Date.now(),
    });

    // Create spectator bet
    await ctx.db.insert("bets", {
      gameId: game._id,
      playerId: player._id,
      walletAddress: args.walletAddress,
      betType: "spectator",
      targetParticipantId: args.targetParticipantId,
      amount: args.betAmount,
      status: "pending",
      placedAt: Date.now(),
    });

    // Update game pot
    await ctx.db.patch(game._id, {
      totalPot: game.totalPot + args.betAmount,
    });

    return {
      message: "Spectator bet placed successfully!"
    };
  },
});