import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    walletAddress: v.string(),
    gameCoins: v.number(),
    pendingCoins: v.number(),
    lastActive: v.number(),
    createdAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),

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

  numbers: defineTable({
    value: v.number(),
  }),
});
