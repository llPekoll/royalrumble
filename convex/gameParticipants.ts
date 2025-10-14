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

    // Validate player exists
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }
    // NOTE: Balance check removed - SOL balance verified by smart contract
    // Player signs transaction via Privy, smart contract validates sufficient funds

    // Validate bet amount (lamports - 0.1 SOL = 10000, 10 SOL = 1000000)
    if (args.betAmount < 10000 || args.betAmount > 1000000) {
      throw new Error("Bet amount must be between 0.1 and 10 SOL");
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

    // Calculate size based on bet (lamports scale)
    // 0.1 SOL (10k lamports) = 1.05x size, 10 SOL (1M lamports) = 6.0x size
    const size = 1 + (args.betAmount / 1000000) * 5; // Size scales from 1.0 to 6.0

    // Create participant
    const participantId = await ctx.db.insert("gameParticipants", {
      gameId: args.gameId,
      playerId: args.playerId,
      walletAddress: args.walletAddress,
      characterId: args.characterId,
      betAmount: args.betAmount,
      betTimestamp: Date.now(),
      winChance: undefined, // Will be calculated later
      size,
      spawnIndex,
      position: { x: 0, y: 0 }, // Will be set when spawning
      targetPosition: undefined,
      eliminated: false,
      eliminatedAt: undefined,
      eliminatedBy: undefined,
      finalPosition: undefined,
      isWinner: undefined,
    });

    // NOTE: Coin deduction removed - SOL transferred via smart contract
    // Transaction signed by player via Privy, funds held in GamePool PDA

    // Update game totals
    const uniquePlayers = new Set(existingParticipants.map(p => p.playerId).filter(Boolean));
    uniquePlayers.add(args.playerId);

    await ctx.db.patch(args.gameId, {
      playersCount: uniquePlayers.size,
      entryPool: game.entryPool + args.betAmount,
    });

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

// NOTE: Bot participants removed - all participants are real players with SOL bets
