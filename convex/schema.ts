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
    totalGamesPlayed: v.number(),
    totalWins: v.number(),
    lastActive: v.number(),
    achievements: v.optional(v.array(v.string())), // Achievement IDs
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_last_active", ["lastActive"]),

  // Unified game state (combines blockchain mirror + UI enhancement)
  games: defineTable({
    // Blockchain fields (from Anchor GamePool)
    roundId: v.number(), // PRIMARY KEY - matches blockchain
    status: v.string(), // "idle", "waiting", "awaitingWinnerRandomness", "finished"
    startTimestamp: v.optional(v.number()), // From blockchain
    endTimestamp: v.optional(v.number()), // When betting window closes (from blockchain)
    totalPot: v.number(), // From blockchain GameRound.total_pot (accumulated from all bets)
    winner: v.optional(v.string()), // Winner wallet address
    playersCount: v.number(), // From blockchain bets.length

    // VRF fields (from blockchain)
    vrfRequestPubkey: v.optional(v.string()),
    randomnessFulfilled: v.optional(v.boolean()),

    // UI enhancement fields
    mapId: v.id("maps"), // Which map to display
    winnerId: v.optional(v.id("bets")), // UI reference to winner bet record

    // Essential timing
    phaseStartTime: v.number(), // When current phase started
    waitingDuration: v.number(), // Duration for waiting phase

    // Cron management
    lastChecked: v.number(), // Cron job tracking
    lastUpdated: v.number(), // Last blockchain sync

    // Cached list of players (optional, for quick access in frontend)
    players: v.optional(v.array(v.id("players"))),
  })
    .index("by_round_id", ["roundId"])
    .index("by_status", ["status"])
    .index("by_last_checked", ["lastChecked"]),

  // CONSOLIDATED: Unified bets table combining participants + betting data

  bets: defineTable({
    // Core identifiers
    gameId: v.id("games"),
    playerId: v.optional(v.id("players")), // Optional for bots
    walletAddress: v.string(),

    // Bet classification
    betType: v.union(
      v.literal("self"),       // Player betting on themselves (creates participant)
      v.literal("spectator"),  // Player betting on another participant
      v.literal("refund")        // Bank bot opponent
    ),
    targetBetId: v.optional(v.id("bets")), // For spectator bets only: which participant they bet on

    // Financial data
    amount: v.number(), // Bet amount in SOL
    odds: v.optional(v.number()), // Win probability (0-1) at time of bet
    payout: v.optional(v.number()), // Actual payout amount if won

    // Status tracking
    status: v.union(
      v.literal("pending"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("refunded")
    ),
    placedAt: v.number(), // Timestamp when bet was placed
    settledAt: v.optional(v.number()), // Timestamp when bet was settled

    // Participant data (only for self/bank bets, null for spectator)
    characterId: v.optional(v.id("characters")),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    spawnIndex: v.optional(v.number()), // Spawn position index

    // Game progression (only for self/bank bets)
    eliminated: v.optional(v.boolean()),
    eliminatedAt: v.optional(v.number()),
    eliminatedBy: v.optional(v.id("bets")), // Reference to eliminator participant
    finalPosition: v.optional(v.number()), // 1st, 2nd, 3rd, etc.
    isWinner: v.optional(v.boolean()),

    // Aggregated data (calculated fields for self bets)
    totalBetAmount: v.optional(v.number()), // Self bet + all spectator bets on them
    spectatorBetCount: v.optional(v.number()), // Number of spectators betting on them

    // Blockchain tracking
    txSignature: v.optional(v.string()), // Transaction signature
    onChainConfirmed: v.optional(v.boolean()), // Transaction confirmed on-chain
    timestamp: v.optional(v.number()), // When bet was placed (for event listener)
  })
    .index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_wallet", ["walletAddress"])
    .index("by_game_wallet", ["gameId", "walletAddress"])
    .index("by_status", ["status"])
    .index("by_bet_type", ["betType"])
    .index("by_game_type", ["gameId", "betType"])
    .index("by_target", ["targetBetId"])
    .index("by_character", ["characterId"])
    .index("by_eliminated", ["gameId", "eliminated"])
    .index("by_tx_signature", ["txSignature"]),

  // Recent winners tracking (for displaying last game results)
  recentWinners: defineTable({
    roundId: v.number(), // From blockchain
    walletAddress: v.string(), // Winner's wallet
    characterId: v.id("characters"), // Which character won
    characterName: v.string(), // Character name for quick display
    betAmount: v.number(), // How much the winner bet
    participantCount: v.number(), // How many participants in game
    totalPayout: v.number(), // Total winnings
    timestamp: v.number(), // When they won
  }).index("by_timestamp", ["timestamp"]), // Query recent winners

  // Audit log for all game state changes and transactions
  gameEvents: defineTable({
    // TODO: migration delete when possible
    gameId: v.optional(v.string()), // Changed from gameId for consistency
    // TODO: not optional
    roundId: v.optional(v.number()), // Changed from gameId for consistency
    event: v.string(), // "game_started", "phase_transition", "transaction_sent", "transaction_confirmed", "error", "single_player_auto_refund"
    timestamp: v.number(),
    transactionHash: v.optional(v.string()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    // Additional context
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    playersCount: v.optional(v.number()),
    transactionType: v.optional(v.string()),
    // Single-player auto-refund fields (NEW)
    refundAutomatic: v.optional(v.boolean()), // true if auto-refund succeeded, false if fallback
    winnerPrizeUnclaimed: v.optional(v.number()), // Amount unclaimed for manual claim fallback
    // Performance tracking
    processingTimeMs: v.optional(v.number()),
    retryCount: v.optional(v.number()),
    // Additional metadata for system events
    metadata: v.optional(v.any()),
  })
    .index("by_round_id", ["roundId"]) // Updated index name
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
