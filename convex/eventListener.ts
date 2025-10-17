"use node";
// Real-time event listener for Solana blockchain events
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SolanaClient } from "./lib/solana";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { DOMIN8_PROGRAM_ID } from "./lib/types";
import { Buffer } from "buffer";

/**
 * Event listener that subscribes to on-chain events from the smart contract
 * Called by cron job every 5 seconds
 * This provides real-time updates (sub-second) with polling as fallback
 */
export const listenToBlockchainEvents = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    try {
      // Initialize Solana client
      const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
      const authorityKey = process.env.CRANK_AUTHORITY_PRIVATE_KEY;

      if (!authorityKey) {
        throw new Error("CRANK_AUTHORITY_PRIVATE_KEY environment variable not set");
      }

      const solanaClient = new SolanaClient(rpcEndpoint, authorityKey);

      // Get the program instance for event listening
      const program = (solanaClient as any).program;

      // Subscribe to all events and process them
      await subscribeToEvents(ctx, program, now);

      // Update health status
      await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
        component: "event_listener",
        status: "healthy",
        lastCheck: now,
      });
    } catch (error) {
      console.error("Event listener error:", error);

      await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
        component: "event_listener",
        status: "unhealthy",
        lastCheck: now,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

/**
 * Subscribe to all smart contract events
 */
async function subscribeToEvents(ctx: any, program: anchor.Program, now: number) {
  // Get the latest processed slot from database to avoid reprocessing old events
  const lastProcessedSlot = await ctx.runQuery(
    internal.gameManagerDb.getLastProcessedEventSlot,
    {}
  );

  console.log(`Checking for events since slot ${lastProcessedSlot || "genesis"}`);

  // Fetch recent events from the program
  // Note: This uses getProgramAccounts which is more reliable than websocket subscriptions
  // for serverless environments like Convex
  await fetchRecentEvents(ctx, program, lastProcessedSlot, now);
}

/**
 * Fetch and process recent events from the blockchain
 */
async function fetchRecentEvents(
  ctx: any,
  program: anchor.Program,
  lastProcessedSlot: number | null,
  now: number
) {
  try {
    // Get current slot
    const connection = program.provider.connection;
    const currentSlot = await connection.getSlot("confirmed");

    // Calculate slot range (fetch last ~30 seconds worth of events)
    // Solana produces ~2 blocks/sec, so 60 slots = ~30 seconds
    const fromSlot = lastProcessedSlot ? lastProcessedSlot + 1 : currentSlot - 60;
    const toSlot = currentSlot;

    console.log(`Fetching events from slot ${fromSlot} to ${toSlot}`);

    // Fetch transaction signatures for the program
    const signatures = await connection.getSignaturesForAddress(
      DOMIN8_PROGRAM_ID,
      { limit: 20 }, // Last 20 transactions
      "confirmed"
    );

    // Process each transaction to extract events
    for (const signatureInfo of signatures) {
      // Skip if we already processed this slot
      if (lastProcessedSlot && signatureInfo.slot <= lastProcessedSlot) {
        continue;
      }

      const signature = signatureInfo.signature;

      try {
        // Fetch transaction details
        const tx = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) {
          continue;
        }

        // Parse events from transaction logs
        const events = parseEventsFromLogs(tx.meta.logMessages || []);

        // Process each event
        for (const event of events) {
          await processEvent(ctx, event, signature, signatureInfo.slot, now);
        }

        // Update last processed slot
        await ctx.runMutation(internal.gameManagerDb.updateLastProcessedEventSlot, {
          slot: signatureInfo.slot,
        });
      } catch (error) {
        console.error(`Error processing transaction ${signature}:`, error);
        // Continue processing other transactions
      }
    }

    console.log(`Processed events up to slot ${toSlot}`);
  } catch (error) {
    console.error("Error fetching recent events:", error);
    throw error;
  }
}

/**
 * Parse events from transaction logs
 * Anchor emits events in logs with a specific format
 */
function parseEventsFromLogs(logs: string[]): Array<{ name: string; data: any }> {
  const events: Array<{ name: string; data: any }> = [];

  for (const log of logs) {
    // Anchor event logs start with "Program data: "
    if (log.startsWith("Program data: ")) {
      try {
        // Extract base64 encoded event data
        const dataBase64 = log.replace("Program data: ", "");
        const dataBuffer = Buffer.from(dataBase64, "base64");

        // First 8 bytes are the event discriminator
        const discriminator = dataBuffer.slice(0, 8);

        // Try to match with known event types
        const eventName = getEventNameFromDiscriminator(discriminator);

        if (eventName) {
          // Decode event data (simplified - in production you'd use Anchor's IDL parser)
          const eventData = decodeEventData(eventName, dataBuffer.slice(8));

          events.push({
            name: eventName,
            data: eventData,
          });
        }
      } catch (error) {
        console.error("Error parsing event log:", error);
        // Continue processing other logs
      }
    }
  }

  return events;
}

/**
 * Map event discriminator to event name
 * Discriminators are generated by hashing the event name
 */
function getEventNameFromDiscriminator(discriminator: Buffer): string | null {
  // These discriminators are generated by Anchor from the event names
  // You can get them by inspecting transaction logs or from the IDL
  const discriminatorMap: Record<string, string> = {
    // BetPlaced event
    // GameLocked event
    // WinnerSelected event
    // GameReset event
    // GameInitialized event
    // Note: These need to be filled in with actual discriminators from your program
  };

  const discriminatorHex = discriminator.toString("hex");
  return discriminatorMap[discriminatorHex] || null;
}

/**
 * Decode event data based on event type
 * This is a simplified version - in production you'd use Anchor's IDL parser
 */
function decodeEventData(eventName: string, data: Buffer): any {
  // Simplified decoding - adjust based on your actual event structures
  switch (eventName) {
    case "BetPlaced":
      return {
        roundId: data.readBigUInt64LE(0),
        player: new PublicKey(data.slice(8, 40)).toBase58(),
        amount: data.readBigUInt64LE(40),
        betCount: data.readUInt8(48),
        totalPot: data.readBigUInt64LE(49),
        endTimestamp: data.readBigInt64LE(57),
        isFirstBet: data.readUInt8(65) !== 0,
      };

    case "GameLocked":
      return {
        roundId: data.readBigUInt64LE(0),
        finalBetCount: data.readUInt8(8),
        totalPot: data.readBigUInt64LE(9),
        vrfRequestPubkey: new PublicKey(data.slice(17, 49)).toBase58(),
      };

    case "WinnerSelected":
      return {
        roundId: data.readBigUInt64LE(0),
        winner: new PublicKey(data.slice(8, 40)).toBase58(),
        totalPot: data.readBigUInt64LE(40),
        houseFee: data.readBigUInt64LE(48),
        winnerPayout: data.readBigUInt64LE(56),
      };

    case "GameReset":
      return {
        oldRoundId: data.readBigUInt64LE(0),
        newRoundId: data.readBigUInt64LE(8),
      };

    case "GameInitialized":
      return {
        roundId: data.readBigUInt64LE(0),
        startTimestamp: data.readBigInt64LE(8),
        endTimestamp: data.readBigInt64LE(16),
      };

    default:
      return {};
  }
}

/**
 * Process a single event
 */
async function processEvent(
  ctx: any,
  event: { name: string; data: any },
  signature: string,
  slot: number,
  now: number
) {
  console.log(`Processing event: ${event.name}`, event.data);

  switch (event.name) {
    case "BetPlaced":
      await handleBetPlacedEvent(ctx, event.data, signature, now);
      break;

    case "GameLocked":
      await handleGameLockedEvent(ctx, event.data, now);
      break;

    case "WinnerSelected":
      await handleWinnerSelectedEvent(ctx, event.data, now);
      break;

    case "GameReset":
      await handleGameResetEvent(ctx, event.data, now);
      break;

    case "GameInitialized":
      await handleGameInitializedEvent(event.data);
      break;

    default:
      console.warn(`Unknown event type: ${event.name}`);
  }

  // Log event processing
  await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
    roundId: event.data.roundId || 0,
    event: `blockchain_event_${event.name.toLowerCase()}`,
    details: {
      success: true,
      eventData: event.data,
      signature,
      slot,
    },
  });
}

/**
 * Handle BetPlaced event
 */
async function handleBetPlacedEvent(ctx: any, data: any, signature: string, now: number) {
  const roundId = Number(data.roundId);

  // Get or create game record
  let game = await ctx.runQuery(internal.gameManagerDb.getGameByRoundId, { roundId });

  if (!game) {
    // If this is the first bet (game initialization), create the game record
    if (data.isFirstBet) {
      const randomMap = await ctx.runQuery(internal.gameManagerDb.getRandomActiveMap, {});

      game = await ctx.runMutation(internal.gameManagerDb.createGameRecord, {
        roundId,
        gameRound: {
          roundId,
          status: "waiting",
          startTimestamp: now / 1000,
          endTimestamp: Number(data.endTimestamp),
          bets: [],
          totalPot: Number(data.totalPot),
          winner: null,
          vrfRequestPubkey: null,
          vrfSeed: [],
          randomnessFulfilled: false,
        },
        gameConfig: {}, // Will be filled by polling fallback
        mapId: randomMap._id,
      });
    }
  }

  if (game) {
    // Update game with latest bet info
    await ctx.runMutation(internal.gameManagerDb.updateGame, {
      gameId: game._id,
      playersCount: data.betCount,
      totalPot: Number(data.totalPot),
      lastUpdated: now,
    });

    // Create bet record if needed
    await ctx.runMutation(internal.gameManagerDb.createOrUpdateBet, {
      gameId: game._id,
      playerWallet: data.player,
      amount: Number(data.amount),
      txSignature: signature,
      onChainConfirmed: true,
    });
  }
}

/**
 * Handle GameLocked event
 */
async function handleGameLockedEvent(ctx: any, data: any, now: number) {
  const roundId = Number(data.roundId);

  const game = await ctx.runQuery(internal.gameManagerDb.getGameByRoundId, { roundId });

  if (game) {
    await ctx.runMutation(internal.gameManagerDb.updateGame, {
      gameId: game._id,
      status: "awaitingWinnerRandomness",
      playersCount: data.finalBetCount,
      totalPot: Number(data.totalPot),
      lastUpdated: now,
    });
  }
}

/**
 * Handle WinnerSelected event
 */
async function handleWinnerSelectedEvent(ctx: any, data: any, now: number) {
  const roundId = Number(data.roundId);

  const game = await ctx.runQuery(internal.gameManagerDb.getGameByRoundId, { roundId });

  if (game) {
    await ctx.runMutation(internal.gameManagerDb.updateGame, {
      gameId: game._id,
      status: "finished",
      winner: data.winner,
      lastUpdated: now,
    });

    // Log winner payout details
    await ctx.runMutation(internal.gameManagerDb.logGameEventRecord, {
      roundId,
      event: "winner_payout",
      details: {
        success: true,
        winner: data.winner,
        totalPot: Number(data.totalPot),
        houseFee: Number(data.houseFee),
        winnerPayout: Number(data.winnerPayout),
      },
    });
  }
}

/**
 * Handle GameReset event
 */
async function handleGameResetEvent(ctx: any, data: any, now: number) {
  const oldRoundId = Number(data.oldRoundId);
  const newRoundId = Number(data.newRoundId);

  // Mark old game as completed
  const oldGame = await ctx.runQuery(internal.gameManagerDb.getGameByRoundId, {
    roundId: oldRoundId,
  });

  if (oldGame) {
    await ctx.runMutation(internal.gameManagerDb.updateGame, {
      gameId: oldGame._id,
      status: "completed",
      lastUpdated: now,
    });
  }

  // New game will be created when first bet is placed
  console.log(`Game reset: ${oldRoundId} -> ${newRoundId}`);
}

/**
 * Handle GameInitialized event
 */
async function handleGameInitializedEvent(data: any) {
  const roundId = Number(data.roundId);

  console.log(`Game initialized: round ${roundId}`);

  // This event is emitted when create_game is called
  // The BetPlaced event will handle creating the game record
}
