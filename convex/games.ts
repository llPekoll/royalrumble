import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Game phase durations in seconds
export const PHASE_DURATIONS = {
  WAITING: 30,    // Wait for players to join
  RUNNING: 10,    // Arena/battle phase
  TOP4: 15,       // Top 4 betting phase
  BATTLE: 15,     // Final battle
  RESULTS: 5,     // Show winner
};

// Bot names for demo/single-player mode
export const BOT_NAMES = [
  "Shadow", "Blaze", "Frost", "Thunder", "Viper", "Phoenix", "Storm", "Titan",
  "Ghost", "Spark", "Crusher", "Ninja", "Savage", "Fury", "Chaos", "Doom"
];

// Get current active game
export const getCurrentGame = query({
  args: {},
  handler: async (ctx) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) =>
        q.neq(q.field("status"), "completed")
      )
      .order("desc")
      .first();

    if (!game) return null;

    // Get map data
    const map = await ctx.db.get(game.mapId);

    // Get participants
    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
      .collect();

    // Get character data for each participant
    const participantsWithCharacters = await Promise.all(
      participants.map(async (participant) => {
        const character = await ctx.db.get(participant.characterId);
        let player = null;
        if (participant.playerId) {
          player = await ctx.db.get(participant.playerId);
        }
        return {
          ...participant,
          character,
          player,
        };
      })
    );

    // Calculate time remaining for current phase
    const timeRemaining = Math.max(0, game.nextPhaseTime - Date.now());

    // Determine if it's a small game based on participant count
    const isSmallGame = participantsWithCharacters.length < 8;

    return {
      ...game,
      map,
      participants: participantsWithCharacters,
      timeRemaining,
      isSmallGame,
    };
  },
});

// Get game by ID
export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
      .collect();

    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
      .collect();

    const map = await ctx.db.get(game.mapId);

    return {
      ...game,
      participants,
      bets,
      map,
    };
  },
});

// Get recent games
export const getRecentGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const games = await ctx.db
      .query("games")
      .withIndex("by_start_time")
      .order("desc")
      .take(limit);

    return games;
  },
});

// Create a new game
export const createNewGame = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if there's already an active game
    const activeGame = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .first();

    if (activeGame) {
      return activeGame._id;
    }

    // Get random map
    const maps = await ctx.db
      .query("maps")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    if (maps.length === 0) {
      throw new Error("No active maps available");
    }

    const randomMap = maps[Math.floor(Math.random() * maps.length)];
    const now = Date.now();

    const gameId = await ctx.db.insert("games", {
      status: "waiting",
      phase: 1,
      startTime: now,
      endTime: undefined,
      phaseStartTime: now,
      nextPhaseTime: now + (PHASE_DURATIONS.WAITING * 1000),
      playerCount: 0,
      participantCount: 0,
      totalPot: 0,
      selfBetPool: 0,
      spectatorBetPool: 0,
      winnerId: undefined,
      isSinglePlayer: false,
      isSmallGame: true, // Will be updated as participants join
      mapId: randomMap._id,
      survivorIds: undefined,
      blockchainCallStatus: "none",
      blockchainCallStartTime: undefined,
    });

    return gameId;
  },
});



export const getPlayerGames = query({
  args: { walletAddress: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get player's bets
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_wallet", (q: any) => q.eq("walletAddress", args.walletAddress))
      .order("desc")
      .take(limit);

    // Get unique game IDs
    const gameIds = [...new Set(bets.map(b => b.gameId))];

    // Get games
    const games = await Promise.all(
      gameIds.map(id => ctx.db.get(id))
    );

    return games.filter(Boolean);
  },
});

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

    // const usedSpawnIndices = new Set(existingParticipants.map((p: any) => p.spawnIndex));

    // For now, assign a simple circular spawn position since spawnPositions isn't in schema
    const mapData = await ctx.db.get(game.mapId);
    if (!mapData) throw new Error("Map not found");

    // Calculate spawn position based on map configuration
    const spawnIndex = existingParticipants.length;
    const angleStep = (Math.PI * 2) / mapData.spawnConfiguration.maxPlayers;
    const angle = spawnIndex * angleStep;
    const radius = mapData.spawnConfiguration.spawnRadius;

    // Center position (assuming 400x300 arena)
    const centerX = 400;
    const centerY = 300;
    const spawnPos = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };

    // Deduct coins
    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.betAmount,
      lastActive: Date.now(),
    });

    // Calculate size and power based on bet amount
    const size = Math.max(0.8, Math.min(2.0, args.betAmount / 1000)); // Size from 0.8x to 2.0x
    const basePower = character.baseStats?.power || 100;
    const power = basePower * (args.betAmount / 100); // Power scales with bet

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
      size,
      power,
      spawnIndex,
      position: { x: spawnPos.x, y: spawnPos.y },
      eliminated: false,
      spectatorBets: 0,
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

    // Update game stats and check if it's still a small game
    const updatedParticipantCount = game.participantCount + 1;
    await ctx.db.patch(game._id, {
      playerCount: game.playerCount + 1,
      participantCount: updatedParticipantCount,
      totalPot: game.totalPot + args.betAmount,
      selfBetPool: game.selfBetPool + args.betAmount,
      isSmallGame: updatedParticipantCount < 8,
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
      spectatorBetPool: game.spectatorBetPool + args.betAmount,
    });

    return {
      message: "Spectator bet placed successfully!"
    };
  },
});

// Helper: Add bots to game
export async function addBots(ctx: any, gameId: Id<"games">, count: number) {
  const game = await ctx.db.get(gameId);
  if (!game) throw new Error("Game not found");

  const usedNames = new Set<string>();

  // Get existing participants to see which spawn positions are taken
  const existingParticipants = await ctx.db
    .query("gameParticipants")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  // const usedSpawnIndices = new Set(existingParticipants.map((p: any) => p.spawnIndex));

  for (let i = 0; i < count; i++) {
    let botName: string;
    do {
      botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    } while (usedNames.has(botName));
    usedNames.add(botName);

    const betAmount = Math.floor(Math.random() * 500) + 50; // 50-550 coins

    // Select a random character
    const character = await selectRandomCharacter(ctx);

    // Calculate spawn position for bot
    const mapData = await ctx.db.get(game.mapId);
    if (!mapData) throw new Error("Map not found");

    const spawnIndex = existingParticipants.length + i;
    const angleStep = (Math.PI * 2) / mapData.spawnConfiguration.maxPlayers;
    const angle = spawnIndex * angleStep;
    const radius = mapData.spawnConfiguration.spawnRadius;

    const centerX = 400;
    const centerY = 300;
    const spawnPos = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };

    // Calculate size and power for bot
    const size = Math.max(0.8, Math.min(2.0, betAmount / 1000));
    const basePower = character.baseStats?.power || 100;
    const power = basePower * (betAmount / 100);

    await ctx.db.insert("gameParticipants", {
      gameId,
      displayName: botName,
      characterId: character._id,
      colorHue: Math.floor(Math.random() * 360),
      isBot: true,
      betAmount,
      size,
      power,
      spawnIndex,
      position: { x: spawnPos.x, y: spawnPos.y },
      eliminated: false,
      spectatorBets: 0,
    });
  }
}

// Helper: Eliminate to finalists (top 2 or top 4)
export async function eliminateToFinalists(ctx: any, gameId: Id<"games">, finalistCount: number) {
  const participants = await ctx.db
    .query("gameParticipants")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  if (participants.length <= finalistCount) {
    // If already at or below finalist count, nobody gets eliminated
    return;
  }

  // Calculate survival weights with randomness
  const weights = participants.map((p: any) => {
    // Base survival weight from bet amount (square root to reduce dominance)
    const baseWeight = Math.sqrt(p.betAmount);

    // Add random factor (30-70% of base weight for more chaos)
    const randomFactor = 0.3 + (Math.random() * 0.4);
    const randomBonus = baseWeight * randomFactor;

    return {
      participant: p,
      weight: baseWeight + randomBonus,
    };
  });

  // Sort by final weight (higher survives)
  weights.sort((a: any, b: any) => b.weight - a.weight);

  // Top finalists by weight survive, rest are eliminated
  for (let i = 0; i < weights.length; i++) {
    const { participant } = weights[i];

    if (i >= finalistCount) {
      await ctx.db.patch(participant._id, {
        eliminated: true,
        eliminatedAt: Date.now(),
        finalPosition: weights.length - i + 1, // 3rd place, 4th place, etc.
      });
    }
  }
}

// Helper: Determine winner
export async function determineWinner(ctx: any, gameId: Id<"games">) {
  const game = await ctx.db.get(gameId);
  if (!game) return;

  const participants = await ctx.db
    .query("gameParticipants")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .filter((q: any) => q.eq(q.field("eliminated"), false))
    .collect();

  if (participants.length === 0) return;

  let winner: typeof participants[0];

  if (game.isSinglePlayer) {
    // In single player mode, human always wins
    winner = participants.find((p: any) => !p.isBot) || participants[0];
  } else {
    // Calculate weighted probabilities with randomness
    const weights = participants.map((p: any) => {
      // Base weight from bet amount (square root to reduce dominance)
      const baseWeight = Math.sqrt(p.betAmount);

      // Add random factor (20-80% of base weight)
      const randomFactor = 0.2 + (Math.random() * 0.6);
      const randomBonus = baseWeight * randomFactor;

      // Final weight = base + random bonus
      return {
        participant: p,
        weight: baseWeight + randomBonus,
      };
    });

    // Calculate total weight for probability calculation
    const totalWeight = weights.reduce((sum: number, w: any) => sum + w.weight, 0);

    // Create probability distribution
    const probabilities = weights.map((w: any) => ({
      participant: w.participant,
      probability: w.weight / totalWeight,
    }));

    // Random selection with weighted probabilities
    const random = Math.random();
    let cumulative = 0;

    for (const { participant, probability } of probabilities) {
      cumulative += probability;
      if (random <= cumulative) {
        winner = participant;
        break;
      }
    }

    // Fallback to highest bet if somehow no winner selected
    winner = winner! || participants.sort((a: any, b: any) => b.betAmount - a.betAmount)[0];
  }

  // Update winner and losers
  for (const participant of participants) {
    if (participant._id === winner._id) {
      await ctx.db.patch(participant._id, {
        finalPosition: 1,
      });
      await ctx.db.patch(gameId, {
        winnerId: winner._id,
      });
    } else {
      await ctx.db.patch(participant._id, {
        eliminated: true,
        eliminatedAt: Date.now(),
        finalPosition: 2, // All others tie for 2nd in final battle
      });
    }
  }
}

// Helper: Process payouts
export async function processPayouts(ctx: any, gameId: Id<"games">) {
  const game = await ctx.db.get(gameId);
  if (!game || !game.winnerId) return;

  const winner = await ctx.db.get(game.winnerId);
  if (!winner) return;

  const bets = await ctx.db
    .query("bets")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  if (game.isSinglePlayer && !winner.isBot) {
    // Single player mode - refund all bets
    for (const bet of bets) {
      await ctx.db.patch(bet._id, {
        payout: bet.amount,
        status: "refunded",
        settledAt: Date.now(),
      });

      if (bet.playerId) {
        const player = await ctx.db.get(bet.playerId);
        if (player) {
          await ctx.db.patch(player._id, {
            gameCoins: player.gameCoins + bet.amount,
            totalGames: (player.totalGames || 0) + 1,
          });
        }
      }
    }
    return;
  }

  // Separate bets by type
  const selfBets = bets.filter((b: any) => b.betType === "self");
  const spectatorBets = bets.filter((b: any) => b.betType === "spectator");

  // Calculate total pools
  const selfBetPool = selfBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
  const spectatorBetPool = spectatorBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);

  // Calculate winning bets
  const winningSelfBets = selfBets.filter((b: any) => b.targetParticipantId === game.winnerId);
  const winningSpectatorBets = spectatorBets.filter((b: any) => b.targetParticipantId === game.winnerId);

  // Calculate total winning amounts
  const totalWinningSelf = winningSelfBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
  const totalWinningSpectator = winningSpectatorBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);

  // Calculate payable pools (95% of total, 5% house edge)
  const payableSelfPool = Math.floor(selfBetPool * 0.95);
  const payableSpectatorPool = Math.floor(spectatorBetPool * 0.95);

  // Process self bets (main game bets)
  for (const bet of selfBets) {
    let payout = 0;
    let status: "won" | "lost" = "lost";

    if (bet.targetParticipantId === game.winnerId) {
      // Winner gets proportional share of 95% of the self bet pool
      if (totalWinningSelf > 0) {
        const share = bet.amount / totalWinningSelf;
        payout = Math.floor(payableSelfPool * share);
        status = "won";
      }
    }

    await ctx.db.patch(bet._id, {
      payout,
      status,
      settledAt: Date.now(),
    });

    // Credit winnings
    if (payout > 0 && bet.playerId) {
      const player = await ctx.db.get(bet.playerId);
      if (player) {
        await ctx.db.patch(player._id, {
          gameCoins: player.gameCoins + payout,
          totalWins: (player.totalWins || 0) + (status === "won" ? 1 : 0),
          totalGames: (player.totalGames || 0) + 1,
          totalEarnings: (player.totalEarnings || 0) + Math.max(0, payout - bet.amount),
        });
      }
    }
  }

  // Process spectator bets (top 4 betting phase)
  for (const bet of spectatorBets) {
    let payout = 0;
    let status: "won" | "lost" = "lost";

    if (bet.targetParticipantId === game.winnerId) {
      // Winner gets proportional share of 95% of the spectator bet pool
      if (totalWinningSpectator > 0) {
        const share = bet.amount / totalWinningSpectator;
        payout = Math.floor(payableSpectatorPool * share);
        status = "won";
      }
    }

    await ctx.db.patch(bet._id, {
      payout,
      status,
      settledAt: Date.now(),
    });

    // Credit winnings
    if (payout > 0 && bet.playerId) {
      const player = await ctx.db.get(bet.playerId);
      if (player) {
        await ctx.db.patch(player._id, {
          gameCoins: player.gameCoins + payout,
          totalWins: (player.totalWins || 0) + (status === "won" ? 1 : 0),
          totalGames: (player.totalGames || 0) + 1,
          totalEarnings: (player.totalEarnings || 0) + Math.max(0, payout - bet.amount),
        });
      }
    }
  }
}


// Helper function to select a random active map
async function selectRandomMap(ctx: any) {
  const activeMaps = await ctx.db
    .query("maps")
    .withIndex("by_active", (q: any) => q.eq("isActive", true))
    .collect();

  if (activeMaps.length === 0) {
    throw new Error("No active maps available");
  }

  // Simple random selection (no weight field in schema)
  const randomIndex = Math.floor(Math.random() * activeMaps.length);
  return activeMaps[randomIndex];
}


// Advance game phase (internal, called by cron)
export const advanceGamePhase = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status === "completed") return;

    const now = Date.now();
    let nextStatus = game.status;
    let nextPhase = game.phase;
    let nextPhaseTime = now;

    switch (game.status) {
      case "waiting": {
        const participants = await ctx.db
          .query("gameParticipants")
          .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
          .filter((q) => q.eq(q.field("isBot"), false))
          .collect();

        if (participants.length === 0) {
          // No players, convert to demo mode
          await addBots(ctx, args.gameId, 8);
          nextStatus = "arena";
          nextPhase = 2;
          nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

          const totalParticipants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
            .collect();

          await ctx.db.patch(args.gameId, {
            isSinglePlayer: false, // Demo mode
            isSmallGame: totalParticipants.length < 8,
            participantCount: totalParticipants.length,
            status: nextStatus,
            phase: nextPhase,
            phaseStartTime: now,
            nextPhaseTime,
          });
        } else if (participants.length === 1) {
          // Single player mode
          await addBots(ctx, args.gameId, 7);
          nextStatus = "arena";
          nextPhase = 2;
          nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

          const totalParticipants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
            .collect();

          await ctx.db.patch(args.gameId, {
            isSinglePlayer: true,
            isSmallGame: totalParticipants.length < 8,
            participantCount: totalParticipants.length,
            status: nextStatus,
            phase: nextPhase,
            phaseStartTime: now,
            nextPhaseTime,
          });
        } else {
          // Normal multiplayer game
          nextStatus = "arena";
          nextPhase = 2;
          nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

          const totalParticipants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
            .collect();

          await ctx.db.patch(args.gameId, {
            isSmallGame: totalParticipants.length < 8,
            participantCount: totalParticipants.length,
            status: nextStatus,
            phase: nextPhase,
            phaseStartTime: now,
            nextPhaseTime,
          });
        }
        break;
      }

      case "arena": {
        const arenaParticipants = await ctx.db
          .query("gameParticipants")
          .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
          .filter((q: any) => q.eq(q.field("eliminated"), false))
          .collect();

        if (arenaParticipants.length < 8) {
          // For less than 8 players, skip TOP4 and BATTLE phases
          // Go straight to determining winner
          await determineWinner(ctx, args.gameId);
          nextStatus = "results";
          nextPhase = 3; // Phase 3 in the 3-phase system
          nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
        } else {
          // 8 or more players: eliminate to top 4 for betting phase
          await eliminateToFinalists(ctx, args.gameId, 4);
          nextStatus = "betting";
          nextPhase = 3;
          nextPhaseTime = now + (PHASE_DURATIONS.TOP4 * 1000);
        }
        break;
      }

      case "betting":
        nextStatus = "battle";
        nextPhase = 4;
        nextPhaseTime = now + (PHASE_DURATIONS.BATTLE * 1000);
        break;

      case "battle":
        // Determine winner
        await determineWinner(ctx, args.gameId);
        nextStatus = "results";
        nextPhase = 5;
        nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
        break;

      case "results":
        // Process payouts
        await processPayouts(ctx, args.gameId);
        nextStatus = "completed" as any;
        nextPhase = 6;

        await ctx.db.patch(args.gameId, {
          status: nextStatus,
          phase: nextPhase,
          endTime: now,
        });
        return;
    }

    // Update game phase
    await ctx.db.patch(args.gameId, {
      status: nextStatus,
      phase: nextPhase,
      phaseStartTime: now,
      nextPhaseTime,
    });
  },
});

// Clean up old completed games (called by cron)
export const cleanupOldGames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - (3 * 24 * 60 * 60 * 1000); // 3 days ago

    // Find old completed games
    const oldGames = await ctx.db
      .query("games")
      .withIndex("by_start_time")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("status"), "completed"),
          q.lt(q.field("startTime"), cutoffTime)
        )
      )
      .collect();

    let deletedGames = 0;
    let deletedParticipants = 0;
    let deletedBets = 0;

    for (const game of oldGames) {
      // Delete related participants
      const participants = await ctx.db
        .query("gameParticipants")
        .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
        .collect();

      for (const p of participants) {
        await ctx.db.delete(p._id);
        deletedParticipants++;
      }

      // Delete related bets
      const bets = await ctx.db
        .query("bets")
        .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
        .collect();

      for (const b of bets) {
        await ctx.db.delete(b._id);
        deletedBets++;
      }

      // Delete the game itself
      await ctx.db.delete(game._id);
      deletedGames++;
    }

    if (deletedGames > 0) {
      console.log(`Cleaned up ${deletedGames} old games, ${deletedParticipants} participants, ${deletedBets} bets (older than 3 days)`);
    }

    return {
      deletedGames,
      deletedParticipants,
      deletedBets,
      message: `Cleaned up ${deletedGames} games older than 3 days`
    };
  },
});

// Public mutation to start blockchain call (called by frontend)
export const triggerBlockchainCall = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "arena" || game.blockchainCallStatus !== "none") return;

    const now = Date.now();
    await ctx.db.patch(args.gameId, {
      blockchainCallStatus: "pending",
      blockchainCallStartTime: now,
    });

    console.log(`Frontend triggered blockchain call for game ${args.gameId}`);
  },
});

// Start blockchain call for winner determination (internal)
export const startBlockchainCall = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "arena") return;

    const now = Date.now();
    await ctx.db.patch(args.gameId, {
      blockchainCallStatus: "pending",
      blockchainCallStartTime: now,
    });

    console.log(`Started blockchain call for game ${args.gameId}`);
  },
});

// Complete blockchain call and determine winner
export const completeBlockchainCall = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.blockchainCallStatus !== "pending") return;

    // Determine the winner using existing logic
    await determineWinner(ctx, args.gameId);

    // Mark blockchain call as completed
    await ctx.db.patch(args.gameId, {
      blockchainCallStatus: "completed",
    });

    console.log(`Completed blockchain call for game ${args.gameId}`);
  },
});

// Simulate blockchain call processing (called by cron every 5 seconds)
export const processBlockchainCalls = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find games with pending blockchain calls
    const gamesWithPendingCalls = await ctx.db
      .query("games")
      .withIndex("by_status", (q: any) => q.eq("status", "arena"))
      .filter((q: any) => q.eq(q.field("blockchainCallStatus"), "pending"))
      .collect();

    const now = Date.now();

    for (const game of gamesWithPendingCalls) {
      if (!game.blockchainCallStartTime) continue;

      // Simulate blockchain call taking 3-8 seconds to complete
      const callDuration = now - game.blockchainCallStartTime;
      const minDuration = 3000; // 3 seconds minimum

      // Simple simulation: complete after minimum time + random factor
      if (callDuration >= minDuration) {
        const shouldComplete = Math.random() > 0.3; // 70% chance per check
        if (shouldComplete) {
          await ctx.db.patch(game._id, {
            blockchainCallStatus: "completed",
          });

          // Determine winner
          await determineWinner(ctx, game._id);
          console.log(`Blockchain call completed for game ${game._id} after ${callDuration}ms`);
        }
      }
    }
  },
});

// Main game loop (called by cron every 10 seconds)
export const gameLoop = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check for active game
    const activeGame = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .first();

    const now = Date.now();

    if (!activeGame) {
      // Check if we recently had a game deleted (to avoid rapid game creation)
      const recentGames = await ctx.db
        .query("games")
        .withIndex("by_start_time")
        .order("desc")
        .take(5);

      // If the last game was very recent (within 10 seconds), don't create immediately
      const lastGameTime = recentGames.length > 0 ? recentGames[0].startTime : 0;
      const timeSinceLastGame = now - lastGameTime;

      // Only create a new game if enough time has passed (10 seconds = 10,000ms)
      // or if there was no recent game
      if (timeSinceLastGame > 10000 || recentGames.length === 0) {
        // Select a random map
        const selectedMap = await selectRandomMap(ctx);

        await ctx.db.insert("games", {
          status: "waiting",
          phase: 1,
          phaseStartTime: now,
          nextPhaseTime: now + (PHASE_DURATIONS.WAITING * 1000),
          startTime: now,
          playerCount: 0,
          participantCount: 0,
          totalPot: 0,
          selfBetPool: 0,
          spectatorBetPool: 0,
          isSinglePlayer: false,
          isSmallGame: true,
          mapId: selectedMap._id,
          blockchainCallStatus: "none",
          blockchainCallStartTime: undefined,
        });

        console.log("Created new game");
      } else {
        console.log(`Waiting ${Math.ceil((10000 - timeSinceLastGame) / 1000)}s before creating new game`);
      }
      return;
    }

    // Check if current phase time is up
    if (now >= activeGame.nextPhaseTime) {
      // Inline phase advancement logic
      let nextStatus: any = activeGame.status;
      let nextPhase = activeGame.phase;
      let nextPhaseTime = now;

      switch (activeGame.status) {
        case "waiting": {
          const participants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", activeGame._id))
            .filter((q: any) => q.eq(q.field("isBot"), false))
            .collect();

          if (participants.length === 0) {
            // No players after 30s - delete the game to save database space
            console.log(`Deleting empty game ${activeGame._id} - no players joined`);

            // Delete any related data first (shouldn't be any, but just in case)
            const allParticipants = await ctx.db
              .query("gameParticipants")
              .withIndex("by_game", (q: any) => q.eq("gameId", activeGame._id))
              .collect();

            for (const p of allParticipants) {
              await ctx.db.delete(p._id);
            }

            // Delete the game
            await ctx.db.delete(activeGame._id);
            return; // Exit early, don't create a new game yet
          } else if (participants.length === 1) {
            // Single player mode
            await addBots(ctx, activeGame._id, 7);
            nextStatus = "arena";
            nextPhase = 2;
            nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

            await ctx.db.patch(activeGame._id, {
              isSinglePlayer: true,
              status: nextStatus,
              phase: nextPhase,
              phaseStartTime: now,
              nextPhaseTime,
            });
          } else {
            // Normal multiplayer game
            nextStatus = "arena";
            nextPhase = 2;
            nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

            await ctx.db.patch(activeGame._id, {
              status: nextStatus,
              phase: nextPhase,
              phaseStartTime: now,
              nextPhaseTime,
            });
          }
          break;
        }

        case "arena": {
          const arenaParticipants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", activeGame._id))
            .filter((q: any) => q.eq(q.field("eliminated"), false))
            .collect();

          if (arenaParticipants.length < 8) {
            // Small games: Check blockchain call status
            if (activeGame.blockchainCallStatus === "none") {
              // No blockchain call started yet - don't advance phase yet
              // The blockchain call will be started by frontend after players move to center
              console.log(`Small game ${activeGame._id}: waiting for blockchain call to start`);
              return; // Don't advance phase, wait for blockchain call
            } else if (activeGame.blockchainCallStatus === "pending") {
              // Blockchain call is pending - don't advance phase yet
              console.log(`Small game ${activeGame._id}: blockchain call pending, holding arena phase`);
              return; // Don't advance phase, wait for blockchain call completion
            } else if (activeGame.blockchainCallStatus === "completed") {
              // Blockchain call completed, winner determined - advance to results
              nextStatus = "results";
              nextPhase = 3; // Phase 3 in the 3-phase system
              nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
            }
          } else {
            // 8 or more players: eliminate to top 4 for betting phase
            await eliminateToFinalists(ctx, activeGame._id, 4);
            nextStatus = "betting";
            nextPhase = 3;
            nextPhaseTime = now + (PHASE_DURATIONS.TOP4 * 1000);
          }
          break;
        }

        case "betting":
          nextStatus = "battle";
          nextPhase = 4;
          nextPhaseTime = now + (PHASE_DURATIONS.BATTLE * 1000);
          break;

        case "battle":
          // Determine winner
          await determineWinner(ctx, activeGame._id);
          nextStatus = "results";
          nextPhase = 5;
          nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
          break;

        case "results":
          // Process payouts
          await processPayouts(ctx, activeGame._id);
          nextStatus = "completed" as any;
          nextPhase = 6;

          await ctx.db.patch(activeGame._id, {
            status: nextStatus,
            phase: nextPhase,
            endTime: now,
          });
          console.log(`Completed game ${activeGame._id}`);
          return;
      }

      // Update game phase if not results
      if (nextStatus !== "completed") {
        await ctx.db.patch(activeGame._id, {
          status: nextStatus,
          phase: nextPhase,
          phaseStartTime: now,
          nextPhaseTime,
        });
      }

      console.log(`Advanced game ${activeGame._id} from ${activeGame.status} to ${nextStatus}`);
    }
  },
});
