import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Core game assets - KEEP (used for character selection)
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

  // Core game assets - KEEP (used for map selection)
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

  // Player management - KEEP (basic player profiles)
  players: defineTable({
    walletAddress: v.string(),
    gameCoins: v.number(),
    pendingCoins: v.number(), // Coins pending from deposits/transactions
    lastActive: v.number(),
    displayName: v.optional(v.string()), // Optional custom display name
    totalGamesPlayed: v.number(),
    totalWins: v.number(),
    totalEarnings: v.number(), // Lifetime earnings in game coins
    achievements: v.optional(v.array(v.string())), // Achievement IDs
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_last_active", ["lastActive"]),
  // Simplified game state tracking (mirrors Anchor GameRound structure)
  gameStates: defineTable({
    gameId: v.string(), // Format: "round_{round_id}" matching Anchor round_id
    roundId: v.number(), // Matches Anchor round_id field
    status: v.string(), // "idle", "waiting", "awaitingWinnerRandomness", "finished" (matches Anchor GameStatus)
    startTimestamp: v.number(), // Unix timestamp from Anchor start_timestamp
    
    // Players array (mirrors Anchor Vec<PlayerEntry>)
    players: v.array(v.object({
      wallet: v.string(), // Pubkey as string
      totalBet: v.number(), // Matches total_bet (in lamports)
      timestamp: v.number(), // When player joined (matches timestamp)
    })),
    
    // Pot and winner (matches Anchor fields)
    initialPot: v.number(), // Matches initial_pot (in lamports)
    winner: v.optional(v.string()), // Matches winner Pubkey (as string)
    
    // ORAO VRF fields (matches Anchor VRF integration)
    vrfRequestPubkey: v.optional(v.string()), // Matches vrf_request_pubkey
    vrfSeed: v.optional(v.string()), // Matches vrf_seed (as hex string)
    randomnessFulfilled: v.optional(v.boolean()), // Matches randomness_fulfilled
    
    // Convex-specific fields for cron management
    phaseStartTime: v.number(), // Unix timestamp when current phase started
    waitingDuration: v.number(), // Duration in seconds for waiting phase (from game config)
    lastChecked: v.number(), // Last time this game was checked by cron
    
    // Derived fields for convenience
    playersCount: v.number(), // Derived from players.length
    
    // Legacy fields - kept for compatibility during migration
    gameType: v.optional(v.string()), // Always "small" in MVP
    waitingPhaseEnd: v.optional(v.number()), // When waiting phase should end
    resolvingPhaseEnd: v.optional(v.number()), // When resolving phase should end
    
    // Legacy VRF field - kept for compatibility
    winnerRandomnessCommitted: v.optional(v.boolean()), // Deprecated: use randomnessFulfilled instead
  })
    .index("by_game_id", ["gameId"])
    .index("by_status", ["status"])
    .index("by_last_checked", ["lastChecked"]),

  // Audit log for all game state changes and transactions - KEEP (event logging)
  gameEvents: defineTable({
    gameId: v.string(),
    event: v.string(), // "cron_check", "transaction_sent", "transaction_confirmed", "error"
    timestamp: v.number(),
    transactionHash: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),

    // Game state context
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    playersCount: v.optional(v.number()),
    transactionType: v.optional(v.string()), // "unified_progress_to_resolution", "unified_resolve_and_distribute"

    // Performance tracking
    processingTimeMs: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    
    // Additional metadata for system events
    metadata: v.optional(v.any()),
  })
    .index("by_game_id", ["gameId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_event", ["event"])
    .index("by_success", ["success"]),

  // System health and monitoring - KEEP (system monitoring)
  systemHealth: defineTable({
    component: v.string(), // "cron_job", "solana_rpc", "transaction_sender"
    status: v.string(), // "healthy", "degraded", "unhealthy"
    lastCheck: v.number(),
    errorCount: v.number(),
    lastError: v.optional(v.string()),

    // Performance metrics
    avgResponseTime: v.optional(v.number()),
    successRate: v.optional(v.number()), // Percentage 0-100

    // Additional context
    metadata: v.optional(v.any()), // JSON object for component-specific data
  })
    .index("by_component", ["component"])
    .index("by_status", ["status"])
    .index("by_last_check", ["lastCheck"]),
});
