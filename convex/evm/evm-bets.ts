import { internalMutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";

// =================================================================================================
// Internal Mutations - Called by the Event Listener
// =================================================================================================

/**
 * @notice Creates or updates a bet record based on a `BetPlaced` event from the blockchain.
 * @dev This ensures the database is populated in real-time as bets are made.
 */
export const createOrUpdateBetFromEvent = internalMutation({
  args: {
    roundId: v.number(),
    player: v.string(),
    amount: v.string(),
    txHash: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    // Find the corresponding game in the database
    const game = await ctx.db
      .query("games")
      .withIndex("by_round_id", (q: any) => q.eq("roundId", args.roundId))
      .first();

    if (!game) {
      console.error(`Game with roundId ${args.roundId} not found for incoming bet.`);
      // Optionally, you could create the game here if a `GameCreated` event exists
      return;
    }

    // Check if this bet (by txHash) has already been processed to prevent duplicates
    const existingBet = await ctx.db
      .query("bets")
      .withIndex("by_tx_hash", (q: any) => q.eq("txHash", args.txHash))
      .first();

    if (existingBet) {
      // Event re-processed, just update confirmation status
      await ctx.db.patch(existingBet._id, { onChainConfirmed: true });
      return;
    }

    // Get the player record to link the bet
    const playerRecord = await ctx.db
        .query("players")
        .withIndex("by_wallet", (q: any) => q.eq("walletAddress", args.player))
        .first();

    // Create the new bet record
    await ctx.db.insert("bets", {
      gameId: game._id,
      playerId: playerRecord?._id,
      walletAddress: args.player,
      amount: args.amount,
      status: "pending", // Status is pending until a winner is selected
      placedAt: args.timestamp,
      txHash: args.txHash,
      onChainConfirmed: true,
      timestamp: args.timestamp,
    });
    
    // Increment players count in the game record for the UI
    const betsInGame = await ctx.db.query("bets").withIndex("by_game", (q: any) => q.eq("gameId", game._id)).collect();
    await ctx.db.patch(game._id, { playersCount: betsInGame.length + 1 });
  },
});

/**
 * @notice Settles all bets for a game based on a `WinnerSelected` event.
 * @dev Marks bets as 'won' or 'lost' after the game concludes on-chain.
 */
export const settleBetsFromEvent = internalMutation({
    args: {
        roundId: v.number(),
        winner: v.string(),
        txHash: v.string(),
    },
    handler: async (ctx: MutationCtx, { roundId, winner }: any) => {
        const game = await ctx.db
            .query("games")
            .withIndex("by_round_id", (q: any) => q.eq("roundId", roundId))
            .first();
            
        if (!game) {
            console.error(`Game with roundId ${roundId} not found for settling bets.`);
            return;
        }

        const bets = await ctx.db.query("bets").withIndex("by_game", (q: any) => q.eq("gameId", game._id)).collect();

        for (const bet of bets) {
            const isWinner = bet.walletAddress.toLowerCase() === winner.toLowerCase();
            await ctx.db.patch(bet._id, {
                status: isWinner ? "won" : "lost"
            });
        }
    }
});


// =================================================================================================
// Public Queries - For the Frontend
// =================================================================================================

/**
 * @notice Gets all bets for a specific game, including linked player and character data.
 */
export const getGameBetsWithDetails = query({
  args: { gameId: v.id("games") },
  handler: async (ctx: QueryCtx, args: any) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
      .collect();

    // Enhance bets with player data
    return Promise.all(
      bets.map(async (bet) => {
        const player = bet.playerId ? await ctx.db.get(bet.playerId) : null;
        // Add character lookup here if bets are linked to characters in your schema
        return {
          ...bet,
          player,
        };
      })
    );
  },
});
