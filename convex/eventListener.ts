"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SolanaClient } from "./lib/solana";

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
    const existingState = await ctx.runMutation(internal.eventListenerMutations.checkStateCaptured, {
      roundId,
      status,
    });
    if (existingState) {
      return;
    }
    await ctx.runMutation(internal.eventListenerMutations.saveGameRoundState, {
      gameRound,
    });
    console.log("Captured Round " + roundId + ": " + status);
  } catch (error) {
    console.error("Error capturing game round state:", error);
    throw error;
  }
}
