"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { EvmClient } from "./lib/evm";
import { GameStatus, TRANSACTION_TYPES } from "./lib/types";
import { Doc, Id } from "./_generated/dataModel";

/**
 * @notice Main cron job handler that checks and progresses the game state.
 * @dev This is an action because it makes external network calls to the EVM blockchain.
 */
export const checkAndProgressGames = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let roundId: number | undefined;

    try {
      // 1. Initialize EVM Client
      const { rpcEndpoint, privateKey, contractAddress } = getEnvVariables();
      const evmClient = new EvmClient(rpcEndpoint, privateKey, contractAddress);

      // 2. Perform Health Check
      const health = await evmClient.healthCheck();
      await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
        component: "evm_rpc",
        status: health.healthy ? "healthy" : "unhealthy",
        lastCheck: now,
        lastError: health.healthy ? undefined : health.message,
        metadata: { blockNumber: health.blockNumber },
      });

      if (!health.healthy) {
        console.error("EVM client health check failed:", health.message);
        return;
      }

      // 3. Fetch On-Chain Game State
      const gameRound = await evmClient.getGameRound();
      roundId = gameRound.roundId; // Assign roundId for error logging

      // 4. Sync State with Convex Database
      const game = await ctx.runMutation(internal.gameManagerDb.syncGameRecord, {
          gameRound,
      });

      if (!game) {
        throw new Error(`Failed to create or sync game record for round ${roundId}`);
      }

      // 5. Process Game Logic Based on Status
      await processGameStatus(ctx, evmClient, gameRound, game);

    } catch (error: any) {
      console.error(`Cron job error for round ${roundId ?? 'unknown'}:`, error);
      await ctx.runMutation(internal.gameManagerDb.logGameEvent, {
        roundId: roundId,
        event: "cron_error",
        details: { success: false, errorMessage: error.message },
      });
      await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
        component: "cron_job", status: "unhealthy", lastCheck: now, lastError: error.message,
      });
    }
  },
});

/**
 * @notice Routes game logic based on the current on-chain status.
 */
async function processGameStatus(
  ctx: any,
  evmClient: EvmClient,
  gameRound: any,
  game: Doc<"games">
) {
  switch (gameRound.status as GameStatus) {
    case GameStatus.Waiting:
      await handleWaitingPhase(ctx, evmClient, gameRound, game);
      break;
    case GameStatus.AwaitingWinnerRandomness:
      await handleWinnerRandomness(ctx, evmClient, gameRound, game);
      break;
    case GameStatus.Idle:
    case GameStatus.Finished:
      // No action needed from the crank.
      break;
    default:
      console.warn(`Unknown game status: ${gameRound.status}`);
  }
}

/**
 * @notice Handles the 'Waiting' phase: checks if the betting window is closed and triggers the next step.
 */
async function handleWaitingPhase(
  ctx: any,
  evmClient: EvmClient,
  gameRound: any,
  game: Doc<"games">
) {
  const now = Date.now();
  const waitingEndTime = gameRound.endTimestamp * 1000;

  if (now >= waitingEndTime) {
    console.log(`Betting window closed for round ${game.roundId}. Closing round...`);
    
    const tx = await evmClient.closeBettingWindow();
    await logTransaction(ctx, game.roundId, "transaction_sent", TRANSACTION_TYPES.CLOSE_BETTING_WINDOW, tx.hash);
    
    const receipt = await tx.wait();
    if (receipt && receipt.status === 1) {
      await logTransaction(ctx, game.roundId, "transaction_confirmed", TRANSACTION_TYPES.CLOSE_BETTING_WINDOW, tx.hash);
      await ctx.runMutation(internal.gameManagerDb.updateGameStatus, {
        gameId: game._id,
        status: "AwaitingWinnerRandomness"
      });
    } else {
      throw new Error(`closeBettingWindow transaction failed or reverted. Hash: ${tx.hash}`);
    }
  }
}

/**
 * @notice Handles the 'AwaitingWinnerRandomness' phase: checks if randomness is fulfilled and triggers payouts.
 */
async function handleWinnerRandomness(
  ctx: any,
  evmClient: EvmClient,
  gameRound: any,
  game: Doc<"games">
) {
  if (gameRound.randomnessFulfilled) {
    console.log(`Randomness fulfilled for round ${game.roundId}. Selecting winner...`);

    const tx = await evmClient.selectWinnerAndPayout();
    await logTransaction(ctx, game.roundId, "transaction_sent", TRANSACTION_TYPES.SELECT_WINNER_AND_PAYOUT, tx.hash);

    const receipt = await tx.wait();
    if (receipt && receipt.status === 1) {
      await logTransaction(ctx, game.roundId, "game_completed", TRANSACTION_TYPES.SELECT_WINNER_AND_PAYOUT, tx.hash);
      await ctx.runMutation(internal.gameManagerDb.updateGameStatus, {
        gameId: game._id,
        status: "Finished"
      });
    } else {
      throw new Error(`selectWinnerAndPayout transaction failed or reverted. Hash: ${tx.hash}`);
    }
  }
}

/**
 * @notice Cleans up old, completed games from the Convex database to save space.
 * @dev Called by a separate, less frequent cron job.
 */
export const cleanupOldGames = internalAction({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
        console.log("🧹 Starting database cleanup for old games...");

        const oldGames = await ctx.runQuery(internal.gameManagerDb.getOldCompletedGames, {
            cutoffTime: threeDaysAgo,
        });

        if (oldGames.length === 0) {
            console.log("✨ No old games to clean up.");
            return;
        }

        for (const game of oldGames) {
            const bets = await ctx.runQuery(internal.gameManagerDb.getGameBets, { gameId: game._id });
            for (const bet of bets) {
                await ctx.runMutation(internal.gameManagerDb.deleteBet, { betId: bet._id });
            }
            await ctx.runMutation(internal.gameManagerDb.deleteGame, { gameId: game._id });
        }
        console.log(`✅ Cleaned up ${oldGames.length} old games from the database.`);
    },
});


// =================================================================================================
// Helper Functions
// =================================================================================================

function getEnvVariables() {
    const rpcEndpoint = process.env.EVM_RPC_ENDPOINT;
    const privateKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;
    const contractAddress = process.env.DOMIN8_CONTRACT_ADDRESS;

    if (!rpcEndpoint || !privateKey || !contractAddress) {
        throw new Error("Missing required environment variables for EVM client.");
    }
    return { rpcEndpoint, privateKey, contractAddress };
}

async function logTransaction(ctx: any, roundId: number | undefined, event: string, type: string, hash: string) {
  await ctx.runMutation(internal.gameManagerDb.logGameEvent, {
    roundId,
    event,
    details: { success: true, transactionType: type, transactionHash: hash },
  });
}
