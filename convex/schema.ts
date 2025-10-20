import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Generic character types available in the game
  characters: defineTable({
    name: v.string(), // "Warrior", "Mage", "Archer", etc.
    description: v.optional(v.string()),
    assetPath: v.string(), // Path to the image file, e.g., "maps/arena_classic.png"
    animations: v.object({
      idle: v.object({
        start: v.number(), // Starting frame number
        end: v.number(), // Ending frame number
      }),
      walk: v.object({
        start: v.number(), // Starting frame number
        end: v.number(), // Ending frame number
      }),
      attack: v.optional(
        v.object({
          start: v.number(), // Starting frame number
          end: v.number(), // Ending frame number
        })
      ),
    }),
    isActive: v.boolean(), // Can be selected in games
  }).index("by_active", ["isActive"]),

  maps: defineTable({
    name: v.string(), // "Classic Arena", "Desert Storm", "Mystic Forest", etc.
    background: v.string(), // "arena", "arena2", "forest", etc.
    assetPath: v.string(), // Path to the image file, e.g., "maps/arena_classic.png"
    description: v.optional(v.string()),
    spawnConfiguration: v.object({
      maxPlayers: v.number(), // Maximum players this map supports
      spawnRadius: v.number(), // Distance from center for spawns
      minSpacing: v.number(), // Minimum angle between spawns (radians)
    }),
    isActive: v.boolean(), // Can be used in games
  }).index("by_active", ["isActive"]),

  // Player management
  players: defineTable({
    walletAddress: v.string(), // Now storing EVM addresses ('0x...')
    displayName: v.optional(v.string()),
    totalGamesPlayed: v.number(),
    totalWins: v.number(),
    lastActive: v.number(),
    achievements: v.optional(v.array(v.string())), // Achievement IDs
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_last_active", ["lastActive"]),

  // Unified game state mirroring the EVM contract
  games: defineTable({
    // Blockchain fields (from EVM Contract)
    roundId: v.number(), // PRIMARY KEY - matches blockchain
    status: v.string(), // "Idle", "Waiting", "AwaitingWinnerRandomness", "Finished"
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    totalPot: v.string(), // Storing as string to handle uint256
    winner: v.optional(v.string()), // Winner wallet address ('0x...')
    playersCount: v.number(),

    // VRF fields (from EVM Contract)
    vrfRequestId: v.optional(v.string()),
    randomnessFulfilled: v.optional(v.boolean()),

    // UI enhancement fields
    mapId: v.id("maps"),

    // Cron management
    lastChecked: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_round_id", ["roundId"])
    .index("by_status", ["status"])
    .index("by_last_checked", ["lastChecked"]),
    
  bets: defineTable({
    // Core identifiers
    gameId: v.id("games"),
    playerId: v.optional(v.id("players")),
    walletAddress: v.string(), // EVM address

    // Financial data
    amount: v.string(), // Storing as string to handle uint256 from contract
    
    // Status tracking
    status: v.union(
      v.literal("pending"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("refunded")
    ),
    placedAt: v.number(), // Timestamp when bet was placed

    // Blockchain tracking
    txHash: v.optional(v.string()), // EVM transaction hash
    onChainConfirmed: v.optional(v.boolean()),
    timestamp: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_wallet", ["walletAddress"])
    .index("by_game_wallet", ["gameId", "walletAddress"])
    .index("by_tx_hash", ["txHash"]),


  // Audit log for all game state changes and transactions
  gameEvents: defineTable({
    roundId: v.optional(v.number()),
    event: v.string(), // "game_started", "phase_transition", "transaction_sent", "transaction_confirmed", "error"
    timestamp: v.number(),
    transactionHash: v.optional(v.string()), // EVM transaction hash
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    playersCount: v.optional(v.number()),
    transactionType: v.optional(v.string()),
    retryCount: v.optional(v.float64()),
  })
    .index("by_round_id", ["roundId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_event", ["event"]),

  // System health and monitoring
  systemHealth: defineTable({
    component: v.string(), // "cron_job", "evm_rpc", "transaction_sender"
    status: v.string(), // "healthy", "degraded", "unhealthy"
    lastCheck: v.number(),
    lastError: v.optional(v.string()),
    metadata: v.optional(v.any()), // e.g., { blockNumber: 12345 }
  })
    .index("by_component", ["component"])
});
