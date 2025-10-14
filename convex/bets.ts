import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// LEGACY: Place spectator bet on a participant - now using enhanced bets table
// Note: This function is deprecated in favor of the consolidated approach
export const placeBet = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    walletAddress: v.string(),
    betType: v.union(v.literal("self"), v.literal("refund")),
    targetBetId: v.id("bets"), // Now references a bet record instead of participant
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate game
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    // Validate bet type based on game phase
    if (args.betType === "self" && game.status !== "waiting") {
      throw new Error("Self betting only allowed during waiting phase");
    }

    // Validate player
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    // Validate bet amount
    if (args.amount < 10 || args.amount > 10000) {
      throw new Error("Bet amount must be between 10 and 10,000 coins");
    }

    // Validate target bet (participant)
    const targetBet = await ctx.db.get(args.targetBetId);
    if (!targetBet) {
      throw new Error("Target participant bet not found");
    }
    if (targetBet.gameId !== args.gameId) {
      throw new Error("Participant not in this game");
    }
    if (targetBet.betType !== "self") {
      throw new Error("Can only bet on participant (self) bets");
    }

    // Validate participant isn't eliminated
    if (targetBet.eliminated) {
      throw new Error("Cannot bet on eliminated participant");
    }

    // Check for existing bet (simplified for new schema)
    const existingBet = await ctx.db
      .query("bets")
      .withIndex("by_game_wallet", (q) =>
        q.eq("gameId", args.gameId).eq("walletAddress", args.walletAddress)
      )
      .filter((q) => q.eq(q.field("betType"), args.betType))
      .first();

    if (existingBet) {
      throw new Error("Already placed a bet of this type in this game");
    }

    // Calculate odds based on current participants (simplified)
    const allParticipants = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("betType"), "self"))
      .collect();

    // Calculate odds based on bet amounts (higher bet = lower odds)
    const totalBetAmount = allParticipants.reduce((sum, p) => sum + (p.amount || 0), 0);
    const targetBetAmount = targetBet.amount || 1;
    const odds = totalBetAmount > 0 ? totalBetAmount / targetBetAmount : 1;

    // For spectator bets, create a new bet record without positioning data
    const betId = await ctx.db.insert("bets", {
      gameId: args.gameId,
      playerId: args.playerId,
      walletAddress: args.walletAddress,
      amount: args.amount,
      betTimestamp: Date.now(),
      betType: args.betType,
      odds,
      payout: undefined,
      status: "pending",
      placedAt: Date.now(),
      settledAt: undefined,
      
      // No positioning data for spectator bets
      position: undefined,
      targetPosition: undefined,
      size: undefined,
      spawnIndex: undefined,
      eliminated: undefined,
      eliminatedAt: undefined,
      eliminatedBy: undefined,
      finalPosition: undefined,
      isWinner: undefined,
      characterId: undefined,
      spectatorBets: undefined,
      totalWinnings: undefined,
      refundAmount: undefined,
      onChainConfirmed: false,
      txSignature: undefined,
      winChance: undefined,
      
      // Legacy field for migration compatibility
      targetParticipantId: undefined,
    });

    return betId;
  },
});

// Get all bets for a game
export const getGameBets = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Fetch character and player data for enhanced bets
    const betsWithData = await Promise.all(
      bets.map(async (bet) => {
        const character = bet.characterId ? await ctx.db.get(bet.characterId) : null;
        const player = bet.playerId ? await ctx.db.get(bet.playerId) : null;
        return {
          ...bet,
          character,
          player,
        };
      })
    );

    return betsWithData;
  },
});

// Get player's bets
export const getPlayerBets = query({
  args: {
    playerId: v.id("players"),
    gameId: v.optional(v.id("games")),
  },
  handler: async (ctx, args) => {
    const betsQuery = ctx.db
      .query("bets")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId));

    const bets = await betsQuery.collect();

    // Filter by game if specified
    const filteredBets = args.gameId ? bets.filter((b) => b.gameId === args.gameId) : bets;

    return filteredBets;
  },
});

// Settle bets for a completed game
export const settleBets = mutation({
  args: {
    gameId: v.id("games"),
    winnerId: v.id("gameParticipants"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Handle refunds (solo player games handled by smart contract)
    // NOTE: This function is primarily for tracking bet status in database
    // Actual SOL transfers handled by smart contract instructions

    // Check if this was a refunded game
    const shouldRefund = game.status === "idle" && !args.winnerId;

    if (shouldRefund) {
      for (const bet of bets) {
        // Refund all bets
        await ctx.db.patch(bet._id, {
          status: "refunded",
          payout: bet.amount,
          settledAt: Date.now(),
        });

        // NOTE: Refund handled by smart contract cancel_and_refund instruction
        // Backend calls refund_game(), SOL returned directly to player's wallet
      }
      return;
    }

    // Calculate payouts for multi-player game
    const selfBetWinners = bets.filter(
      (b) => b.betType === "self" && b.targetParticipantId === args.winnerId
    );

    // Calculate self bet payouts (split 95% of entry pool)
    const selfPoolPayout = game.entryPool * 0.95;
    const totalSelfBetAmount = selfBetWinners.reduce((sum, b) => sum + b.amount, 0);

    for (const bet of bets) {
      if (bet.betType === "self") {
        if (bet.targetParticipantId === args.winnerId) {
          // Winner - calculate proportional payout
          const payout =
            totalSelfBetAmount > 0
              ? (bet.amount / totalSelfBetAmount) * selfPoolPayout
              : bet.amount;

          await ctx.db.patch(bet._id, {
            status: "won",
            payout,
            settledAt: Date.now(),
          });

          // NOTE: Payout handled by smart contract claim_entry_winnings instruction
          // Winner calls smart contract to claim SOL directly to their wallet
        } else {
          // Loser
          await ctx.db.patch(bet._id, {
            status: "lost",
            payout: 0,
            settledAt: Date.now(),
          });
        }
      }
    }
  },
});

// Get betting statistics for a game
export const getBettingStats = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const participants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Calculate stats per participant
    const participantStats = participants.map((p) => {
      const participantBets = bets.filter((b) => b.targetParticipantId === p._id);
      const totalBetAmount = participantBets.reduce((sum, b) => sum + b.amount, 0);
      const betCount = participantBets.length;

      return {
        participantId: p._id,
        totalBetAmount,
        betCount,
        odds: totalBetAmount > 0 ? game.entryPool / totalBetAmount : 0,
      };
    });

    return {
      totalBets: bets.length,
      totalBetAmount: bets.reduce((sum, b) => sum + b.amount, 0),
      entryPool: game.entryPool,
      participantStats,
    };
  },
});

/**
 * Place an entry bet and join/create game
 * Called from frontend after successful on-chain bet transaction
 * ENHANCED: Now creates a unified bet record with participant positioning data
 */
export const placeEntryBet = mutation({
  args: {
    walletAddress: v.string(),
    characterId: v.id("characters"),
    betAmount: v.number(), // in lamports
    txSignature: v.string(),
  },
  handler: async (ctx, args) => {
    // Get player
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found. Please ensure you're logged in.");
    }

    // Get or create active game in waiting status
    let game = await ctx.db
      .query("games")
      .withIndex("by_last_checked")
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "waiting"),
          q.eq(q.field("status"), "idle")
        )
      )
      .first();

    // If no active game exists, create one
    if (!game) {
      // Get a random active map
      const activeMaps = await ctx.db
        .query("maps")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      if (activeMaps.length === 0) {
        throw new Error("No active maps available");
      }

      const randomMap = activeMaps[Math.floor(Math.random() * activeMaps.length)];
      const now = Date.now();

      // Create new game
      const gameId = await ctx.db.insert("games", {
        roundId: Date.now(), // Temporary until synced with Solana
        status: "waiting",
        startTimestamp: now,
        entryPool: 0,
        winner: undefined,
        playersCount: 0,
        vrfRequestPubkey: undefined,
        randomnessFulfilled: false,
        mapId: randomMap._id,
        winnerId: undefined,
        phaseStartTime: now,
        waitingDuration: 30, // 30 seconds waiting phase
        lastChecked: now,
        lastUpdated: now,
      });

      game = await ctx.db.get(gameId);
    }

    if (!game) {
      throw new Error("Failed to create or find game");
    }

    // Check if game is accepting participants
    if (game.status !== "waiting" && game.status !== "idle") {
      throw new Error("Game is not accepting new participants");
    }

    // Get existing self bets (representing participants)
    const existingParticipants = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .filter((q) => q.eq(q.field("betType"), "self"))
      .collect();

    // Check map capacity
    const map = await ctx.db.get(game.mapId);
    if (!map) {
      throw new Error("Map not found");
    }

    if (existingParticipants.length >= map.spawnConfiguration.maxPlayers) {
      throw new Error("Game is full");
    }

    const spawnIndex = existingParticipants.length;

    // Calculate size based on bet amount
    // 0.1 SOL (100M lamports) = 1.01x, 10 SOL (10B lamports) = 1.5x
    const size = 1 + (args.betAmount / 10_000_000_000) * 0.5;

    // Create unified bet record with participant positioning data
    const betId = await ctx.db.insert("bets", {
      gameId: game._id,
      playerId: player._id,
      walletAddress: args.walletAddress,
      
      // Betting core data
      amount: args.betAmount,
      betTimestamp: Date.now(),
      betType: "self",
      odds: 1,
      status: "pending",
      placedAt: Date.now(),
      settledAt: undefined,
      payout: undefined,
      
      // Settlement tracking
      onChainConfirmed: false,
      txSignature: args.txSignature,
      spectatorBets: [], // Empty array initially
      
      // UI positioning (moved from gameParticipants)
      position: { x: 0, y: 0 },
      targetPosition: undefined,
      size,
      spawnIndex,
      
      // Game state (moved from gameParticipants)
      eliminated: false,
      eliminatedAt: undefined,
      eliminatedBy: undefined,
      finalPosition: undefined,
      isWinner: undefined,
      winChance: undefined,
      
      // Display enhancements
      characterId: args.characterId,
      
      // Legacy field for migration compatibility (will be removed)
      targetParticipantId: undefined,
    });

    // Update game totals
    const uniquePlayers = new Set(existingParticipants.map((p) => p.playerId));
    uniquePlayers.add(player._id);

    await ctx.db.patch(game._id, {
      playersCount: uniquePlayers.size,
      entryPool: game.entryPool + args.betAmount,
      status: "waiting", // Move to waiting if was idle
      phaseStartTime: game.status === "idle" ? Date.now() : game.phaseStartTime, // Reset countdown on first bet
      lastUpdated: Date.now(),
    });

    return {
      gameId: game._id,
      betId, // Return betId instead of participantId
      playersCount: uniquePlayers.size,
      entryPool: game.entryPool + args.betAmount,
    };
  },
});

/**
 * Get current active game
 */
export const getCurrentGame = query({
  args: {},
  handler: async (ctx) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_last_checked")
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "waiting"),
          q.eq(q.field("status"), "awaitingWinnerRandomness")
        )
      )
      .first();

    if (!game) {
      return null;
    }

    // Get participants count from self bets
    const participants = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .filter((q) => q.eq(q.field("betType"), "self"))
      .collect();

    return {
      ...game,
      participantsCount: participants.length,
    };
  },
});

/**
 * Get game participants from enhanced bets table
 * Replaces api.gameParticipants.getGameParticipants
 */
export const getGameParticipants = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("betType"), "self")) // Only self bets represent participants
      .collect();

    // Fetch character and player data for each participant bet
    const participantsWithData = await Promise.all(
      bets.map(async (bet) => {
        const character = bet.characterId ? await ctx.db.get(bet.characterId) : null;
        const player = bet.playerId ? await ctx.db.get(bet.playerId) : null;

        // Calculate additional betting stats
        const totalSpectatorBets = bet.spectatorBets?.reduce(
          (sum, spectatorBet) => sum + spectatorBet.amount, 0
        ) || 0;

        const totalBetAmount = bet.amount + totalSpectatorBets;
        
        return {
          ...bet,
          character,
          player,
          totalBetAmount,
          spectatorBetCount: bet.spectatorBets?.length || 0,
          totalSpectatorBets,
        };
      })
    );

    return participantsWithData;
  },
});
