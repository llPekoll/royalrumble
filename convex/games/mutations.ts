import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Helper function to select a random active character
async function selectRandomCharacter(ctx: any) {
  const activeCharacters = await ctx.db
    .query("characters")
    .withIndex("by_active")
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .collect();

  if (activeCharacters.length === 0) {
    throw new Error("No active characters available");
  }

  // For now, simple random selection (could add rarity-based weights later)
  const randomIndex = Math.floor(Math.random() * activeCharacters.length);
  return activeCharacters[randomIndex];
}

// Join game and place initial bet
export const joinGame = mutation({
  args: {
    walletAddress: v.string(),
    betAmount: v.number(),
    characterId: v.optional(v.id("characters")), // Optional - random if not provided
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

    // Get or select character
    let character;
    if (args.characterId) {
      character = await ctx.db.get(args.characterId);
      if (!character || !character.isActive) {
        throw new Error("Invalid or inactive character selected");
      }
    } else {
      character = await selectRandomCharacter(ctx);
    }

    // Get existing participants to see which spawn positions are taken
    const existingParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
      .collect();
    
    const usedSpawnIndices = new Set(existingParticipants.map((p: any) => p.spawnIndex));

    // Find next available spawn position
    let spawnIndex = 0;
    while (usedSpawnIndices.has(spawnIndex) && spawnIndex < game.spawnPositions.length) {
      spawnIndex++;
    }
    
    if (spawnIndex >= game.spawnPositions.length) {
      throw new Error("Game is full - no available spawn positions");
    }
    
    const spawnPos = game.spawnPositions[spawnIndex];

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
      characterId: character._id,
      colorHue: Math.floor(Math.random() * 360),
      isBot: false,
      betAmount: args.betAmount,
      spawnIndex,
      position: { x: spawnPos.x, y: spawnPos.y },
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