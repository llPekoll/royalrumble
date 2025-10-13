"use node";
// Core game management functions for the Convex crank service
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SolanaClient } from "./lib/solana";
import { GameStatus, TRANSACTION_TYPES } from "./lib/types";

/**
 * Main cron job handler - checks and progresses games as needed
 * Called every 15 seconds by the cron job
 * NOTE: This must be an action (not mutation) because it makes network calls to Solana
 */
export const checkAndProgressGames = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    try {
      // Initialize Solana client
      // TODO make sure we get the proper RPC
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      // private key de mon wallet
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;

      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }

      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);

      // Health check first
      const health = await solanaClient.healthCheck();
      await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
        component: "cron_job",
        status: health.healthy ? "healthy" : "unhealthy",
        lastCheck: now,
        lastError: health.healthy ? undefined : health.message,
        slot: health.slot,
      });

      if (!health.healthy) {
        console.error("Solana health check failed:", health.message);
        return;
      }

      // Get current game state from Solana
      const gameRound = await solanaClient.getGameRound();
      const gameConfig = await solanaClient.getGameConfig();

      // Get or create game state tracking in Convex
      const gameId = `round_${gameRound.roundId}`;
      let gameState = await ctx.runQuery(internal.gameManagerDb.getGameStateByGameId, { gameId });

      if (!gameState) {
        gameState = await ctx.runMutation(internal.gameManagerDb.createGameStateRecord, {
          gameId,
          gameRound,
          gameConfig,
        });
      }

      // Ensure gameState exists
      if (!gameState) {
        throw new Error("Failed to get or create game state");
      }

      // Update last checked time
      await ctx.runMutation(internal.gameManagerDb.updateGameState, {
        gameStateId: gameState._id,
        lastChecked: now,
      });

      // Log current state
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        gameId,
        event: "cron_check",
        details: {
          success: true,
          fromStatus: gameRound.status,
          playersCount: gameRound.bets.length,
        },
      });

      // Process based on current game status (simplified for small games MVP)
      await processGameStatus(ctx, solanaClient, gameRound, gameState, gameConfig, now);
    } catch (error) {
      console.error("Cron job error:", error);

      // Log error
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        gameId: "unknown",
        event: "cron_error",
        details: {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });

      // Update system health
      const errorCount = await ctx.runQuery(internal.gameManagerDb.getSystemHealthErrorCount, {
        component: "cron_job",
      });
      await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
        component: "cron_job",
        status: "unhealthy",
        lastCheck: now,
        lastError: error instanceof Error ? error.message : String(error),
        errorCount: errorCount + 1,
      });
    }
  },
});

/**
 * Process game based on current status and timing (simplified for small games MVP)
 */
async function processGameStatus(
  ctx: any,
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: any,
  gameConfig: any,
  now: number
) {
  switch (gameRound.status) {
    case GameStatus.Idle:
      // Nothing to do, waiting for players
      break;

    case GameStatus.Waiting:
      await handleWaitingPhase(ctx, solanaClient, gameRound, gameState, gameConfig, now);
      break;

    // Large game phases removed for small games MVP:
    // case GameStatus.AwaitingFinalistRandomness:
    // case GameStatus.SpectatorBetting:

    case GameStatus.AwaitingWinnerRandomness:
      await handleWinnerRandomness(ctx, solanaClient, gameRound, gameState, now);
      break;

    default:
      console.warn(`Unknown game status: ${gameRound.status}`);
  }
}

/**
 * Handle waiting phase - UNIFIED: progress directly to resolution with ORAO VRF request
 */
async function handleWaitingPhase(
  ctx: any,
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: any,
  gameConfig: any,
  now: number
) {
  // Calculate when waiting phase should end
  const waitingDuration = gameConfig.smallGameDurationConfig.waitingPhaseDuration;
  const waitingEndTime = gameRound.startTimestamp * 1000 + waitingDuration * 1000;

  if (now >= waitingEndTime) {
    console.log(
      `Waiting phase ended for game ${gameState.gameId}, progressing with unified ORAO VRF`
    );

    try {
      // UNIFIED CALL: Progress to resolution + ORAO VRF request in one transaction
      const txHash = await solanaClient.unifiedProgressToResolution();

      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        gameId: gameState.gameId,
        event: "transaction_sent",
        details: {
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
          fromStatus: GameStatus.Waiting,
          toStatus: GameStatus.AwaitingWinnerRandomness,
          playersCount: gameRound.bets.length,
        },
      });

      const confirmed = await solanaClient.confirmTransaction(txHash);
      if (confirmed) {
        await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
          gameId: gameState.gameId,
          event: "transaction_confirmed",
          details: {
            success: true,
            transactionHash: txHash,
            transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
          },
        });

        await ctx.runMutation(internal.gameManagerDb.updateGameState, {
          gameStateId: gameState._id,
          status: "awaitingWinnerRandomness",
          gameType: "small",
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to progress with unified ORAO VRF:", error);
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        gameId: gameState.gameId,
        event: "transaction_failed",
        details: {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
        },
      });
    }
  }
}

// REMOVED FOR SMALL GAMES MVP - Large game functions no longer needed
// async function handleFinalistRandomness(...) { ... }
// async function handleSpectatorBettingPhase(...) { ... }

/**
 * Handle winner randomness and complete game - UNIFIED: resolve winner + distribute + reset
 */
async function handleWinnerRandomness(
  ctx: any,
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: any,
  now: number
) {
  // Check if ORAO VRF is fulfilled
  const vrfFulfilled = await solanaClient.checkVrfFulfillment(gameRound.vrfRequestPubkey);

  if (vrfFulfilled) {
    console.log(`ORAO VRF fulfilled for game ${gameState.gameId}, completing game`);

    try {
      // UNIFIED CALL: Resolve winner + distribute winnings + reset game in one transaction
      const txHash = await solanaClient.unifiedResolveAndDistribute(gameRound.vrfRequestPubkey);

      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        gameId: gameState.gameId,
        event: "transaction_sent",
        details: {
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
          fromStatus: GameStatus.AwaitingWinnerRandomness,
          toStatus: GameStatus.Idle,
        },
      });

      const confirmed = await solanaClient.confirmTransaction(txHash);
      if (confirmed) {
        await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
          gameId: gameState.gameId,
          event: "game_completed",
          details: {
            success: true,
            transactionHash: txHash,
            transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
          },
        });

        // Mark game as completed and ready for next round
        await ctx.runMutation(internal.gameManagerDb.updateGameState, {
          gameStateId: gameState._id,
          status: "idle",
          resolvingPhaseEnd: now,
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to complete game with unified resolve and distribute:", error);
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        gameId: gameState.gameId,
        event: "transaction_failed",
        details: {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
        },
      });
    }
  } else {
    // VRF not yet fulfilled, wait longer
    console.log(`ORAO VRF not yet fulfilled for game ${gameState.gameId}, waiting...`);
  }
}
