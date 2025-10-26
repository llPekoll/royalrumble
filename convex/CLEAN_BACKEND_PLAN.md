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
Define a single table to store blockchain events:

```typescript
// Table: blockchainEvents
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

**Indexes needed:**
- `by_signature` - Prevent duplicate events
- `by_event_name` - Query by event type
- `by_round_id` - Query events for specific game
- `by_block_time` - Chronological ordering

---

#### 2. **`eventListener.ts`** - Blockchain Event Listener
Simple polling system that:
- Fetches recent transactions from the Solana program
- Parses event logs
- Saves to database (deduped by signature)

```typescript
// Main function (called by cron every 5s)
export const listenToBlockchainEvents = internalAction({
  handler: async (ctx) => {
    // 1. Get SolanaClient instance
    // 2. Fetch recent signatures (last 30 seconds worth)
    // 3. For each signature:
    //    - Parse transaction for program events
    //    - Check if already saved (by signature)
    //    - Save to blockchainEvents table
    // 4. Log summary (X new events found)
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
```

---

#### 3. **`events.ts`** - Query Functions (Optional but Recommended)
Simple read-only queries to view saved events:

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

---

## Implementation Checklist

### Step 1: Schema
- [ ] Create `schema.ts`
- [ ] Define `blockchainEvents` table
- [ ] Add indexes (signature, eventName, roundId, blockTime)
- [ ] Test: Run `npx convex dev` to validate schema

### Step 2: Event Listener
- [ ] Create `eventListener.ts`
- [ ] Implement `listenToBlockchainEvents` action
- [ ] Add event parsing logic (Anchor events)
- [ ] Add deduplication by signature
- [ ] Test: Manually trigger listener, verify events saved

### Step 3: Query Functions
- [ ] Create `events.ts`
- [ ] Implement basic query functions
- [ ] Test: Query events from Convex dashboard

### Step 4: Cron Integration
- [ ] Verify `crons.ts` calls `internal.eventListener.listenToBlockchainEvents`
- [ ] Test: Run system for 1 minute, verify events accumulating

---

## What We're NOT Doing (Yet)

❌ **Game state management** - No syncing game rounds to Convex  
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
2. Saves all domin8 program events to database
3. Prevents duplicate events
4. Can query events by type, round, or time
5. Runs without errors for 10+ minutes

✅ **Clean codebase:**
- No unused code
- Clear separation of concerns
- Easy to understand and extend

**Then and only then, we add more features.**
