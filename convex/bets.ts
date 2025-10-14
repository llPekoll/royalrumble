import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Place a bet on a participant (self or spectator)
export const placeBet = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    walletAddress: v.string(),
    betType: v.union(v.literal("self"), v.literal("refund")), // Removed spectator
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

    // Validate player
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }
    // NOTE: Balance check removed - SOL balance verified by smart contract
    // Player signs transaction via Privy, smart contract validates sufficient funds

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

    // Validate participant isn't eliminated
    if (targetParticipant.eliminated) {
      throw new Error("Cannot bet on eliminated participant");
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

    // Calculate odds based on current participants
    const allParticipants = await ctx.db
      .query("gameParticipants")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Calculate odds based on bet amounts (higher bet = lower odds)
    const totalBetAmount = allParticipants.reduce((sum, p) => sum + p.betAmount, 0);
    const targetBetAmount = targetParticipant.betAmount;
    const odds = totalBetAmount > 0 ? totalBetAmount / targetBetAmount : 1;

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

    // NOTE: Coin deduction removed - SOL transferred via smart contract
    // Transaction signed by player via Privy, funds held in GamePool PDA

    // NOTE: Game pool updates handled by smart contract
    // entryPool automatically updated when place_entry_bet instruction is called

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
        const participant = await ctx.db.get(bet.targetParticipantId);
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
