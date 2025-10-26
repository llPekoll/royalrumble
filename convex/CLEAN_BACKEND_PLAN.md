# Clean Convex Backend Rebuild Plan

## Current State ✅

### Files That Stay (No Changes Needed)
- **`/lib/`** - Solana program integration layer
  - `domin8_prgm.json` - IDL from deployed program ✓ Correct
  - `types.ts` - TypeScript types for Solana program ⚠️ May need review
  - `solana.ts` - Solana client wrapper ⚠️ May need review
  - `gamePhases.ts` - Phase calculation utilities ⚠️ May need review

- **`characters.ts`** - Frontend UI queries ✓ No changes
- **`maps.ts`** - Frontend UI queries ✓ No changes  
- **`players.ts`** - Frontend UI queries ✓ No changes

### Files Modified
- **`crons.ts`** - Simplified cron jobs
  - ✅ Event listener cron (every 5s) - Keep active
  - 🔜 Game recovery cron - Commented out for later
  - 🔜 Transaction cleanup - Commented out for later
  - 🔜 Game cleanup - Commented out for later

---

## Phase 1: Minimal Blockchain Event Listener 🎯

### Goal
Create the simplest possible system to:
1. Listen to Solana blockchain events from the domin8 program
2. Save raw event data to Convex database
3. Make events queryable for monitoring

### Files to Create

#### 1. **`schema.ts`** - Database Schema
Define two tables:

**Table 1: `blockchainEvents`** - Store raw blockchain events
```typescript
{
  _id: Id<"blockchainEvents">
  _creationTime: number
  
  // Event identification
  eventName: string              // e.g., "GameCreated", "BetPlaced", "WinnerSelected"
  signature: string              // Transaction signature
  slot: number                   // Solana slot number
  blockTime: number              // Unix timestamp from blockchain
  
  // Event data (raw)
  eventData: any                 // Full event data as JSON
  
  // Metadata
  roundId?: number               // Game round ID (if applicable)
  processed: boolean             // For future use if we want to process events
}
```

**Indexes for `blockchainEvents`:**
- `by_signature` - Prevent duplicate events
- `by_event_name` - Query by event type
- `by_round_id` - Query events for specific game
- `by_block_time` - Chronological ordering

---

**Table 2: `gameRoundStates`** - Store game round state snapshots
```typescript
{
  _id: Id<"gameRoundStates">
  _creationTime: number
  
  // Round identification
  roundId: number                // Game round ID
  status: string                 // "waiting" | "awaitingWinnerRandomness" | "finished"
  
  // Timestamps
  startTimestamp: number         // When round started
  endTimestamp: number           // When betting window closes
  capturedAt: number             // When this state was captured (Unix timestamp)
  
  // Game state (snapshot from blockchain)
  betCount: number               // Number of bets placed
  betAmounts: number[]           // Array of bet amounts (max 64)
  totalPot: number               // Total accumulated pot
  winner: string | null          // Winner wallet (base58), null if not determined
  winningBetIndex: number        // Index of winning bet
  
  // VRF data
  vrfRequestPubkey: string | null
  vrfSeed: number[]
  randomnessFulfilled: boolean
  
  // Single-player fields
  winnerPrizeUnclaimed?: number
}
```

**Indexes for `gameRoundStates`:**
- `by_round_and_status` - Composite index on (roundId, status) - Prevent duplicate states
- `by_round_id` - Query all states for a round
- `by_status` - Query rounds by status
- `by_captured_at` - Chronological ordering

**Key constraint:** Only ONE row per `(roundId, status)` combination
- Round 0: 3 rows maximum (waiting, awaitingWinnerRandomness, finished)
- Round 1: 3 rows maximum (waiting, awaitingWinnerRandomness, finished)
- etc.

---

#### 2. **`eventListener.ts`** - Blockchain Event Listener
Two main responsibilities:

**A) Listen to blockchain events** (existing plan)
- Fetches recent transactions from the Solana program
- Parses event logs
- Saves to `blockchainEvents` table (deduped by signature)

**B) Poll game round state** (NEW)
- Calls `solanaClient.getGameRound()` to get current PDA state
- Checks if `(roundId, status)` combination already exists in DB
- If not, inserts new row into `gameRoundStates` table
- Each round will have exactly 3 state snapshots: waiting → awaitingWinnerRandomness → finished

```typescript
// Main function (called by cron every 5s)
export const listenToBlockchainEvents = internalAction({
  handler: async (ctx) => {
    // PART 1: Event listening (existing)
    // 1. Get SolanaClient instance
    // 2. Fetch recent signatures (last 30 seconds worth)
    // 3. For each signature:
    //    - Parse transaction for program events
    //    - Check if already saved (by signature)
    //    - Save to blockchainEvents table
    // 4. Log summary (X new events found)
    
    // PART 2: Game round state polling (NEW)
    // 1. Get current game round from blockchain (getGameRound())
    // 2. Extract: roundId, status, all game data
    // 3. Check if state already captured: query gameRoundStates by (roundId, status)
    // 4. If not exists, insert new row
    // 5. Log: "Captured Round X: status Y"
  }
});

// Helper: Parse program logs for events
function parseEventsFromLogs(logs: string[]): Event[] {
  // Use Anchor event parsing or simple string matching
  // Return array of {eventName, eventData}
}

// Helper: Check if event already saved
async function isEventSaved(ctx, signature: string): Promise<boolean> {
  // Query blockchainEvents by signature
}

// Helper: Check if game state already captured (NEW)
async function isStateCaptured(ctx, roundId: number, status: string): Promise<boolean> {
  // Query gameRoundStates by roundId + status composite index
  // Return true if row exists
}

// Helper: Save game round state (NEW)
async function saveGameRoundState(ctx, gameRound: GameRound): Promise<void> {
  // Insert into gameRoundStates table
  // Capture all relevant fields from blockchain PDA
}
```

---

#### 3. **`events.ts`** - Query Functions
Simple read-only queries to view saved data:

**Blockchain Events Queries:**
```typescript
// Get all events (paginated)
export const getAllEvents = query({...});

// Get events by type
export const getEventsByName = query({...});

// Get events for a specific round
export const getEventsByRound = query({...});

// Get recent events (last N)
export const getRecentEvents = query({...});
```

**Game Round States Queries (NEW):**
```typescript
// Get all states for a specific round
export const getRoundStates = query({
  args: { roundId: v.number() },
  // Returns array of states: [waiting, awaitingWinnerRandomness, finished]
});

// Get current round state (latest captured)
export const getCurrentRoundState = query({
  // Returns the most recent gameRoundStates entry
});

// Get rounds by status
export const getRoundsByStatus = query({
  args: { status: v.string() },
  // Returns all rounds in a specific status
});

// Get state transition history for a round
export const getRoundStateHistory = query({
  args: { roundId: v.number() },
  // Returns states ordered by capturedAt timestamp
  // Shows progression: waiting → awaitingWinnerRandomness → finished
});
```

---

## Implementation Checklist

### Step 1: Schema
- [ ] Create `schema.ts`
- [ ] Define `blockchainEvents` table with indexes
- [ ] Define `gameRoundStates` table with composite index on (roundId, status)
- [ ] Test: Run `npx convex dev` to validate schema

### Step 2: Event Listener
- [ ] Create `eventListener.ts`
- [ ] Implement Part A: Blockchain events polling
  - [ ] Fetch recent signatures
  - [ ] Parse event logs
  - [ ] Save to `blockchainEvents` (deduped by signature)
- [ ] Implement Part B: Game round state polling (NEW)
  - [ ] Call `solanaClient.getGameRound()`
  - [ ] Check if `(roundId, status)` already in DB
  - [ ] Save to `gameRoundStates` if new state
- [ ] Test: Manually trigger listener, verify both tables populated

### Step 3: Query Functions
- [ ] Create `events.ts`
- [ ] Implement blockchain event queries
- [ ] Implement game round state queries (NEW)
- [ ] Test: Query both tables from Convex dashboard

### Step 4: Cron Integration
- [ ] Verify `crons.ts` calls `internal.eventListener.listenToBlockchainEvents`
- [ ] Test: Run system for 1 minute, verify data accumulating
- [ ] Verify: Each round has max 3 state rows (waiting, awaitingWinnerRandomness, finished)

---

## What We're NOT Doing (Yet)

❌ **Transaction tracking** - No tracking crank transactions  
❌ **Game recovery** - No auto-healing logic  
❌ **Cleanup jobs** - No old data pruning  
❌ **WebSocket subscriptions** - No real-time event streaming  
❌ **Frontend integration** - No UI changes yet  

**Keep it simple. Just save events. Test it. Then iterate.**

---

## Review Points for `/lib/` Files

### `types.ts`
- ✅ Verify `GameStatus` enum matches IDL
- ✅ Verify `GameRound` interface matches current program state
- ✅ Check if `BetEntry` fields are up-to-date

### `solana.ts`
- ✅ Verify `getGameRound()` method works with current program
- ✅ Check if event parsing is available or needs to be added
- ⚠️ May need to add `getRecentSignatures()` method for event listener

### `gamePhases.ts`
- ✅ Verify phase calculation logic matches current game flow
- ✅ Ensure no polling dependencies

---

## Success Criteria

✅ **Minimal system that:**
1. Listens to blockchain every 5 seconds
2. Saves all domin8 program events to `blockchainEvents` table
3. Saves game round state snapshots to `gameRoundStates` table (NEW)
   - Each round has exactly 3 states: waiting → awaitingWinnerRandomness → finished
   - No duplicate states per round (enforced by composite index)
4. Prevents duplicate events (by signature)
5. Can query events by type, round, or time
6. Can query round state history and transitions (NEW)
7. Runs without errors for 10+ minutes

✅ **Clean codebase:**
- No unused code
- Clear separation of concerns (events vs. game states)
- Easy to understand and extend

✅ **Data integrity:**
- Each `(roundId, status)` combination appears only once in `gameRoundStates`
- Round 0: max 3 rows (one per status)
- Round 1: max 3 rows (one per status)
- etc.

**Then and only then, we add more features.**
