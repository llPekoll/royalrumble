"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { EvmClient } from "./lib/evm";
import { ethers } from "ethers";

/**
 * @notice Listens for and processes events from the Domin8 smart contract.
 * @dev This is an action that should be run by a frequent cron job (e.g., every 5-10 seconds).
 * It queries for new blocks and processes any relevant events found within them.
 */
export const listenToBlockchainEvents = internalAction({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        try {
            // 1. Initialize EVM Client
            const { rpcEndpoint, privateKey, contractAddress } = getEnvVariables();
            const evmClient = new EvmClient(rpcEndpoint, privateKey, contractAddress);
            const contract = evmClient.contract;

            // 2. Get Last Processed Block
            const lastProcessedBlock = await ctx.runQuery(internal.eventListener.getLastProcessedBlock);
            const currentBlock = await evmClient.healthCheck().then(h => h.blockNumber ?? lastProcessedBlock);
            
            // Avoid querying a massive range on the first run
            const fromBlock = lastProcessedBlock === 0 ? currentBlock - 1 : lastProcessedBlock + 1;

            if (fromBlock > currentBlock) {
                console.log("No new blocks to process.");
                return;
            }

            // 3. Query for All Relevant Events in the Block Range
            console.log(`Scanning for events from block ${fromBlock} to ${currentBlock}`);
            const events = await contract.queryFilter("*", fromBlock, currentBlock);

            // 4. Process Events
            for (const event of events) {
                if (!event.eventName) continue;
                
                console.log(`Processing event: ${event.eventName} in transaction ${event.transactionHash}`);
                await processEvent(ctx, event);
            }

            // 5. Update Last Processed Block
            await ctx.runMutation(internal.eventListener.updateLastProcessedBlock, {
                blockNumber: currentBlock,
            });

            await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
                component: "event_listener", status: "healthy", lastCheck: now
            });

        } catch (error: any) {
            console.error("Event listener error:", error);
            await ctx.runMutation(internal.gameManagerDb.updateSystemHealth, {
                component: "event_listener", status: "unhealthy", lastCheck: now, lastError: error.message
            });
        }
    },
});

/**
 * @notice Routes a decoded event to the appropriate handler function.
 * @param ctx The Convex action context.
 * @param event The decoded event object from ethers.js.
 */
async function processEvent(ctx: any, event: ethers.EventLog) {
    const args = event.args;
    switch (event.eventName) {
        case "BetPlaced":
            await ctx.runMutation(internal.bets.createOrUpdateBetFromEvent, {
                roundId: Number(args.roundId),
                player: args.player,
                amount: args.amount.toString(),
                txHash: event.transactionHash,
                timestamp: Number(args.timestamp) * 1000,
            });
            break;
        case "WinnerSelected":
            await ctx.runMutation(internal.bets.settleBetsFromEvent, {
                roundId: Number(args.roundId),
                winner: args.winner,
                txHash: event.transactionHash
            });
            break;
        // Other events like GameLocked, GameReset can be handled here if needed
        // For now, they are primarily handled by the polling crank service
    }
}

/**
 * @notice Retrieves the last block number that was processed by the event listener.
 */
export const getLastProcessedBlock = internalQuery({
    handler: async (ctx) => {
        const health = await ctx.db
            .query("systemHealth")
            .withIndex("by_component", (q) => q.eq("component", "event_listener"))
            .first();
        return health?.metadata?.lastProcessedBlock ?? 0;
    },
});

/**
 * @notice Updates the last processed block number in the system health record.
 */
export const updateLastProcessedBlock = internalMutation({
    args: { blockNumber: v.number() },
    handler: async (ctx, { blockNumber }) => {
        const health = await ctx.db
            .query("systemHealth")
            .withIndex("by_component", (q) => q.eq("component", "event_listener"))
            .first();

        if (health) {
            const metadata = { ...(health.metadata || {}), lastProcessedBlock: blockNumber };
            await ctx.db.patch(health._id, { metadata });
        } else {
            // First run, create the record
            await ctx.db.insert("systemHealth", {
                component: "event_listener",
                status: "healthy",
                lastCheck: Date.now(),
                metadata: { lastProcessedBlock: blockNumber }
            });
        }
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
        throw new Error("Missing required environment variables for EVM client in event listener.");
    }
    return { rpcEndpoint, privateKey, contractAddress };
}
