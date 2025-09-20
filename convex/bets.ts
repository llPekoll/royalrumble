import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Place a bet on a participant (self or spectator)
export const placeBet = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    walletAddress: v.string(),
    betType: v.union(v.literal("self"), v.literal("spectator")),
    targetParticipantId: v.id("gameParticipants"),
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
    if (args.betType === "spectator" && game.status !== "betting") {
      throw new Error("Spectator betting only allowed during betting phase");
    }

    // Validate player
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }
    if (player.gameCoins < args.amount) {
      throw new Error("Insufficient game coins");
    }

    // Validate bet amount
    if (args.amount < 10 || args.amount > 10000) {
      throw new Error("Bet amount must be between 10 and 10,000 coins");
    }

    // Validate target participant
    const targetParticipant = await ctx.db.get(args.targetParticipantId);
    if (!targetParticipant) {
      throw new Error("Target participant not found");
    }
    if (targetParticipant.gameId !== args.gameId) {
      throw new Error("Participant not in this game");
    }

    // For spectator bets, ensure player isn't betting on themselves
    if (args.betType === "spectator") {
      if (targetParticipant.playerId === args.playerId) {
        throw new Error("Cannot place spectator bet on your own participant");
      }
      if (targetParticipant.eliminated) {
        throw new Error("Cannot bet on eliminated participant");
      }
    }

    // Check for existing bet
    const existingBet = await ctx.db
      .query("bets")
      .withIndex("by_game_wallet", (q) => 
        q.eq("gameId", args.gameId).eq("walletAddress", args.walletAddress)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("betType"), args.betType),
          q.eq(q.field("targetParticipantId"), args.targetParticipantId)
        )
      )
      .first();

    if (existingBet) {
      throw new Error("Already placed a bet on this participant");
    }

    // Calculate odds for spectator bets
    let odds = 1;
    if (args.betType === "spectator") {
      const allSurvivors = await ctx.db
        .query("gameParticipants")
        .withIndex("by_game_eliminated", (q) => 
          q.eq("gameId", args.gameId).eq("eliminated", false)
        )
        .collect();
      
      const totalPower = allSurvivors.reduce((sum, p) => sum + p.power, 0);
      const targetPower = targetParticipant.power;
      odds = totalPower / targetPower; // Simple odds calculation
    }

    // Create bet
    const betId = await ctx.db.insert("bets", {
      gameId: args.gameId,
      playerId: args.playerId,
      walletAddress: args.walletAddress,
      betType: args.betType,
      targetParticipantId: args.targetParticipantId,
      amount: args.amount,
      odds,
      payout: undefined,
      status: "pending",
      placedAt: Date.now(),
      settledAt: undefined,
    });

    // Deduct coins from player
    await ctx.db.patch(args.playerId, {
      gameCoins: player.gameCoins - args.amount,
    });

    // Update game pools
    if (args.betType === "spectator") {
      await ctx.db.patch(args.gameId, {
        spectatorBetPool: game.spectatorBetPool + args.amount,
        totalPot: game.totalPot + args.amount,
      });

      // Update participant's spectator bets total
      await ctx.db.patch(args.targetParticipantId, {
        spectatorBets: targetParticipant.spectatorBets + args.amount,
      });
    }

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

    // Fetch participant and player data
    const betsWithData = await Promise.all(
      bets.map(async (bet) => {
        const participant = bet.targetParticipantId 
          ? await ctx.db.get(bet.targetParticipantId)
          : null;
        const player = await ctx.db.get(bet.playerId);
        return {
          ...bet,
          participant,
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
    let betsQuery = ctx.db
      .query("bets")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId));

    const bets = await betsQuery.collect();

    // Filter by game if specified
    const filteredBets = args.gameId 
      ? bets.filter(b => b.gameId === args.gameId)
      : bets;

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

    // Handle single player refunds
    if (game.isSinglePlayer) {
      for (const bet of bets) {
        if (bet.betType === "self") {
          // Refund self bets
          await ctx.db.patch(bet._id, {
            status: "refunded",
            payout: bet.amount,
            settledAt: Date.now(),
          });

          // Return coins to player
          const player = await ctx.db.get(bet.playerId);
          if (player) {
            await ctx.db.patch(bet.playerId, {
              gameCoins: player.gameCoins + bet.amount,
            });
          }
        }
      }
      return;
    }

    // Calculate payouts for multi-player game
    const selfBetWinners = bets.filter(b => 
      b.betType === "self" && b.targetParticipantId === args.winnerId
    );
    const spectatorBetWinners = bets.filter(b => 
      b.betType === "spectator" && b.targetParticipantId === args.winnerId
    );

    // Calculate self bet payouts (split 95% of self pool)
    const selfPoolPayout = game.selfBetPool * 0.95;
    const totalSelfBetAmount = selfBetWinners.reduce((sum, b) => sum + b.amount, 0);
    
    for (const bet of bets) {
      if (bet.betType === "self") {
        if (bet.targetParticipantId === args.winnerId) {
          // Winner - calculate proportional payout
          const payout = totalSelfBetAmount > 0 
            ? (bet.amount / totalSelfBetAmount) * selfPoolPayout
            : bet.amount;
          
          await ctx.db.patch(bet._id, {
            status: "won",
            payout,
            settledAt: Date.now(),
          });

          // Pay out to player
          const player = await ctx.db.get(bet.playerId);
          if (player) {
            await ctx.db.patch(bet.playerId, {
              gameCoins: player.gameCoins + payout,
            });
          }
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

    // Calculate spectator bet payouts (95% of spectator pool)
    const spectatorPoolPayout = game.spectatorBetPool * 0.95;
    const totalSpectatorBetAmount = spectatorBetWinners.reduce((sum, b) => sum + b.amount, 0);
    
    for (const bet of bets) {
      if (bet.betType === "spectator") {
        if (bet.targetParticipantId === args.winnerId) {
          // Winner - calculate payout based on odds
          const payout = totalSpectatorBetAmount > 0
            ? (bet.amount / totalSpectatorBetAmount) * spectatorPoolPayout
            : bet.amount * (bet.odds || 1);
          
          await ctx.db.patch(bet._id, {
            status: "won",
            payout,
            settledAt: Date.now(),
          });

          // Pay out to player
          const player = await ctx.db.get(bet.playerId);
          if (player) {
            await ctx.db.patch(bet.playerId, {
              gameCoins: player.gameCoins + payout,
            });
          }
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
    const participantStats = participants.map(p => {
      const participantBets = bets.filter(b => b.targetParticipantId === p._id);
      const totalBetAmount = participantBets.reduce((sum, b) => sum + b.amount, 0);
      const betCount = participantBets.length;
      
      return {
        participantId: p._id,
        displayName: p.displayName,
        totalBetAmount,
        betCount,
        odds: totalBetAmount > 0 ? game.totalPot / totalBetAmount : 0,
      };
    });

    return {
      totalBets: bets.length,
      totalBetAmount: bets.reduce((sum, b) => sum + b.amount, 0),
      selfBetPool: game.selfBetPool,
      spectatorBetPool: game.spectatorBetPool,
      participantStats,
    };
  },
});