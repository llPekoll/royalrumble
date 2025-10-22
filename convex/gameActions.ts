/**
 * Game Actions - Node.js actions that interact with Solana
 * These are scheduler-triggered actions that call the blockchain
 */
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { SolanaClient } from "./lib/solana";
import { GameStatus, TRANSACTION_TYPES } from "./lib/types";

/**
 * Close betting window and request VRF
 * Automatically triggered by scheduler after waiting phase ends
 */
export const closeBettingWindow = internalAction({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, { gameId }) => {
    const now = Date.now();

    try {
      // Get game data
      const game = await ctx.runQuery(internal.gameManagerDb.getGame, { gameId });
      if (!game) {
        console.error(`Game ${gameId} not found`);
        return;
      }

      console.log(`Closing betting window for round ${game.roundId}`);

      // Initialize Solana client
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;

      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }

      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);

      // Close betting window and transition to winner selection
      const txHash = await solanaClient.closeBettingWindow();

      await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
        roundId: game.roundId,
        event: "transaction_sent",
        details: {
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.CLOSE_BETTING_WINDOW,
          fromStatus: GameStatus.Waiting,
          toStatus: GameStatus.AwaitingWinnerRandomness,
          playersCount: game.playersCount,
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
            transactionType: TRANSACTION_TYPES.CLOSE_BETTING_WINDOW,
          },
        });

        await ctx.runMutation(internal.gameManagerDb.updateGame, {
          gameId: game._id,
          status: "awaitingWinnerRandomness",
          lastUpdated: now,
        });

        // Schedule VRF check after 5 seconds
        await ctx.scheduler.runAfter(
          5000,
          internal.gameActions.checkVrfAndComplete,
          { gameId, retryCount: 0 }
        );

        console.log(`Betting window closed for round ${game.roundId}, VRF check scheduled`);
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to close betting window:", error);
      const game = await ctx.runQuery(internal.gameManagerDb.getGame, { gameId });
      if (game) {
        await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
          roundId: game.roundId,
          event: "transaction_failed",
          details: {
            success: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            transactionType: TRANSACTION_TYPES.CLOSE_BETTING_WINDOW,
          },
        });
      }
    }
  },
});

/**
 * Check VRF fulfillment and complete game
 * Automatically triggered by scheduler with retry logic
 */
export const checkVrfAndComplete = internalAction({
  args: {
    gameId: v.id("games"),
    retryCount: v.number(),
  },
  handler: async (ctx, { gameId, retryCount }) => {
    const now = Date.now();
    const MAX_RETRIES = 10; // Max 10 retries = 50 seconds total (5s initial + 5s * 10)

    try {
      // Get game data
      const game = await ctx.runQuery(internal.gameManagerDb.getGame, { gameId });
      if (!game) {
        console.error(`Game ${gameId} not found`);
        return;
      }

      // Get fresh game state from Solana
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;

      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }

      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
      const gameRound = await solanaClient.getGameRound();

      if (!gameRound) {
        console.error(`Failed to fetch game round for game ${game.roundId}`);
        return;
      }

      if (!gameRound.vrfRequestPubkey) {
        console.error(`No VRF request pubkey for round ${game.roundId}`);
        return;
      }

      // Check if ORAO VRF is fulfilled
      const vrfFulfilled = await solanaClient.checkVrfFulfillment(gameRound.vrfRequestPubkey);

      if (vrfFulfilled) {
        console.log(`ORAO VRF fulfilled for round ${game.roundId}, completing game`);

        // Select winner and distribute payouts
        const txHash = await solanaClient.selectWinnerAndPayout(gameRound.vrfRequestPubkey);

        await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
          roundId: game.roundId,
          event: "transaction_sent",
          details: {
            success: true,
            transactionHash: txHash,
            transactionType: TRANSACTION_TYPES.SELECT_WINNER_AND_PAYOUT,
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
              transactionType: TRANSACTION_TYPES.SELECT_WINNER_AND_PAYOUT,
            },
          });

          // Mark game as completed
          await ctx.runMutation(internal.gameManagerDb.updateGame, {
            gameId: game._id,
            status: "idle",
            lastUpdated: now,
          });

          console.log(`Game ${game.roundId} completed successfully`);
        } else {
          throw new Error("Transaction confirmation failed");
        }
      } else {
        // VRF not yet fulfilled
        if (retryCount < MAX_RETRIES) {
          console.log(
            `ORAO VRF not yet fulfilled for round ${game.roundId}, retry ${retryCount + 1}/${MAX_RETRIES}`
          );

          // Schedule another check after 5 seconds
          await ctx.scheduler.runAfter(
            5000,
            internal.gameActions.checkVrfAndComplete,
            { gameId, retryCount: retryCount + 1 }
          );
        } else {
          // Max retries exceeded
          console.error(
            `Max VRF retries exceeded for round ${game.roundId}, marking game as failed`
          );

          await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
            roundId: game.roundId,
            event: "vrf_timeout",
            details: {
              success: false,
              errorMessage: "VRF fulfillment timeout after 50 seconds",
              retryCount,
            },
          });

          // TODO: Implement refund logic here if needed
        }
      }
    } catch (error) {
      console.error("Failed to check VRF and complete game:", error);
      const game = await ctx.runQuery(internal.gameManagerDb.getGame, { gameId });
      if (game) {
        await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
          roundId: game.roundId,
          event: "transaction_failed",
          details: {
            success: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            transactionType: TRANSACTION_TYPES.SELECT_WINNER_AND_PAYOUT,
            retryCount,
          },
        });
      }
    }
  },
});
