// Core game management functions for the Convex crank service
import { internalMutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { SolanaClient } from "./lib/solana";
import { GameStatus, TRANSACTION_TYPES } from "./lib/types";

/**
 * Main cron job handler - checks and progresses games as needed
 * Called every 15 seconds by the cron job
 */
export const checkAndProgressGames = internalMutation({
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
      await ctx.db.patch(await getOrCreateSystemHealth(ctx, "cron_job"), {
        status: health.healthy ? "healthy" : "unhealthy",
        lastCheck: now,
        lastError: health.healthy ? undefined : health.message,
        metadata: { slot: health.slot },
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
      let gameState = await ctx.db
        .query("gameStates")
        .withIndex("by_game_id", (q) => q.eq("gameId", gameId))
        .first();

      if (!gameState) {
        gameState = await createGameState(ctx, gameId, gameRound, gameConfig);
      }

      // Update last checked time
      await ctx.db.patch(gameState!._id, { lastChecked: now });

      // Log current state
      await logGameEvent(ctx, gameId, "cron_check", {
        success: true,
        fromStatus: gameRound.status,
        playersCount: gameRound.players.length,
      });

      // Process based on current game status (simplified for small games MVP)
      await processGameStatus(ctx, solanaClient, gameRound, gameState!, gameConfig, now);
    } catch (error) {
      console.error("Cron job error:", error);

      // Log error
      await logGameEvent(ctx, "unknown", "cron_error", {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // Update system health
      await ctx.db.patch(await getOrCreateSystemHealth(ctx, "cron_job"), {
        status: "unhealthy",
        lastCheck: now,
        lastError: error instanceof Error ? error.message : String(error),
        errorCount: (await getSystemHealthErrorCount(ctx, "cron_job")) + 1,
      });
    }
  },
});

/**
 * Process game based on current status and timing (simplified for small games MVP)
 */
async function processGameStatus(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  gameConfig: any,
  now: number
) {
  const gameId = gameState.gameId;

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

    case GameStatus.Finished:
      await handleFinishedGame(ctx, solanaClient, gameRound, gameState, now);
      break;

    default:
      console.warn(`Unknown game status: ${gameRound.status}`);
  }
}

/**
 * Handle waiting phase - check if time has elapsed to progress to resolution (simplified for small games MVP)
 */
async function handleWaitingPhase(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  gameConfig: any,
  now: number
) {
  // Calculate when waiting phase should end (all games are now small games)
  const waitingDuration = gameConfig.smallGameDurationConfig.waitingPhaseDuration;
  const waitingEndTime = gameRound.startTimestamp * 1000 + waitingDuration * 1000;

  if (now >= waitingEndTime) {
    console.log(`Waiting phase ended for game ${gameState.gameId}, progressing to resolution`);

    try {
      // Call progress_to_resolution on Solana
      const txHash = await solanaClient.progressToResolution();

      // Log successful transaction
      await logGameEvent(ctx, gameState.gameId, "transaction_sent", {
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.PROGRESS_TO_RESOLUTION,
        fromStatus: GameStatus.Waiting,
        // All games now go directly to AwaitingWinnerRandomness (small games MVP)
        toStatus: GameStatus.AwaitingWinnerRandomness,
        playersCount: gameRound.players.length,
      });

      // Confirm transaction
      const confirmed = await solanaClient.confirmTransaction(txHash);
      if (confirmed) {
        await logGameEvent(ctx, gameState.gameId, "transaction_confirmed", {
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.PROGRESS_TO_RESOLUTION,
        });

        // Update game state tracking (all games are small games now)
        await ctx.db.patch(gameState._id, {
          status: "awaitingWinnerRandomness",
          gameType: "small",
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to progress to resolution:", error);
      await logGameEvent(ctx, gameState.gameId, "transaction_failed", {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.PROGRESS_TO_RESOLUTION,
      });
    }
  }
}

// REMOVED FOR SMALL GAMES MVP - Large game functions no longer needed
// async function handleFinalistRandomness(...) { ... }
// async function handleSpectatorBettingPhase(...) { ... }

/**
 * Handle winner randomness resolution
 */
async function handleWinnerRandomness(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  now: number
) {
  const currentSlot = await solanaClient.getCurrentSlot();
  const slotsElapsed = currentSlot - gameRound.randomnessCommitSlot;

  if (slotsElapsed >= 10) {
    console.log(`Resolving winner for game ${gameState.gameId}, slots elapsed: ${slotsElapsed}`);

    try {
      const txHash = await solanaClient.resolveWinner(gameRound.winnerRandomnessAccount);

      await logGameEvent(ctx, gameState.gameId, "transaction_sent", {
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.RESOLVE_WINNER,
        fromStatus: GameStatus.AwaitingWinnerRandomness,
        toStatus: GameStatus.Finished,
      });

      const confirmed = await solanaClient.confirmTransaction(txHash);
      if (confirmed) {
        await ctx.db.patch(gameState._id, {
          status: "finished",
          resolvingPhaseEnd: now,
        });
      }
    } catch (error) {
      console.error("Failed to resolve winner:", error);
      await logGameEvent(ctx, gameState.gameId, "transaction_failed", {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.RESOLVE_WINNER,
      });
    }
  }
}

/**
 * Handle finished game - distribute winnings and reset
 */
async function handleFinishedGame(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  now: number
) {
  // Only try to distribute once
  if (!gameState.resolvingPhaseEnd) {
    return;
  }

  // Ensure we have a winner before distributing
  if (!gameRound.winner || gameRound.winner.toString() === "11111111111111111111111111111111") {
    console.error(`Cannot distribute winnings: no valid winner found for game ${gameState.gameId}`);
    return;
  }

  console.log(
    `Distributing winnings for completed game ${gameState.gameId} to winner ${gameRound.winner}`
  );

  try {
    const txHash = await solanaClient.distributeWinningsAndReset(gameRound.winner);

    await logGameEvent(ctx, gameState.gameId, "transaction_sent", {
      success: true,
      transactionHash: txHash,
      transactionType: TRANSACTION_TYPES.DISTRIBUTE_WINNINGS,
      fromStatus: GameStatus.Finished,
      toStatus: GameStatus.Idle,
      winner: gameRound.winner.toString(),
    });

    const confirmed = await solanaClient.confirmTransaction(txHash);
    if (confirmed) {
      await logGameEvent(ctx, gameState.gameId, "game_completed", {
        success: true,
        transactionHash: txHash,
        winner: gameRound.winner.toString(),
      });

      // Mark this game as fully processed
      await ctx.db.patch(gameState._id, {
        status: "idle", // Ready for next game
      });
    }
  } catch (error) {
    console.error("Failed to distribute winnings:", error);
    await logGameEvent(ctx, gameState.gameId, "transaction_failed", {
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      transactionType: TRANSACTION_TYPES.DISTRIBUTE_WINNINGS,
    });
  }
}

/**
 * Helper: Create new game state tracking record (simplified for small games MVP)
 */
async function createGameState(ctx: { db: any }, gameId: string, gameRound: any, gameConfig: any) {
  const now = Date.now();

  const gameStateId = await ctx.db.insert("gameStates", {
    gameId,
    status: gameRound.status,
    phaseStartTime: gameRound.startTimestamp * 1000,
    // All games are now small games - use small game waiting duration
    waitingDuration: gameConfig.smallGameDurationConfig.waitingPhaseDuration,
    // spectatorBettingDuration - removed for small games MVP
    playersCount: gameRound.players.length,
    lastChecked: now,
  });

  // Return the full document
  return await ctx.db.get(gameStateId);
}

/**
 * Helper: Log game events for audit trail
 */
async function logGameEvent(ctx: { db: any }, gameId: string, event: string, details: any) {
  await ctx.db.insert("gameEvents", {
    gameId,
    event,
    timestamp: Date.now(),
    success: details.success,
    transactionHash: details.transactionHash,
    errorMessage: details.errorMessage,
    fromStatus: details.fromStatus,
    toStatus: details.toStatus,
    playersCount: details.playersCount,
    transactionType: details.transactionType,
    processingTimeMs: details.processingTimeMs,
    retryCount: details.retryCount || 0,
  });
}

/**
 * Helper: Get or create system health record
 */
async function getOrCreateSystemHealth(
  ctx: { db: any },
  component: string
): Promise<Id<"systemHealth">> {
  const health = await ctx.db
    .query("systemHealth")
    .withIndex("by_component", (q: any) => q.eq("component", component))
    .first();

  if (!health) {
    const healthId = await ctx.db.insert("systemHealth", {
      component,
      status: "healthy",
      lastCheck: Date.now(),
      errorCount: 0,
    });
    return healthId;
  }

  return health._id;
}

/**
 * Helper: Get system health error count
 */
async function getSystemHealthErrorCount(ctx: { db: any }, component: string): Promise<number> {
  const health = await ctx.db
    .query("systemHealth")
    .withIndex("by_component", (q: any) => q.eq("component", component))
    .first();

  return health?.errorCount || 0;
}

/**
 * Public query: Get current game state for frontend
 */
export const getGameState = query({
  args: {},
  handler: async (ctx) => {
    // Get latest game state
    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_last_checked")
      .order("desc")
      .first();

    if (!gameState) {
      return null;
    }

    // Get recent events for this game
    const recentEvents = await ctx.db
      .query("gameEvents")
      .withIndex("by_game_id", (q) => q.eq("gameId", gameState.gameId))
      .order("desc")
      .take(10);

    return {
      gameState,
      recentEvents,
    };
  },
});

/**
 * Public query: Get system health status
 */
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const healthRecords = await ctx.db.query("systemHealth").collect();

    return healthRecords.map((record) => ({
      component: record.component,
      status: record.status,
      lastCheck: record.lastCheck,
      errorCount: record.errorCount,
      lastError: record.lastError,
    }));
  },
});
