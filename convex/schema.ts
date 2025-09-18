import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    walletAddress: v.string(),
    gameCoins: v.number(),
    pendingCoins: v.number(),
    lastActive: v.number(),
    totalWins: v.optional(v.number()),
    totalGames: v.optional(v.number()),
    totalEarnings: v.optional(v.number()),
    displayName: v.optional(v.string()), // Optional custom display name
  }).index("by_wallet", ["walletAddress"]),

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
    phase: v.number(), // 1-6 for each phase
    phaseStartTime: v.number(),
    nextPhaseTime: v.number(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    playerCount: v.number(),
    totalPot: v.number(),
    winnerId: v.optional(v.id("gameParticipants")),
    isDemo: v.boolean(), // True if bot-only game
    isSinglePlayer: v.boolean(), // True if only one human player
  }).index("by_status", ["status"])
    .index("by_start_time", ["startTime"]),

  gameParticipants: defineTable({
    gameId: v.id("games"),
    playerId: v.optional(v.id("players")), // Optional for bots
    walletAddress: v.optional(v.string()), // For human players
    displayName: v.string(), // Player name or bot name
    spriteIndex: v.number(), // Random sprite assigned (0-n)
    colorHue: v.optional(v.number()), // Optional color variation (0-360)
    isBot: v.boolean(),
    betAmount: v.number(), // Amount bet (determines size and power)
    position: v.object({ x: v.number(), y: v.number() }), // Position in arena
    eliminated: v.boolean(),
    eliminatedAt: v.optional(v.number()),
    finalPosition: v.optional(v.number()), // 1st, 2nd, 3rd, etc.
  }).index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_game_wallet", ["gameId", "walletAddress"]),

  bets: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    walletAddress: v.string(),
    betType: v.union(v.literal("self"), v.literal("spectator")),
    targetParticipantId: v.optional(v.id("gameParticipants")), // Who they bet on
    amount: v.number(), // Bet amount in game coins
    payout: v.optional(v.number()), // Actual payout amount (0 if lost)
    status: v.union(
      v.literal("pending"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("refunded")
    ),
    placedAt: v.number(),
    settledAt: v.optional(v.number()),
  }).index("by_game", ["gameId"])
    .index("by_player", ["playerId"])
    .index("by_wallet", ["walletAddress"])
    .index("by_game_wallet", ["gameId", "walletAddress"]),

  nfts: defineTable({
    mintAddress: v.string(), // Solana NFT address
    ownerWallet: v.string(),
    gameId: v.id("games"),
    participantName: v.string(), // Winner's display name
    spriteIndex: v.number(), // Sprite used in winning game
    winAmount: v.number(), // Amount won in the game
    betAmount: v.number(), // Amount that was bet
    metadata: v.object({
      name: v.string(),
      description: v.string(),
      image: v.string(),
      attributes: v.array(v.object({
        trait_type: v.string(),
        value: v.union(v.string(), v.number()),
      })),
    }),
    mintedAt: v.number(),
    transactionSignature: v.string(),
  }).index("by_owner", ["ownerWallet"])
    .index("by_game", ["gameId"])
    .index("by_mint", ["mintAddress"]),

  leaderboard: defineTable({
    playerId: v.id("players"),
    walletAddress: v.string(),
    displayName: v.string(),
    totalWins: v.number(),
    totalGames: v.number(),
    totalEarnings: v.number(),
    winRate: v.number(),
    avgPayout: v.number(),
    highestPayout: v.number(),
    lastUpdated: v.number(),
    rank: v.optional(v.number()),
  }).index("by_wallet", ["walletAddress"])
    .index("by_wins", ["totalWins"])
    .index("by_earnings", ["totalEarnings"]),

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
  }).index("by_status", ["status"])
    .index("by_wallet", ["walletAddress"]),

});
