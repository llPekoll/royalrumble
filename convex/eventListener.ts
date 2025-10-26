"use node";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { SolanaClient } from "./lib/solana";
import { v } from "convex/values";

const RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || "http://127.0.0.1:8899";
const CRANK_AUTHORITY_PRIVATE_KEY = process.env.CRANK_AUTHORITY_PRIVATE_KEY || "";

export const listenToBlockchainEvents = internalAction({
  handler: async (ctx) => {
    try {
      const solanaClient = new SolanaClient(RPC_ENDPOINT, CRANK_AUTHORITY_PRIVATE_KEY);
      await captureGameRoundState(ctx, solanaClient);
    } catch (error) {
      console.error("Error in blockchain event listener:", error);
    }
  },
});

async function captureGameRoundState(ctx: any, solanaClient: SolanaClient) {
  try {
    const gameRound = await solanaClient.getGameRound();
    if (!gameRound) {
      console.log("No active game round found on blockchain");
      return;
    }
    const { roundId, status } = gameRound;
    const existingState = await ctx.runMutation(internal.eventListener.checkStateCaptured, {
      roundId,
      status,
    });
    if (existingState) {
      return;
    }
    await ctx.runMutation(internal.eventListener.saveGameRoundState, {
      gameRound,
    });
    console.log("Captured Round " + roundId + ": " + status);
  } catch (error) {
    console.error("Error capturing game round state:", error);
    throw error;
  }
}

export const checkStateCaptured = internalMutation({
  args: {
    roundId: v.number(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gameRoundStates")
      .withIndex("by_round_and_status", (q) =>
        q.eq("roundId", args.roundId).eq("status", args.status)
      )
      .first();
    return existing !== null;
  },
});

export const saveGameRoundState = internalMutation({
  args: {
    gameRound: v.object({
      roundId: v.number(),
      status: v.string(),
      startTimestamp: v.number(),
      endTimestamp: v.number(),
      betCount: v.number(),
      betAmounts: v.array(v.number()),
      totalPot: v.number(),
      winner: v.union(v.string(), v.null()),
      winningBetIndex: v.number(),
      vrfRequestPubkey: v.union(v.string(), v.null()),
      vrfSeed: v.array(v.number()),
      randomnessFulfilled: v.boolean(),
      winnerPrizeUnclaimed: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { gameRound } = args;
    await ctx.db.insert("gameRoundStates", {
      roundId: gameRound.roundId,
      status: gameRound.status,
      startTimestamp: gameRound.startTimestamp,
      endTimestamp: gameRound.endTimestamp,
      capturedAt: Math.floor(Date.now() / 1000),
      betCount: gameRound.betCount,
      betAmounts: gameRound.betAmounts,
      totalPot: gameRound.totalPot,
      winner: gameRound.winner,
      winningBetIndex: gameRound.winningBetIndex,
      vrfRequestPubkey: gameRound.vrfRequestPubkey,
      vrfSeed: gameRound.vrfSeed,
      randomnessFulfilled: gameRound.randomnessFulfilled,
      winnerPrizeUnclaimed: gameRound.winnerPrizeUnclaimed,
    });
  },
});
