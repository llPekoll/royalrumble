# Convex Schema Update Plan

## 🎯 **Objective**
Clean up the Convex schema by eliminating redundancy between `games` and `gameStates` tables while preserving essential UI functionality for positioning, animations, and system health monitoring.

## 📊 **Current Issues Analysis**

### **Major Redundancy**
- ❌ **`games` + `gameStates`** tables duplicate game status, timing, and player counts
- ❌ **Complex UI phases** not needed for VRF-based winner selection
- ❌ **Spectator betting** features not implemented in Anchor program
- ❌ **Over-engineered elimination logic** for simple betting game

### **Reference Errors**
- ❌ `recentWinners.playerId: v.id("player")` → Invalid table reference (should be `"players"`)

### **MVP Scope Creep**
- ❌ Large game phases removed from Anchor program but still in schema
- ❌ Complex betting pools not needed for simple "winner takes all" model

---

## 🧹 **Phase 1: Schema Consolidation**

### **1.1 Merge `games` + `gameStates` → Single `games` Table**

#### **Keep from `gameStates` (Blockchain Mirror)**
```typescript
// Blockchain fields (from Anchor GameRound)
roundId: v.number(),              // PRIMARY KEY - matches blockchain
status: v.string(),               // "idle", "waiting", "awaitingWinnerRandomness", "finished"
startTimestamp: v.optional(v.number()),  // From blockchain
initialPot: v.optional(v.number()),      // From blockchain (sum of all bets)
winner: v.optional(v.string()),          // Winner wallet address
playersCount: v.number(),                // From blockchain bets.length

// VRF fields (from blockchain)
vrfRequestPubkey: v.optional(v.string()),
randomnessFulfilled: v.optional(v.boolean()),
```

#### **Keep from `games` (UI Enhancement)**
```typescript
// UI enhancement fields
mapId: v.id("maps"),              // Which map to display
winnerId: v.optional(v.id("gameParticipants")), // UI reference to winner

// Essential timing
phaseStartTime: v.number(),       // When current phase started
waitingDuration: v.number(),      // Duration for waiting phase

// Cron management
lastChecked: v.number(),          // Cron job tracking
lastUpdated: v.number(),          // Last blockchain sync
```

#### **Remove (Redundant/Complex)**
```typescript
// ❌ Complex UI phases
status: v.union(...),             // Replace with simple string
phase: v.number(),
nextPhaseTime: v.number(),
endTime: v.optional(v.number()),

// ❌ Betting complexity
selfBetPool: v.number(),          // Redundant with initialPot
spectatorBetPool: v.number(),     // Not in MVP
spectatorBets: v.number(),        // Not implemented

// ❌ Large game features
survivorIds: v.optional(v.array(...)), // Not in small games MVP
blockchainCallStatus: v.optional(...),  // Over-engineered
isSinglePlayer: v.boolean(),      // Not needed for MVP
isSmallGame: v.boolean(),         // Always true in MVP

// ❌ Duplicate fields
startTime: v.number(),            // Duplicate of startTimestamp
totalPot: v.number(),             // Duplicate of initialPot
participantCount: v.number(),     // Duplicate of playersCount
```

---

## 🧹 **Phase 2: Simplify Supporting Tables**

### **2.1 Simplify `gameParticipants` (Keep UI Fields)**

#### **✅ KEEP (Essential for UI)**
```typescript
// Blockchain mirror
walletAddress: v.string(),        // From BetEntry (made required)
betAmount: v.number(),            // From BetEntry
betTimestamp: v.number(),         // From BetEntry timestamp
winChance: v.optional(v.number()), // at bet time

// UI positioning (ESSENTIAL for frontend)
position: v.object({ x: v.number(), y: v.number() }),
targetPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
size: v.number(),                 // Visual size based on bet
spawnIndex: v.number(),           // Spawn position index

// Game progression
eliminated: v.boolean(),
eliminatedAt: v.optional(v.number()),
eliminatedBy: v.optional(v.id("gameParticipants")),
finalPosition: v.optional(v.number()),
isWinner: v.optional(v.boolean()),

// Display enhancements
characterId: v.id("characters"),
displayName: v.optional(v.string()),
colorHue: v.optional(v.number()),
```

#### **❌ REMOVE**
```typescript
spectatorBets: v.number(),        // Not in MVP

```

### **2.2 Simplify `bets` Table**

#### **✅ KEEP (Core Functionality)**
```typescript
gameId: v.id("games"),
playerId: v.id("players"),
walletAddress: v.string(),
betType: v.union(v.literal("self"), v.literal("refund")), // Remove spectator
odds: v.optional(v.number()),     // at bet time
targetParticipantId: v.id("gameParticipants"),
amount: v.number(),
payout: v.optional(v.number()),
status: v.union(...),             // Keep all statuses
placedAt: v.number(),
settledAt: v.optional(v.number()),
```

#### **❌ REMOVE**
```typescript
betType: v.literal("spectator"),  // Not in MVP

```

### **2.3 Fix `recentWinners` Table**

#### **🔧 FIX Reference Error**
```typescript
// ❌ BEFORE
playerId: v.id("player"),         // Invalid table reference

// ✅ AFTER  
// Remove playerId entirely - not needed for display
roundId: v.number(),
walletAddress: v.string(),
characterId: v.id("characters"),
characterName: v.string(),
betAmount: v.number(),
participantCount: v.number(),
totalPayout: v.number(),
timestamp: v.number(),
```

---

## 🧹 **Phase 3: Update Indexes**

### **3.1 New `games` Table Indexes**
```typescript
.index("by_round_id", ["roundId"])     // Primary lookup
.index("by_status", ["status"])        // Status filtering
.index("by_last_checked", ["lastChecked"]) // Cron optimization
```

### **3.2 Updated `gameEvents` Indexes**
```typescript
// Change from gameId to roundId for consistency
.index("by_round_id", ["roundId"])     // Match games table
.index("by_timestamp", ["timestamp"])
.index("by_event", ["event"])
.index("by_success", ["success"])
```

---

## 🚀 **Phase 4: Migration Strategy**

### **4.1 Preparation Steps**
1. **Backup Current Data**
   - Export existing games and gameStates data
   - Document current query patterns

2. **Update Schema File**
   - Implement new unified `games` table
   - Fix reference errors
   - Remove redundant fields

3. **Update Query Functions**
   - Modify `gameManagerDb.ts` functions
   - Update frontend queries in components
   - Test all data access patterns

### **4.2 Code Updates Required**

#### **Backend Files to Update**
- `convex/gameManagerDb.ts` - Core database operations
- `convex/gameManager.ts` - Cron job logic  
- `convex/games.ts` - UI game queries
- `convex/gameParticipants.ts` - Participant queries
- `convex/bets.ts` - Betting logic

#### **Frontend Files to Update**
- `src/components/GameLobby.tsx` - Query current game
- `src/components/CharacterSelection.tsx` - Game state checks
- `src/App.tsx` - Game state display
- Any other components using game queries

### **4.3 Testing Strategy**
1. **Unit Tests** - Verify all queries work with new schema
2. **Integration Tests** - Test cron jobs with unified table
3. **UI Tests** - Ensure frontend displays correctly
4. **Blockchain Sync Tests** - Verify Solana integration still works

---

## 📋 **Phase 5: Implementation Checklist**

### **Schema Update**
- [ ] Update `schema.ts` with unified `games` table
- [ ] Fix `recentWinners` table reference error
- [ ] Remove redundant fields from all tables
- [ ] Update all table indexes

### **Backend Updates**
- [ ] Update `gameManagerDb.ts` functions
- [ ] Modify `gameManager.ts` cron logic
- [ ] Test all database operations
- [ ] Verify Solana blockchain sync

### **Frontend Updates**  
- [ ] Update `GameLobby.tsx` queries
- [ ] Fix `CharacterSelection.tsx` game checks
- [ ] Update `App.tsx` game state logic
- [ ] Test UI positioning/animations still work

### **Quality Assurance**
- [ ] All TypeScript errors resolved
- [ ] No broken queries or undefined references
- [ ] UI animations and positioning preserved
- [ ] System health monitoring functional
- [ ] Cron jobs working with new schema

---

## 🎉 **Expected Benefits**

### **Simplified Architecture**
- ✅ Single source of truth for game state
- ✅ No sync issues between duplicate tables
- ✅ Cleaner query patterns

### **Improved Performance**
- ✅ Fewer database tables to maintain
- ✅ Simpler cron job logic
- ✅ Reduced data duplication

### **Better Maintainability**
- ✅ Schema directly mirrors Anchor program structure
- ✅ Clear separation of blockchain vs UI data
- ✅ Easier to debug and extend

### **Preserved Functionality**
- ✅ UI positioning and animations maintained
- ✅ System health monitoring kept
- ✅ All essential game features preserved
- ✅ Blockchain integration unchanged

---

## ⚠️ **Risk Mitigation**

### **Data Loss Prevention**
- Export all current data before schema changes
- Test migration on development environment first
- Keep backup of original schema file

### **Downtime Minimization**
- Plan migration during low-usage periods
- Have rollback plan ready
- Monitor system health during migration

### **Feature Preservation**
- Document all current UI behaviors
- Test positioning/animation systems thoroughly
- Verify system monitoring dashboard functionality

This plan ensures a clean, maintainable schema while preserving all the UI functionality you need for the game frontend.