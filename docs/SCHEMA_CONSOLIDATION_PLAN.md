# Schema Consolidation Plan: Merging `gameParticipants` and `bets` Tables

## 🎯 **Objective**

Eliminate redundancy between `gameParticipants` and `bets` tables by consolidating them into a unified `bets` table that handles both betting data AND visual positioning for game participants.

## 📊 **Current Architecture Analysis**

### **Frontend Usage Patterns**

1. **`api.bets.placeEntryBet`** - Used in [`CharacterSelection.tsx`](src/components/CharacterSelection.tsx) for placing initial bets
2. **`api.gameParticipants.getGameParticipants`** - Used in [`MultiParticipantPanel.tsx`](src/components/MultiParticipantPanel.tsx) for displaying participants (currently commented out)
3. **Game scene updates** - [`Game.ts`](src/game/scenes/Game.ts) receives consolidated game state for UI updates

### **Current Data Redundancy**

#### **Overlapping Fields:**
- Both tables store: `gameId`, `playerId`, `walletAddress`
- Amount tracking: `betAmount` (participants) vs `amount` (bets)
- Timestamps: `betTimestamp` (participants) vs `placedAt` (bets)
- Both link to the same participant via `targetParticipantId` in bets

#### **Different Purposes:**
- **`gameParticipants`**: Visual game state, positioning, elimination tracking
- **`bets`**: Financial transactions, odds, payouts, settlement

## 🧹 **Proposed Solution: Enhanced `bets` Table**

### **Consolidated Schema**

```typescript
bets: defineTable({
  gameId: v.id("games"),
  playerId: v.optional(v.id("players")), // Optional for bots

  // Blockchain mirror (from BetEntry) - ENHANCED
  walletAddress: v.string(),
  betAmount: v.number(), // Primary bet amount (from BetEntry)
  betTimestamp: v.number(),
  winChance: v.optional(v.number()),

  // Betting core data
  betType: v.union(v.literal("self"), v.literal("refund")),
  odds: v.optional(v.number()),
  payout: v.optional(v.number()),
  status: v.union(
    v.literal("pending"),
    v.literal("won"),
    v.literal("lost"),
    v.literal("refunded")
  ),
  placedAt: v.number(),
  settledAt: v.optional(v.number()),

  // UI positioning (ESSENTIAL for frontend) - MOVED FROM gameParticipants
  position: v.object({ x: v.number(), y: v.number() }),
  targetPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
  size: v.number(), // Visual size based on bet
  spawnIndex: v.number(), // Spawn position index

  // Game progression - MOVED FROM gameParticipants
  eliminated: v.boolean(),
  eliminatedAt: v.optional(v.number()),
  eliminatedBy: v.optional(v.id("bets")), // Reference to other bet record
  finalPosition: v.optional(v.number()),
  isWinner: v.optional(v.boolean()),

  // CONSOLIDATED BETTING FIELDS
  spectatorBets: v.optional(v.array(v.object({
    betterWallet: v.string(),
    betterId: v.id("players"), 
    amount: v.number(),
    placedAt: v.number(),
    odds: v.optional(v.number()),
    txSignature: v.optional(v.string()),
  }))), // Array of bets placed on this participant by others

  // Settlement & Payout Tracking
  totalWinnings: v.optional(v.number()), // Total winnings if they won
  refundAmount: v.optional(v.number()), // Refunds if game cancelled

  // Blockchain integration
  onChainConfirmed: v.boolean(),
  txSignature: v.optional(v.string()),

  // Display enhancements
  characterId: v.id("characters"),
})
  .index("by_game", ["gameId"])
  .index("by_player", ["playerId"])
  .index("by_character", ["characterId"])
  .index("by_game_wallet", ["gameId", "walletAddress"])
  .index("by_game_eliminated", ["gameId", "eliminated"])
  .index("by_status", ["status"]),
```

## 🔄 **Migration Strategy**

### **Phase 1: Backend API Updates**

#### **1.1 Update Core Functions**

**Replace `api.bets.placeEntryBet` with enhanced `api.bets.placeEntryBet`:**

```typescript
// ENHANCED: convex/bets.ts
export const placeEntryBet = mutation({
  args: {
    walletAddress: v.string(),
    characterId: v.id("characters"),
    betAmount: v.number(),
    txSignature: v.string(),
  },
  handler: async (ctx, args) => {
    // Get/create player
    let player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    // Get/create game
    let game = await ctx.db
      .query("games")
      .withIndex("by_last_checked")
      .order("desc")
      .filter((q) => q.or(
        q.eq(q.field("status"), "waiting"),
        q.eq(q.field("status"), "idle")
      ))
      .first();

    if (!game) {
      // Create new game logic...
    }

    // Create unified bet record with participant positioning data
    const betId = await ctx.db.insert("bets", {
      gameId: game._id,
      playerId: player._id,
      walletAddress: args.walletAddress,
      characterId: args.characterId,
      
      // Betting core data
      betAmount: args.betAmount,
      betTimestamp: Date.now(),
      betType: "self",
      odds: 1,
      status: "pending",
      placedAt: Date.now(),
      
      // Settlement tracking
      onChainConfirmed: false,
      txSignature: args.txSignature,
      
      // UI positioning (moved from gameParticipants)
      size: 1 + (args.betAmount / 10_000_000_000) * 0.5,
      spawnIndex: existingParticipants.length,
      position: { x: 0, y: 0 },
      
      // Game state (moved from gameParticipants)
      eliminated: false,
      winChance: undefined,
      isWinner: undefined,
      spectatorBets: [], // Empty array initially
      
      // ... other fields
    });

    return { betId, gameId: game._id };
  },
});
```

**Enhanced spectator betting within the `bets` table:**

```typescript
// ENHANCED: Place spectator bet as additional bet record
export const placeSpectatorBet = mutation({
  args: {
    targetBetId: v.id("bets"), // Bet on existing participant
    betterWallet: v.string(),
    amount: v.number(),
    txSignature: v.string(),
  },
  handler: async (ctx, args) => {
    const targetBet = await ctx.db.get(args.targetBetId);
    if (!targetBet) throw new Error("Target participant bet not found");

    // Add to spectatorBets array on the target bet
    const newSpectatorBet = {
      betterWallet: args.betterWallet,
      betterId: args.betterId,
      amount: args.amount,
      placedAt: Date.now(),
      txSignature: args.txSignature,
    };

    const updatedSpectatorBets = [...(targetBet.spectatorBets || []), newSpectatorBet];

    await ctx.db.patch(args.targetBetId, {
      spectatorBets: updatedSpectatorBets,
    });

    return args.targetBetId;
  },
});
```

#### **1.2 Remove Redundant `gameParticipants` Table Functions**

**Files to update:**
- [ ] `convex/gameParticipants.ts` - Remove or consolidate functions
- [ ] `convex/gameManagerDb.ts` - Remove `getGameParticipants`, `deleteParticipant`
- [ ] `convex/schema.ts` - Remove `gameParticipants` table definition

#### **1.3 Update Query Functions**

```typescript
// UPDATED: Get enhanced bet data with participant positioning
export const getGameParticipants = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const bets = await ctx.db
      .query("bets")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("betType"), "self")) // Only self bets represent participants
      .collect();

    // Calculate additional betting stats
    const participantsWithStats = bets.map(bet => {
      const totalSpectatorBets = bet.spectatorBets?.reduce(
        (sum, spectatorBet) => spectatorBet.amount + sum, 0
      ) || 0;

      const totalBetAmount = bet.betAmount + totalSpectatorBets;
      
      return {
        ...bet,
        totalBetAmount,
        spectatorBetCount: bet.spectatorBets?.length || 0,
        totalSpectatorBets,
      };
    });

    return participantsWithStats;
  },
});
```

### **Phase 2: Frontend Updates**

#### **2.1 Update Component Imports**

**File: `src/components/CharacterSelection.tsx`**
```typescript
// NO CHANGE NEEDED - already uses:
const placeEntryBet = useMutation(api.bets.placeEntryBet);

// Function will work with enhanced bets table
```

#### **2.2 Enable `MultiParticipantPanel.tsx`**

```typescript
// UNCOMMENT and update query:
export function MultiParticipantPanel() {
  const { connected, publicKey } = usePrivyWallet();
  const walletAddress = connected && publicKey ? publicKey.toString() : null;

  // Get current game from unified game state
  const gameData = useQuery(api.gameManagerDb.getGameState);
  const currentGame = gameData?.game;

  // Get participants from enhanced bets table
  const allParticipants = useQuery(
    api.bets.getGameParticipants, // Updated to use bets table
    currentGame ? { gameId: currentGame._id } : "skip"
  );

  // ... rest of component logic using consolidated data from bets table
}
```

#### **2.3 Update Game Scene Integration**

**File: `src/game/scenes/Game.ts`**
- No changes needed - already receives consolidated `gameState`
- Bet positioning and visual data now available in bets table

### **Phase 3: Database Migration**

#### **3.1 Data Migration Script**

```typescript
// NEW: convex/migrations/consolidate-participants-to-bets.ts
export default async function migrateParticipantsToBets(ctx: any) {
  console.log("Starting gameParticipants table consolidation migration...");

  // Get all existing participants and bets
  const allParticipants = await ctx.db.query("gameParticipants").collect();
  const allBets = await ctx.db.query("bets").collect();

  let migratedCount = 0;
  let errorCount = 0;

  for (const participant of allParticipants) {
    try {
      // Find corresponding self bet for this participant
      const selfBet = allBets.find(bet => 
        bet.gameId === participant.gameId && 
        bet.walletAddress === participant.walletAddress &&
        bet.betType === "self"
      );

      if (!selfBet) {
        console.warn(`No self bet found for participant ${participant._id}`);
        continue;
      }

      // Find all spectator bets for this participant
      const spectatorBets = allBets.filter(bet => 
        bet.targetParticipantId === participant._id && 
        bet.betType !== "self"
      );

      // Build spectator bets array
      const spectatorBetsArray = spectatorBets.map(bet => ({
        betterWallet: bet.walletAddress,
        betterId: bet.playerId,
        amount: bet.amount,
        placedAt: bet.placedAt,
        odds: bet.odds,
        txSignature: bet.txSignature,
      }));

      // Update the self bet with participant positioning and game data
      await ctx.db.patch(selfBet._id, {
        // Add positioning data from participant
        position: participant.position,
        targetPosition: participant.targetPosition,
        size: participant.size,
        spawnIndex: participant.spawnIndex,
        
        // Add game progression data
        eliminated: participant.eliminated,
        eliminatedAt: participant.eliminatedAt,
        eliminatedBy: participant.eliminatedBy, // Will need ID conversion
        finalPosition: participant.finalPosition,
        isWinner: participant.isWinner,
        
        // Add consolidated spectator bets
        spectatorBets: spectatorBetsArray,
        
        // Add character reference
        characterId: participant.characterId,
        
        // Preserve bet timestamp
        betTimestamp: participant.betTimestamp,
        winChance: participant.winChance,
      });

      migratedCount++;
    } catch (error) {
      console.error(`Failed to migrate participant ${participant._id}:`, error);
      errorCount++;
    }
  }

  console.log(`Migration complete: ${migratedCount} participants migrated to bets, ${errorCount} errors`);
  
  // DON'T DELETE GAMEPARTICIPANTS TABLE YET - keep for rollback safety
  return { migratedCount, errorCount };
}

function determineSettlementStatus(bets: any[]) {
  if (bets.length === 0) return "pending";
  if (bets.every(bet => bet.status === "won")) return "won";
  if (bets.every(bet => bet.status === "lost")) return "lost";
  if (bets.some(bet => bet.status === "refunded")) return "refunded";
  return "pending";
}
```

### **Phase 4: Testing & Validation**

#### **4.1 Backend Testing**
- [ ] Test enhanced `placeEntryBet` creates proper bet records with positioning
- [ ] Test `getGameParticipants` returns all data from bets table
- [ ] Test game progression with consolidated data in bets table
- [ ] Verify settlement logic works correctly

#### **4.2 Frontend Testing**
- [ ] Test character selection and bet placement (no changes needed)
- [ ] Test participant panel displays correctly using bets data
- [ ] Test game scene receives proper data from bets table
- [ ] Test real-time updates during game

#### **4.3 Integration Testing**
- [ ] Test complete betting workflow with enhanced bets table
- [ ] Test game lifecycle with consolidated schema in bets
- [ ] Test cleanup operations work correctly

## 📋 **Implementation Checklist**

### **Backend Updates**
- [ ] Update `convex/schema.ts` - enhance `bets` table, keep `gameParticipants` table temporarily
- [ ] Enhance existing `api.bets.placeEntryBet` function with positioning data
- [ ] Create new `api.bets.placeSpectatorBet` function
- [ ] Update `api.bets.getGameParticipants` with positioning and game stats
- [ ] Update `convex/gameManagerDb.ts` cleanup functions to remove gameParticipants references
- [ ] Create migration script

### **Frontend Updates**
- [ ] Update `src/components/CharacterSelection.tsx` - no changes needed (already uses api.bets.placeEntryBet)
- [ ] Uncomment and update `src/components/MultiParticipantPanel.tsx` to use `api.bets.getGameParticipants`
- [ ] Test `src/game/scenes/Game.ts` still works (no changes needed)
- [ ] Update any other components using gameParticipants APIs to use bets APIs

### **Migration & Cleanup**
- [ ] Run migration script in development
- [ ] Validate data integrity between gameParticipants and enhanced bets
- [ ] Test full application workflow with bets as primary table
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Remove old `gameParticipants` table after validation period

## ⚠️ **Risk Mitigation**

### **Data Safety**
- Keep `gameParticipants` table during migration for rollback capability
- Test migration on development environment first
- Validate data integrity before production deployment

### **Rollback Plan**
- Migration script can be reversed by recreating `gameParticipants` table from enhanced bets data
- Frontend can be quickly reverted to use old APIs if needed
- Database schema can be rolled back if needed

## 🎉 **Expected Benefits**

### **Simplified Architecture**
- ✅ Single source of truth for bet AND participant data
- ✅ No complex joins between participants and bets
- ✅ Cleaner API surface for frontend

### **Improved Performance**
- ✅ Fewer database queries needed
- ✅ Reduced data duplication
- ✅ Faster bet/participant list rendering

### **Better Data Consistency**
- ✅ No sync issues between participant and betting data
- ✅ Atomic updates for bet/participant state
- ✅ Simpler settlement logic

### **Enhanced Maintainability**
- ✅ Schema matches blockchain `BetEntry` structure more closely
- ✅ Easier to add new betting features
- ✅ Clearer data ownership model

This consolidation will significantly simplify the codebase while preserving all essential functionality for both game visualization and betting mechanics, with `bets` as the primary table containing all participant and betting data.