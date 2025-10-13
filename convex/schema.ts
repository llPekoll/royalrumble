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
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    gameCoins: v.number(), // For demo mode only
    pendingCoins: v.number(), // Coins pending from deposits/transactions
    totalGamesPlayed: v.number(),
    totalWins: v.number(),
    totalEarnings: v.number(), // Lifetime earnings in game coins
    lastActive: v.number(),
    achievements: v.optional(v.array(v.string())), // Achievement IDs
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_last_active", ["lastActive"]),

  // Main game state (for UI phases and synchronization)
  games: defineTable({
    status: v.union(
      v.literal("waiting"),
      v.literal("selection"),
      v.literal("arena"),
      v.literal("elimination"),
      v.literal("betting"),
      v.literal("battle"),
      v.literal("results"),
      v.literal("completed")
    ),
    phase: v.number(), // Current phase number
    startTime: v.number(),
    endTime: v.optional(v.number()),
    phaseStartTime: v.number(), // When current phase started
    nextPhaseTime: v.number(), // When next phase will start
    playerCount: v.number(), // Unique players (not participants)
    participantCount: v.number(), // Total game participants
    totalPot: v.number(),
    selfBetPool: v.number(), // Pool from initial entry bets
    spectatorBetPool: v.number(), // Pool from top 4 betting
    winnerId: v.optional(v.id("gameParticipants")),
    isSinglePlayer: v.boolean(), // True if only one human player
    isSmallGame: v.boolean(), // True if < 8 participants (3 phases only)
    mapId: v.id("maps"), // Reference to selected map
    survivorIds: v.optional(v.array(v.id("gameParticipants"))), // Top 4 survivors after elimination
    // Blockchain call tracking for dynamic phase timing
    blockchainCallStatus: v.optional(
      v.union(
        v.literal("pending"), // Call initiated but not completed
        v.literal("completed"), // Call completed, winner determined
        v.literal("none") // No call needed/made
      )
    ),
    blockchainCallStartTime: v.optional(v.number()), // When blockchain call was initiated
  })
    .index("by_status", ["status"])
    .index("by_start_time", ["startTime"])
    .index("by_map", ["mapId"]),

  // Individual participants (CRITICAL for display)
  gameParticipants: defineTable({
    gameId: v.id("games"),
    playerId: v.optional(v.id("players")), // Optional for bots
    walletAddress: v.optional(v.string()), // For human players
    displayName: v.string(), // Display name for this participant
    characterId: v.id("characters"), // Reference to selected character
    colorHue: v.optional(v.number()), // Optional color variation (0-360)
    isBot: v.boolean(),
    betAmount: v.number(), // Amount bet (determines size and power)
    size: v.number(), // Visual size multiplier based on bet
    power: v.number(), // Combat power (bet amount * character stats)
    spawnIndex: v.number(), // Index in the game's spawnPositions array
    position: v.object({ x: v.number(), y: v.number() }), // Current position in arena
    targetPosition: v.optional(v.object({ x: v.number(), y: v.number() })), // Where they're moving to
    eliminated: v.boolean(),
    eliminatedAt: v.optional(v.number()),
    eliminatedBy: v.optional(v.id("gameParticipants")), // Who eliminated them
    finalPosition: v.optional(v.number()), // 1st, 2nd, 3rd, etc.
    isWinner: v.optional(v.boolean()), // Mark the winning participant
    spectatorBets: v.number(), // Total spectator bets on this participant
  })
    .index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_character", ["characterId"])
    .index("by_game_wallet", ["gameId", "walletAddress"])
    .index("by_game_eliminated", ["gameId", "eliminated"]),

  // Individual bets (CRITICAL for tracking)
  bets: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    walletAddress: v.string(),
    betType: v.union(v.literal("self"), v.literal("spectator"), v.literal("refund")),
    targetParticipantId: v.optional(v.id("gameParticipants")), // Who they bet on
    amount: v.number(), // Bet amount in game coins
    odds: v.optional(v.number()), // Odds at time of bet placement
    payout: v.optional(v.number()), // Actual payout amount (0 if lost)
    status: v.union(
      v.literal("pending"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("refunded")
    ),
    placedAt: v.number(),
    settledAt: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_wallet", ["walletAddress"])
    .index("by_game_wallet", ["gameId", "walletAddress"])
    .index("by_status", ["status"]),

  // Blockchain state mirror (matches Anchor GameRound)
  gameStates: defineTable({
    gameId: v.string(), // "round_{round_id}"
    status: v.string(), // "idle", "waiting", "awaitingWinnerRandomness", "finished"
    roundId: v.optional(v.number()),
    startTimestamp: v.optional(v.number()),
    playersCount: v.number(),
    initialPot: v.optional(v.number()),
    winner: v.optional(v.string()), // Winner wallet address
    phaseStartTime: v.number(), // Unix timestamp when current phase started
    waitingDuration: v.number(), // Duration in seconds for waiting phase
    lastChecked: v.number(), // Last time this game was checked by cron
    gameType: v.optional(v.string()), // Always "small" in MVP
    waitingPhaseEnd: v.optional(v.number()), // When waiting phase should end
    resolvingPhaseEnd: v.optional(v.number()), // When resolving phase should end
    vrfRequestPubkey: v.optional(v.string()),
    randomnessFulfilled: v.optional(v.boolean()),
    winnerRandomnessCommitted: v.optional(v.boolean()),
  })
    .index("by_game_id", ["gameId"])
    .index("by_status", ["status"])
    .index("by_last_checked", ["lastChecked"]),

  // Recent winners tracking (for displaying last game results)
  recentWinners: defineTable({
    gameId: v.id("games"),
    roundId: v.number(),            // From blockchain
    walletAddress: v.string(),      // Winner's wallet
    displayName: v.string(),         // Winner's display name
    characterId: v.id("characters"), // Which character won
    characterName: v.string(),       // Character name for quick display
    betAmount: v.number(),           // How much the winner bet
    participantCount: v.number(),    // How many participants they had
    totalPayout: v.number(),         // Total winnings
    timestamp: v.number(),           // When they won
  })
  .index("by_timestamp", ["timestamp"]), // Query recent winners

  // Audit log for all game state changes and transactions
  gameEvents: defineTable({
    gameId: v.string(),
    event: v.string(), // "game_started", "phase_transition", "transaction_sent", "transaction_confirmed", "error"
    timestamp: v.number(),
    transactionHash: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    // Additional context
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    playersCount: v.optional(v.number()),
    transactionType: v.optional(v.string()),
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

  // System health and monitoring
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