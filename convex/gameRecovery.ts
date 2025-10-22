/**
 * Game Recovery System
 *
 * Self-healing system that checks if blockchain is ahead of expected state
 * and triggers the appropriate actions to catch up.
 *
 * This handles cases where:
 * - Scheduler didn't fire
 * - Server restarted mid-game
 * - VRF took too long
 * - Manual game creation via scripts
 */
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SolanaClient } from "./lib/solana";
import { GameStatus } from "./lib/types";
import { shouldExecuteAction, PHASE_DURATIONS } from "./lib/gamePhases";

export const checkGameRecovery = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      // Get blockchain state
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;

      if (!authorityKey) {
        console.log("⚠️ CRANK_AUTHORITY_PRIVATE_KEY not set, skipping recovery check");
        return;
      }

      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
      const gameRound = await solanaClient.getGameRound();

      if (!gameRound) {
        // No game on blockchain, nothing to recover
        return;
      }

      // gameRound.status is already converted to string by SolanaClient
      const status = gameRound.status;
      const startTimestamp = gameRound.startTimestamp ? Number(gameRound.startTimestamp) : 0;
      const currentTime = Date.now() / 1000; // Unix timestamp in seconds

      console.log(`🔍 Recovery check - Status: ${status}, Started: ${startTimestamp}`, {
        elapsed: currentTime - startTimestamp,
        vrfRequest: gameRound.vrfRequestPubkey,
        randomnessFulfilled: gameRound.randomnessFulfilled,
      });

      // Ignore if game is idle or finished
      if (status === GameStatus.Idle || status === GameStatus.Finished) {
        return;
      }

      // Check if we should have closed betting by now
      if (
        status === GameStatus.Waiting &&
        shouldExecuteAction("CLOSE_BETTING", startTimestamp, currentTime)
      ) {
        const elapsed = currentTime - startTimestamp;
        console.log(
          `🚨 OVERDUE: Betting should have closed ${elapsed - PHASE_DURATIONS.WAITING}s ago!`
        );
        console.log(`⚡ Triggering closeBettingWindow now...`);

        // Get or create game record in Convex
        const gameId = await ensureGameRecord(ctx, gameRound);

        // Trigger the action immediately
        await ctx.runAction(internal.gameActions.closeBettingWindow, { gameId });
        return;
      }

      // Check if VRF should have been processed by now
      if (status === GameStatus.AwaitingWinnerRandomness) {
        const elapsed = currentTime - startTimestamp;

        // If VRF has been waiting for more than FIGHTING phase duration, check it
        if (elapsed > PHASE_DURATIONS.WAITING + PHASE_DURATIONS.FIGHTING) {
          console.log(`🚨 VRF overdue! Checking VRF fulfillment now...`);

          if (gameRound.vrfRequestPubkey) {
            const vrfFulfilled = await solanaClient.checkVrfFulfillment(gameRound.vrfRequestPubkey);

            if (vrfFulfilled) {
              console.log(`✅ VRF is fulfilled! Selecting winner now...`);
              const gameId = await ensureGameRecord(ctx, gameRound);
              await ctx.runAction(internal.gameActions.checkVrfAndComplete, {
                gameId,
                retryCount: 0,
              });
            } else {
              console.log(
                `⏳ VRF still waiting... (${elapsed - PHASE_DURATIONS.WAITING}s elapsed)`
              );

              // If VRF is taking way too long (>50s), log warning
              if (elapsed > PHASE_DURATIONS.WAITING + 50) {
                console.log(`⚠️ VRF taking abnormally long! Consider manual intervention.`);
              }
            }
          }
        }
      }

      // Note: If status is Finished, we would have already returned early above
      // No need for additional cleanup here
    } catch (error) {
      console.error("❌ Game recovery check failed:", error);
    }
  },
});

/**
 * Ensure a game record exists in Convex for the current blockchain game
 * Returns the game ID
 */
async function ensureGameRecord(ctx: any, gameRound: any): Promise<any> {
  const roundId = Number(gameRound.roundId);

  // Check if game record already exists
  const existingGame = await ctx.runQuery(internal.gameManagerDb.getGameByRoundId, {
    roundId,
  });

  if (existingGame) {
    console.log(`✅ Found existing game record: ${existingGame._id}`);
    return existingGame._id;
  }

  // Create new game record
  console.log(`📝 Creating game record for round ${roundId}`);

  // Get game config
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
  const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY!;
  const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
  const gameConfig = await solanaClient.getGameConfig();

  // Get a random map
  const maps = await ctx.runQuery(internal.gameManagerDb.getMaps, {});
  const randomMap = maps[Math.floor(Math.random() * maps.length)];

  // Create game record
  const gameId = await ctx.runMutation(internal.gameManagerDb.createGameRecord, {
    roundId,
    gameRound,
    gameConfig: gameConfig || {},
    mapId: randomMap._id,
  });

  console.log(`✅ Created game record: ${gameId}`);
  return gameId;
}
