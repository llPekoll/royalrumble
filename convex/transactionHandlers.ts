// Specific transaction handlers for Solana program interactions
import { internalMutation } from "convex/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { SolanaClient } from "./lib/solana";
import { TRANSACTION_TYPES } from "./lib/types";

/**
 * Handle progress to resolution transaction
 */
export const handleProgressToResolution = internalMutation({
  args: { 
    gameId: v.string(),
    gameStateId: v.id("gameStates"),
    playersCount: v.number()
  },
  handler: async (ctx: MutationCtx, args: { gameId: string; gameStateId: Id<"gameStates">; playersCount: number }) => {
    const startTime = Date.now();
    
    try {
      // Initialize Solana client
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;
      
      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }
      
      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
      
      // Execute transaction
      const txHash = await solanaClient.progressToResolution();
      
      // Log transaction sent
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "transaction_sent",
        timestamp: Date.now(),
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.PROGRESS_TO_RESOLUTION,
        playersCount: args.playersCount,
        processingTimeMs: Date.now() - startTime,
      });
      
      // Confirm transaction
      const confirmed = await solanaClient.confirmTransaction(txHash);
      
      if (confirmed) {
        // Log success
        await ctx.db.insert("gameEvents", {
          gameId: args.gameId,
          event: "transaction_confirmed",
          timestamp: Date.now(),
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.PROGRESS_TO_RESOLUTION,
          processingTimeMs: Date.now() - startTime,
        });
        
        // Update game state
        const newStatus = args.playersCount >= 8 ? "awaitingFinalistRandomness" : "awaitingWinnerRandomness";
        await ctx.db.patch(args.gameStateId, {
          status: newStatus,
          gameType: args.playersCount >= 8 ? "large" : "small",
        });
        
        return { success: true, txHash, newStatus };
      } else {
        throw new Error("Transaction confirmation failed");
      }
      
    } catch (error) {
      // Log error
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "transaction_failed", 
        timestamp: Date.now(),
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.PROGRESS_TO_RESOLUTION,
        processingTimeMs: Date.now() - startTime,
      });
      
      throw error;
    }
  },
});

// REMOVED FOR SMALL GAMES MVP - Large game transaction handlers
// handleResolveFinalists and handleProgressToFinalBattle functions
// have been removed as they are not needed for small games MVP

/**
 * Handle resolve winner transaction
 */
export const handleResolveWinner = internalMutation({
  args: {
    gameId: v.string(),
    gameStateId: v.id("gameStates"),
    randomnessAccount: v.string(),
    commitSlot: v.number(),
  },
  handler: async (ctx: MutationCtx, args: { gameId: string; gameStateId: Id<"gameStates">; randomnessAccount: string; commitSlot: number }) => {
    const startTime = Date.now();
    
    try {
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;
      
      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }
      
      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
      
      // Execute transaction
      const txHash = await solanaClient.resolveWinner(
        new (await import("@solana/web3.js")).PublicKey(args.randomnessAccount)
      );
      
      // Log transaction sent
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "transaction_sent",
        timestamp: Date.now(),
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.RESOLVE_WINNER,
        processingTimeMs: Date.now() - startTime,
      });
      
      // Confirm transaction
      const confirmed = await solanaClient.confirmTransaction(txHash);
      
      if (confirmed) {
        // Log success
        await ctx.db.insert("gameEvents", {
          gameId: args.gameId,
          event: "transaction_confirmed",
          timestamp: Date.now(),
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.RESOLVE_WINNER,
          processingTimeMs: Date.now() - startTime,
        });
        
        // Update game state
        await ctx.db.patch(args.gameStateId, {
          status: "finished",
          resolvingPhaseEnd: Date.now(),
        });
        
        // Create VRF request tracking
        await ctx.db.insert("vrfRequests", {
          gameId: args.gameId,
          requestType: "winner_selection",
          commitSlot: args.commitSlot,
          randomnessAccount: args.randomnessAccount,
          resolved: true,
          resolvedAt: Date.now(),
          requestedAt: startTime,
          expectedResolutionSlot: args.commitSlot + 10,
          transactionHash: txHash,
        });
        
        return { success: true, txHash };
      } else {
        throw new Error("Transaction confirmation failed");
      }
      
    } catch (error) {
      // Log error
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "transaction_failed",
        timestamp: Date.now(),
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.RESOLVE_WINNER,
        processingTimeMs: Date.now() - startTime,
      });
      
      throw error;
    }
  },
});

/**
 * Handle distribute winnings transaction
 */
export const handleDistributeWinnings = internalMutation({
  args: {
    gameId: v.string(),
    gameStateId: v.id("gameStates"),
  },
  handler: async (ctx: MutationCtx, args: { gameId: string; gameStateId: Id<"gameStates"> }) => {
    const startTime = Date.now();
    
    try {
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;
      
      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }
      
      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);
      
      // Execute transaction
      const txHash = await solanaClient.distributeWinningsAndReset();
      
      // Log transaction sent
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "transaction_sent",
        timestamp: Date.now(),
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.DISTRIBUTE_WINNINGS,
        processingTimeMs: Date.now() - startTime,
      });
      
      // Confirm transaction
      const confirmed = await solanaClient.confirmTransaction(txHash);
      
      if (confirmed) {
        // Log success
        await ctx.db.insert("gameEvents", {
          gameId: args.gameId,
          event: "game_completed",
          timestamp: Date.now(),
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.DISTRIBUTE_WINNINGS,
          processingTimeMs: Date.now() - startTime,
        });
        
        // Update game state to indicate completion
        await ctx.db.patch(args.gameStateId, {
          status: "idle", // Ready for next game
        });
        
        return { success: true, txHash };
      } else {
        throw new Error("Transaction confirmation failed");
      }
      
    } catch (error) {
      // Log error
      await ctx.db.insert("gameEvents", {
        gameId: args.gameId,
        event: "transaction_failed",
        timestamp: Date.now(),
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.DISTRIBUTE_WINNINGS,
        processingTimeMs: Date.now() - startTime,
      });
      
      throw error;
    }
  },
});