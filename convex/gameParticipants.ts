import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Add a participant to a game (player can add multiple)
export const addParticipant = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    walletAddress: v.string(),
    characterId: v.id("characters"),
    betAmount: v.number(),
    displayName: v.optional(v.string()),
    colorHue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate game exists and is in waiting phase
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.status !== "waiting") {
      throw new Error("Game is not accepting new participants");
    }

    // Validate player has enough coins
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }
    if (player.gameCoins < args.betAmount) {
      throw new Error("Insufficient game coins");
    }

    // Validate bet amount
    if (args.betAmount < 10 || args.betAmount > 10000) {
      throw new Error("Bet amount must be between 10 and 10,000 coins");
    }

    // Check map participant limit
    const map = await ctx.db.get(game.mapId);
    if (!map) {
      throw new Error("Map not found");
    }

    const existingParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    if (existingParticipants.length >= map.spawnConfiguration.maxPlayers) {
      throw new Error("Game is full");
    }

    // Calculate spawn index
    const spawnIndex = existingParticipants.length;

    // Calculate size and power based on bet
    const size = 1 + (args.betAmount / 1000) * 0.5; // Size scales from 1 to 1.5
    const character = await ctx.db.get(args.characterId);
    const basePower = character?.baseStats?.power || 1;
    const power = args.betAmount * basePower;

    // Create participant
    const participantId = await ctx.db.insert("gameParticipants", {
      gameId: args.gameId,
      playerId: args.playerId,
      walletAddress: args.walletAddress,
      displayName: args.displayName || player.displayName || `Player ${spawnIndex + 1}`,
      characterId: args.characterId,
      colorHue: args.colorHue || Math.random() * 360,
      isBot: false,
      betAmount: args.betAmount,
      size,
      power,
      spawnIndex,
      position: { x: 0, y: 0 }, // Will be set when spawning
      targetPosition: undefined,
      eliminated: false,
      eliminatedAt: undefined,
      eliminatedBy: undefined,
      finalPosition: undefined,
      spectatorBets: 0,
    });

    // Deduct coins from player
    await ctx.db.patch(args.playerId, {
      gameCoins: player.gameCoins - args.betAmount,
    });

    // Update game totals
    await ctx.db.patch(args.gameId, {
      participantCount: existingParticipants.length + 1,
      totalPot: game.totalPot + args.betAmount,
      selfBetPool: game.selfBetPool + args.betAmount,
    });

    // Check if this is the first human player
    const humanParticipants = existingParticipants.filter(p => !p.isBot);
    if (humanParticipants.length === 0) {
      await ctx.db.patch(args.gameId, {
        playerCount: 1,
        isSinglePlayer: true,
      });
    } else {
      // Check if different player
      const uniquePlayers = new Set(humanParticipants.map(p => p.playerId));
      uniquePlayers.add(args.playerId);
      await ctx.db.patch(args.gameId, {
        playerCount: uniquePlayers.size,
        isSinglePlayer: uniquePlayers.size === 1,
      });
    }

    return participantId;
  },
});

// Get all participants for a game
export const getGameParticipants = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Fetch character data for each participant
    const participantsWithData = await Promise.all(
      participants.map(async (participant) => {
        const character = await ctx.db.get(participant.characterId);
        const player = participant.playerId ? await ctx.db.get(participant.playerId) : null;
        return {
          ...participant,
          character,
          player,
        };
      })
    );

    return participantsWithData;
  },
});

// Get player's participants in a game
export const getPlayerParticipants = query({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("playerId"), args.playerId))
      .collect();

    return participants;
  },
});

// Update participant position
export const updatePosition = mutation({
  args: {
    participantId: v.id("gameParticipants"),
    position: v.object({ x: v.number(), y: v.number() }),
    targetPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, {
      position: args.position,
      targetPosition: args.targetPosition,
    });
  },
});

// Eliminate participant
export const eliminateParticipant = mutation({
  args: {
    participantId: v.id("gameParticipants"),
    eliminatedBy: v.optional(v.id("gameParticipants")),
    finalPosition: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, {
      eliminated: true,
      eliminatedAt: Date.now(),
      eliminatedBy: args.eliminatedBy,
      finalPosition: args.finalPosition,
    });
  },
});

// Get survivors (non-eliminated participants)
export const getSurvivors = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const survivors = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game_eliminated", (q) =>
        q.eq("gameId", args.gameId).eq("eliminated", false)
      )
      .collect();

    return survivors;
  },
});

// Add bot participant
export const addBotParticipant = mutation({
  args: {
    gameId: v.id("games"),
    botName: v.string(),
    characterId: v.id("characters"),
    betAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const existingParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const spawnIndex = existingParticipants.length;
    const size = 1 + (args.betAmount / 1000) * 0.5;
    const character = await ctx.db.get(args.characterId);
    const basePower = character?.baseStats?.power || 1;
    const power = args.betAmount * basePower;

    const participantId = await ctx.db.insert("gameParticipants", {
      gameId: args.gameId,
      playerId: undefined,
      walletAddress: undefined,
      displayName: args.botName,
      characterId: args.characterId,
      colorHue: Math.random() * 360,
      isBot: true,
      betAmount: args.betAmount,
      size,
      power,
      spawnIndex,
      position: { x: 0, y: 0 },
      targetPosition: undefined,
      eliminated: false,
      eliminatedAt: undefined,
      eliminatedBy: undefined,
      finalPosition: undefined,
      spectatorBets: 0,
    });

    // Update game participant count
    await ctx.db.patch(args.gameId, {
      participantCount: existingParticipants.length + 1,
    });

    return participantId;
  },
});
