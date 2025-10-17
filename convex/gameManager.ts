"use node";
// Core game management functions for the Convex crank service
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SolanaClient } from "./lib/solana";
import { GameStatus, TRANSACTION_TYPES } from "./lib/types";
import { Buffer } from "buffer";
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

      // Get current game state from Solana with error handling
      let gameRound, gameConfig;
      try {
        gameRound = await solanaClient.getGameRound();
        gameConfig = await solanaClient.getGameConfig();
      } catch (error) {
        console.error("Failed to fetch game state from Solana:", error);
        await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
          component: "cron_job",
          status: "unhealthy",
          lastCheck: now,
          lastError: `Failed to fetch game state: ${error instanceof Error ? error.message : String(error)}`,
        });
        return;
      }

      // Validate the fetched data
      if (!gameRound || gameRound.roundId === undefined) {
        console.error("Invalid game round data received from Solana");
        return;
      }

      if (!gameConfig) {
        console.error("Invalid game config data received from Solana");
        return;
      }

      // Get or create game tracking in Convex
      const roundId = gameRound.roundId;
      let game = await ctx.runQuery(internal.gameManagerDb.getGameByRoundId, { roundId });

      if (!game) {
        // Get a random active map for the game
        const randomMap = await ctx.runQuery(internal.gameManagerDb.getRandomActiveMap, {});

        game = await ctx.runMutation(internal.gameManagerDb.createGameRecord, {
          roundId,
          gameRound,
          gameConfig,
          mapId: randomMap._id,
        });
      }

      // Ensure game exists
      if (!game) {
        throw new Error("Failed to get or create game");
      }

      // Update game state from blockchain
      await ctx.runMutation(internal.gameManagerDb.updateGame, {
        gameId: game._id,
        lastChecked: now,
        endTimestamp: gameRound.endTimestamp ? gameRound.endTimestamp * 1000 : undefined, // ⭐ Sync betting window end time
        playersCount: gameRound.bets?.length || 0,
        entryPool: gameRound.entryPool || 0,
      });

      // Log current state
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId,
        event: "cron_check",
        details: {
          success: true,
          fromStatus: gameRound.status,
          playersCount: gameRound.bets.length,
        },
      });

      // Process based on current game status (simplified for small games MVP)
      await processGameStatus(ctx, solanaClient, gameRound, game, gameConfig, now);
    } catch (error) {
      console.error("Cron job error:", error);

      // Log error
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId: 0, // Unknown round
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
  game: any,
  gameConfig: any,
  now: number
) {
  switch (gameRound.status) {
    case GameStatus.Idle:
      // Nothing to do, waiting for players
      break;

    case GameStatus.Waiting:
      await handleWaitingPhase(ctx, solanaClient, gameRound, game, gameConfig, now);
      break;

    // Large game phases removed for small games MVP:
    // case GameStatus.AwaitingFinalistRandomness:
    // case GameStatus.SpectatorBetting:

    case GameStatus.AwaitingWinnerRandomness:
      await handleWinnerRandomness(ctx, solanaClient, gameRound, game, now);
      break;

    default:
      console.warn(`Unknown game status: ${gameRound.status}`);
  }
}

/**
 * Handle waiting phase - UNIFIED: progress directly to resolution with ORAO VRF request
 * Uses end_timestamp from smart contract for trustless time enforcement
 */
async function handleWaitingPhase(
  ctx: any,
  solanaClient: SolanaClient,
  gameRound: any,
  game: any,
  gameConfig: any,
  now: number
) {
  // ⭐ Use end_timestamp from smart contract (already in seconds)
  const waitingEndTime = gameRound.endTimestamp * 1000; // Convert to milliseconds

  if (now >= waitingEndTime) {
    console.log(`Betting window closed for round ${game.roundId} (end_timestamp: ${gameRound.endTimestamp}), progressing with unified ORAO VRF`);

    try {
      // UNIFIED CALL: Progress to resolution + ORAO VRF request in one transaction
      const txHash = await solanaClient.unifiedProgressToResolution();

      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId: game.roundId,
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
          roundId: game.roundId,
          event: "transaction_confirmed",
          details: {
            success: true,
            transactionHash: txHash,
            transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
          },
        });

        await ctx.runMutation(internal.gameManagerDb.updateGame, {
          gameId: game._id,
          status: "awaitingWinnerRandomness",
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to progress with unified ORAO VRF:", error);
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId: game.roundId,
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
  game: any,
  now: number
) {
  // Check if ORAO VRF is fulfilled
  const vrfFulfilled = await solanaClient.checkVrfFulfillment(gameRound.vrfRequestPubkey);

  if (vrfFulfilled) {
    console.log(`ORAO VRF fulfilled for round ${game.roundId}, completing game`);

    try {
      // UNIFIED CALL: Resolve winner + distribute winnings + reset game in one transaction
      const txHash = await solanaClient.unifiedResolveAndDistribute(gameRound.vrfRequestPubkey);

      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId: game.roundId,
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
          roundId: game.roundId,
          event: "game_completed",
          details: {
            success: true,
            transactionHash: txHash,
            transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
          },
        });

        // Mark game as completed and ready for next round
        await ctx.runMutation(internal.gameManagerDb.updateGame, {
          gameId: game._id,
          status: "idle",
          lastUpdated: now,
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to complete game with unified resolve and distribute:", error);
      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId: game.roundId,
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
    console.log(`ORAO VRF not yet fulfilled for round ${game.roundId}, waiting...`);
  }
}

/**
 * Clean up old completed games (older than 3 days)
 * Called by cron job every 3 days
 */
export const cleanupOldGames = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

    console.log("🧹 Starting game cleanup...");

    try {
      // Find old completed games
      const oldGames = await ctx.runQuery(internal.gameManagerDb.getOldCompletedGames, {
        cutoffTime: threeDaysAgo,
      });

      if (!oldGames || oldGames.length === 0) {
        console.log("✨ No old games to clean up");
        return {
          deletedGames: 0,
          deletedParticipants: 0,
          deletedBets: 0,
          message: "No old games to clean up",
        };
      }

      let deletedGames = 0;
      let deletedParticipants = 0;
      let deletedBets = 0;

      // Delete related data for each old game
      for (const game of oldGames) {
        // Get and delete participants
        const participants = await ctx.runQuery(internal.gameManagerDb.getGameParticipants, {
          gameId: game._id,
        });

        for (const participant of participants) {
          await ctx.runMutation(internal.gameManagerDb.deleteParticipant, {
            participantId: participant._id,
          });
          deletedParticipants++;
        }

        // Get and delete bets
        const bets = await ctx.runQuery(internal.gameManagerDb.getGameBets, {
          gameId: game._id,
        });

        for (const bet of bets) {
          await ctx.runMutation(internal.gameManagerDb.deleteBet, {
            betId: bet._id,
          });
          deletedBets++;
        }

        // Delete the game itself
        await ctx.runMutation(internal.gameManagerDb.deleteGame, {
          gameId: game._id,
        });
        deletedGames++;
      }

      console.log(
        `✅ Cleaned up ${deletedGames} old games, ${deletedParticipants} participants, ${deletedBets} bets`
      );

      return {
        deletedGames,
        deletedParticipants,
        deletedBets,
        message: `Cleaned up ${deletedGames} games older than 3 days`,
      };
    } catch (error) {
      console.error("Error during game cleanup:", error);
      throw error;
    }
  },
});
