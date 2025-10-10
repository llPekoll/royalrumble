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
  // Individual characters in a game (multiple per player allowed)
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
    spectatorBets: v.number(), // Total spectator bets on this participant
  })
    .index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_character", ["characterId"])
    .index("by_game_wallet", ["gameId", "walletAddress"])
    .index("by_game_eliminated", ["gameId", "eliminated"]),

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

  // nfts: defineTable({
  //   mintAddress: v.string(), // Solana NFT address
  //   ownerWallet: v.string(),
  //   gameId: v.id("games"),
  //   participantName: v.string(), // Winner's display name
  //   spriteIndex: v.number(), // Sprite used in winning game
  //   winAmount: v.number(), // Amount won in the game
  //   betAmount: v.number(), // Amount that was bet
  //   metadata: v.object({
  //     name: v.string(),
  //     description: v.string(),
  //     image: v.string(),
  //     attributes: v.array(v.object({
  //       trait_type: v.string(),
  //       value: v.union(v.string(), v.number()),
  //     })),
  //   }),
  //   mintedAt: v.number(),
  //   transactionSignature: v.string(),
  // }).index("by_owner", ["ownerWallet"])
  //   .index("by_game", ["gameId"])
  //   .index("by_mint", ["mintAddress"]),

  transactionQueue: defineTable({
    walletAddress: v.string(),
    type: v.union(v.literal("deposit"), v.literal("withdrawal")),
    amount: v.number(),
    solAmount: v.optional(v.number()),
    signature: v.optional(v.string()),
    transactionSignature: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    queuedAt: v.number(),
    processedAt: v.optional(v.number()),
    priority: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_wallet", ["walletAddress"]),

  // Game history for analytics and leaderboards
  gameHistory: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    participantIds: v.array(v.id("gameParticipants")), // All participants this player controlled
    totalBet: v.number(), // Total amount bet across all participants
    totalPayout: v.number(), // Total winnings
    profit: v.number(), // Profit/loss for this game
    finishPosition: v.optional(v.number()), // Best position among their participants
    gameEndTime: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_game", ["gameId"])
    .index("by_end_time", ["gameEndTime"]),

  // Leaderboard tracking
  leaderboard: defineTable({
    period: v.string(), // "daily", "weekly", "monthly", "alltime"
    startDate: v.number(),
    endDate: v.optional(v.number()),
    playerId: v.id("players"),
    walletAddress: v.string(),
    displayName: v.string(),
    gamesPlayed: v.number(),
    wins: v.number(),
    totalEarnings: v.number(),
    winRate: v.number(), // Percentage as decimal (0.45 = 45%)
    highestPayout: v.number(), // Biggest single win
    rank: v.number(),
  })
    .index("by_period_rank", ["period", "rank"])
    .index("by_player_period", ["playerId", "period"])
    .index("by_wallet", ["walletAddress"])
    .index("by_wins", ["wins"])
    .index("by_earnings", ["totalEarnings"]),

  // Bot configuration for demo games
  botConfigs: defineTable({
    name: v.string(), // Bot display name
    characterPreferences: v.array(v.id("characters")), // Preferred characters
    betRange: v.object({
      min: v.number(),
      max: v.number(),
    }),
    skill: v.number(), // 0-1, affects decision making
    personality: v.string(), // "aggressive", "conservative", "random"
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),
  gameStates: defineTable({
    gameId: v.string(), // Format: "round_{round_id}"
    status: v.string(), // "idle", "waiting", "awaitingWinnerRandomness", "finished" (simplified for small games MVP)
    phaseStartTime: v.number(), // Unix timestamp when current phase started
    waitingDuration: v.number(), // Duration in seconds for waiting phase
    // spectatorBettingDuration - removed for small games MVP
    playersCount: v.number(), // Current number of players in the game
    lastChecked: v.number(), // Last time this game was checked by cron
    gameType: v.optional(v.string()), // Always "small" in MVP - kept for compatibility

    // Timing configuration (simplified for small games MVP)
    waitingPhaseEnd: v.optional(v.number()), // When waiting phase should end
    // eliminationPhaseEnd - removed for small games MVP
    // spectatorBettingEnd - removed for small games MVP
    resolvingPhaseEnd: v.optional(v.number()), // When resolving phase should end

    // VRF tracking (simplified for small games MVP)
    // finalistRandomnessCommitted - removed for small games MVP
    winnerRandomnessCommitted: v.optional(v.boolean()),
  })
    .index("by_game_id", ["gameId"])
    .index("by_status", ["status"])
    .index("by_last_checked", ["lastChecked"]),

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
    transactionType: v.optional(v.string()), // "progress_to_resolution", "resolve_winner", etc. (simplified for small games MVP)

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

  // Track randomness requests and callbacks (simplified for small games MVP)
  vrfRequests: defineTable({
    gameId: v.string(),
    requestType: v.string(), // "winner_selection" only (finalist_selection removed for small games MVP)
    commitSlot: v.number(), // Solana slot when randomness was committed
    randomnessAccount: v.string(), // Solana account address for randomness
    resolved: v.boolean(),
    resolvedAt: v.optional(v.number()),

    // Request tracking
    requestedAt: v.number(),
    expectedResolutionSlot: v.number(), // When we expect to be able to resolve
    lastCheckedSlot: v.optional(v.number()),

    // Resolution data
    randomValue: v.optional(v.string()), // Hex string of random bytes
    transactionHash: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_game_id", ["gameId"])
    .index("by_request_type", ["requestType"])
    .index("by_resolved", ["resolved"])
    .index("by_commit_slot", ["commitSlot"]),

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
