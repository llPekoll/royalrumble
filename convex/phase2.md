# Backend Game State Scheduler Implementation Plan

## Overview
This plan implements automated game progression in Convex, calling Solana instructions at the right times to transition games through their phases: `waiting` → `awaitingWinnerRandomness` → `finished`.

---

## Current State ✅

### What's Working
1. ✅ **Event Listener Cron** (every 5s)
   - Captures game round states from blockchain
   - Stores in `gameRoundStates` table
   - Each round has max 3 states: `waiting`, `awaitingWinnerRandomness`, `finished`

2. ✅ **Database Schema**
   - `gameRoundStates` table with composite index on `(roundId, status)`
   - Prevents duplicate state captures

3. ✅ **Solana Client Methods**
   - ✅ `getGameRound()` - Fetches current game state
   - ✅ `closeBettingWindow()` - Closes betting, handles single-player refunds
   - ✅ `selectWinnerAndPayout()` - Selects winner via VRF, pays out
   - ✅ `checkVrfFulfillment()` - Checks if VRF is ready

---

## Game Flow Timeline

```
Time 0s:     Player places first bet (frontend calls create_game)
             → GameRound created on Solana
             → Status: "waiting"
             → VRF request created (mock in localnet)
             → endTimestamp = startTimestamp + 30s

Time 0-30s:  More players join
             → Status: "waiting"
             → Convex captures this state (one snapshot)

Time 30s:    endTimestamp reached
             → Convex scheduler triggers closeBettingWindow()
             → Smart contract logic:
                * If 1 unique player: Immediate refund → Status: "finished"
                * If 2+ players: Status: "awaitingWinnerRandomness"

If 2+ players:
Time 30-40s: VRF fulfills (3-8s typically)
             → Convex polls VRF fulfillment
             → When fulfilled: calls selectWinnerAndPayout()
             → Status: "finished"
             → Counter incremented
             → Bets unlocked

Next round:  Frontend places bet → creates new game
```

---

## Architecture Design

### New Files to Create

#### 1. **`gameScheduler.ts`** - Main Scheduler Logic
Contains internal actions for game progression:

```typescript
// Main scheduled actions
- scheduleCloseBetting(roundId, endTimestamp)   // Called when "waiting" state captured
- schedulerCheckVrf(roundId)                    // Called when "awaitingWinnerRandomness" captured

// Worker actions (executed at scheduled times)
- executeCloseBetting(roundId)                  // Runs at endTimestamp
- executeCheckVrf(roundId)                      // Polls VRF every 2s
```

#### 2. **`gameSchedulerMutations.ts`** - Database Operations
Contains internal mutations for tracking scheduled jobs:

```typescript
- saveScheduledJob(jobId, roundId, action, scheduledTime)
- markJobCompleted(jobId)
- getActiveJobs(roundId)
```

#### 3. **Schema Updates** - New Table for Job Tracking

```typescript
scheduledJobs: defineTable({
  jobId: v.string(),           // Unique job ID (Convex scheduler ID)
  roundId: v.number(),         // Game round
  action: v.string(),          // "close_betting" | "check_vrf"
  scheduledTime: v.number(),   // When to execute (Unix timestamp)
  status: v.string(),          // "pending" | "completed" | "failed"
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
})
  .index("by_round_and_status", ["roundId", "status"])
  .index("by_status", ["status"])
```

---

## Implementation Details

### Phase 1: Close Betting Scheduler

**Trigger:** When eventListener.ts captures a "waiting" state

**Flow:**
1. Event listener detects new `waiting` state
2. Calculates delay: `endTimestamp - currentTime`
3. Schedules `executeCloseBetting()` using `ctx.scheduler.runAfter()`
4. Stores job info in `scheduledJobs` table

**Code in eventListener.ts:**
```typescript
// After saving "waiting" state
if (status === "waiting") {
  await ctx.scheduler.runAfter(
    delay_in_ms,
    internal.gameScheduler.executeCloseBetting,
    { roundId }
  );
}
```

**Code in `gameScheduler.ts`:**
```typescript
export const executeCloseBetting = internalAction({
  args: { roundId: v.number() },
  handler: async (ctx, { roundId }) => {
    // 1. Verify game is still in "waiting" status
    const latestState = await ctx.runQuery(
      internal.events.getLatestRoundState,
      { roundId }
    );
    
    if (latestState?.status !== "waiting") {
      // Already progressed (maybe manual crank call)
      return;
    }
    
    // 2. Call Solana closeBettingWindow()
    const solanaClient = new SolanaClient(...);
    const txSignature = await solanaClient.closeBettingWindow();
    
    // 3. Wait for confirmation
    await solanaClient.confirmTransaction(txSignature);
    
    // 4. Log result
    console.log(`Round ${roundId}: Betting closed. Tx: ${txSignature}`);
  }
});
```

---

### Phase 2: VRF Check Scheduler

**Trigger:** When eventListener.ts captures "awaitingWinnerRandomness" state

**Flow:**
1. Event listener detects new `awaitingWinnerRandomness` state
2. Immediately schedules first VRF check (after 2s)
3. VRF checker polls every 2s until fulfilled (max 10 attempts = 20s)
4. When fulfilled: calls `selectWinnerAndPayout()`

**Code in eventListener.ts:**
```typescript
// After saving "awaitingWinnerRandomness" state
if (status === "awaitingWinnerRandomness") {
  await ctx.scheduler.runAfter(
    2000, // 2 seconds
    internal.gameScheduler.executeCheckVrf,
    { roundId, attempt: 1 }
  );
}
```

**Code in `gameScheduler.ts`:**
```typescript
export const executeCheckVrf = internalAction({
  args: {
    roundId: v.number(),
    attempt: v.number(),
  },
  handler: async (ctx, { roundId, attempt }) => {
    const MAX_ATTEMPTS = 10; // 20 seconds total
    
    // 1. Get latest game state
    const latestState = await ctx.runQuery(
      internal.events.getLatestRoundState,
      { roundId }
    );
    
    // Already finished (manual crank or previous check)
    if (latestState?.status === "finished") {
      return;
    }
    
    // Wrong state
    if (latestState?.status !== "awaitingWinnerRandomness") {
      console.warn(`Round ${roundId}: Unexpected state ${latestState?.status}`);
      return;
    }
    
    // 2. Check VRF fulfillment
    const solanaClient = new SolanaClient(...);
    const vrfFulfilled = await solanaClient.checkVrfFulfillment(
      latestState.vrfRequestPubkey
    );
    
    if (vrfFulfilled) {
      // 3. VRF is ready! Call selectWinnerAndPayout
      console.log(`Round ${roundId}: VRF fulfilled on attempt ${attempt}`);
      const txSignature = await solanaClient.selectWinnerAndPayout(
        latestState.vrfRequestPubkey!
      );
      
      // 4. Wait for confirmation
      await solanaClient.confirmTransaction(txSignature);
      
      console.log(`Round ${roundId}: Winner selected. Tx: ${txSignature}`);
      return;
    }
    
    // 5. VRF not ready yet - schedule next check
    if (attempt < MAX_ATTEMPTS) {
      console.log(`Round ${roundId}: VRF not ready, retry ${attempt + 1}/${MAX_ATTEMPTS}`);
      await ctx.scheduler.runAfter(
        2000, // 2 seconds
        internal.gameScheduler.executeCheckVrf,
        { roundId, attempt: attempt + 1 }
      );
    } else {
      // MAX attempts reached - log warning
      console.error(`Round ${roundId}: VRF fulfillment timeout after ${MAX_ATTEMPTS} attempts`);
      // Recovery mechanism will handle this (future feature)
    }
  }
});
```

---

### Phase 3: Handle Single-Player Games

**Special Case:** When only 1 unique player places all bets

**Smart Contract Behavior:**
- `closeBettingWindow()` detects 1 unique player
- Attempts automatic refund transfer
- Sets status to `"finished"` immediately
- Increments counter for next round
- Unlocks bets

**Convex Handling:**
```typescript
// In executeCloseBetting():
// After closeBettingWindow() succeeds:
const newState = await solanaClient.getGameRound();

if (newState?.status === "finished") {
  console.log(`Round ${roundId}: Single-player game completed (auto-refund)`);
  // No VRF check needed - game already finished
  return;
}

// Multi-player game - VRF check will be scheduled by event listener
// when it captures the "awaitingWinnerRandomness" state
```

---

## Integration Points

### Modify eventListener.ts

Add scheduling logic after capturing states:

```typescript
async function captureGameRoundState(ctx: any, solanaClient: SolanaClient) {
  try {
    const gameRound = await solanaClient.getGameRound();
    if (!gameRound) {
      return;
    }
    
    const { roundId, status } = gameRound;
    
    // Check if already captured
    const existingState = await ctx.runMutation(
      internal.eventListenerMutations.checkStateCaptured,
      { roundId, status }
    );
    
    if (existingState) {
      return; // Already captured this state
    }
    
    // Save new state
    await ctx.runMutation(
      internal.eventListenerMutations.saveGameRoundState,
      { gameRound }
    );
    
    console.log(`Captured Round ${roundId}: ${status}`);
    
    // ⭐ NEW: Schedule actions based on status
    if (status === "waiting") {
      // Schedule closeBettingWindow at endTimestamp
      const currentTime = Math.floor(Date.now() / 1000);
      const delay = Math.max(0, gameRound.endTimestamp - currentTime);
      
      if (delay > 0) {
        await ctx.scheduler.runAfter(
          delay * 1000, // Convert to milliseconds
          internal.gameScheduler.executeCloseBetting,
          { roundId }
        );
        console.log(`Scheduled betting close for round ${roundId} in ${delay}s`);
      } else {
        // Already past endTimestamp - trigger immediately
        await ctx.scheduler.runAfter(
          0,
          internal.gameScheduler.executeCloseBetting,
          { roundId }
        );
        console.log(`Round ${roundId} betting window already closed, triggering now`);
      }
    }
    
    if (status === "awaitingWinnerRandomness") {
      // Schedule first VRF check after 2 seconds
      await ctx.scheduler.runAfter(
        2000,
        internal.gameScheduler.executeCheckVrf,
        { roundId, attempt: 1 }
      );
      console.log(`Scheduled VRF check for round ${roundId}`);
    }
    
    if (status === "finished") {
      console.log(`Round ${roundId} finished - ready for next game`);
    }
    
  } catch (error) {
    console.error("Error capturing game round state:", error);
  }
}
```

---

## Error Handling & Edge Cases

### 1. **Transaction Failures**
**Problem:** Solana transaction fails (network issue, insufficient SOL, etc.)

**Solution:**
- Wrap Solana calls in try-catch
- Log error details
- Don't re-schedule (recovery cron will handle later)

### 2. **Duplicate Scheduling**
**Problem:** Event listener runs twice, schedules same job twice

**Solution:**
- Check if job already scheduled before calling `ctx.scheduler.runAfter()`
- Use `scheduledJobs` table to track active jobs

### 3. **State Race Conditions**
**Problem:** Manual crank call completes before scheduled job runs

**Solution:**
- Always verify current state before executing action
- If already progressed, return early (idempotent)

### 4. **VRF Timeout**
**Problem:** VRF never fulfills (ORAO network issue)

**Solution:**
- After 10 attempts (20s), log error
- Future recovery cron will retry later

### 5. **Single-Player Refund Failures**
**Problem:** Smart contract attempts auto-refund but transfer fails

**Solution:**
- Smart contract stores `winnerPrizeUnclaimed` amount
- Player can claim manually via `claim_winner_prize` instruction
- Frontend shows "Claim Refund" button

---

## Testing Strategy

### Test Cases

#### Test 1: Normal 2-Player Game
1. Player A places bet → Game created (waiting)
2. Player B places bet → Still waiting
3. Wait 30s → Backend closes betting
4. Wait 5s → VRF fulfilled, winner selected
5. Verify: Status = "finished", winner set, payouts correct

#### Test 2: Single-Player Game (Auto-Refund Success)
1. Player A places 3 bets → Game created (waiting)
2. Wait 30s → Backend closes betting
3. Verify: Status = "finished" immediately
4. Verify: Player A balance increased (auto-refund)

#### Test 3: Single-Player Game (Auto-Refund Fails)
1. Player A places bet → Game created (waiting)
2. Make player wallet invalid (close account)
3. Wait 30s → Backend closes betting
4. Verify: Status = "finished", `winnerPrizeUnclaimed` > 0
5. Verify: Manual claim available

#### Test 4: VRF Delay
1. Two players bet → Game created (waiting)
2. Wait 30s → Backend closes betting
3. Mock slow VRF (10s delay)
4. Verify: VRF poller retries correctly
5. Verify: Winner selected when VRF fulfills

#### Test 5: State Already Progressed
1. Game in "waiting" state
2. Manual crank call closes betting
3. Scheduled job triggers
4. Verify: Job detects state change, returns early (no duplicate call)

---

## Implementation Checklist

### Step 1: Schema Updates
- [ ] Add `scheduledJobs` table to schema.ts
- [ ] Test: Deploy schema, verify table exists

### Step 2: Create Scheduler Files
- [ ] Create `gameScheduler.ts` with actions:
  - [ ] `executeCloseBetting(roundId)`
  - [ ] `executeCheckVrf(roundId, attempt)`
- [ ] Create `gameSchedulerMutations.ts` (optional for job tracking)
- [ ] Test: Manually invoke actions with test data

### Step 3: Integrate with Event Listener
- [ ] Modify eventListener.ts to schedule jobs
- [ ] Test: Create game, verify jobs scheduled
- [ ] Test: Check logs for scheduled job IDs

### Step 4: Test Single-Player Flow
- [ ] Test: Single-player game with auto-refund success
- [ ] Test: Single-player game with auto-refund failure
- [ ] Verify: `winnerPrizeUnclaimed` field populated correctly

### Step 5: Test Multi-Player Flow
- [ ] Test: 2-player game, verify betting closes at 30s
- [ ] Test: VRF check polls correctly
- [ ] Test: Winner selected and payouts distributed
- [ ] Verify: Counter incremented, bets unlocked

### Step 6: Test Edge Cases
- [ ] Test: State already progressed (idempotent checks)
- [ ] Test: VRF timeout (10 attempts reached)
- [ ] Test: Transaction failure handling
- [ ] Test: Multiple games in parallel

### Step 7: Production Readiness
- [ ] Add comprehensive logging
- [ ] Add error tracking/alerts
- [ ] Document scheduler behavior
- [ ] Create monitoring dashboard queries

---

## Future Enhancements (Not in This Phase)

❌ **Recovery Cron** - Auto-heal stuck games (implement later)
❌ **Job Tracking Dashboard** - UI to view scheduled jobs
❌ **Retry Logic** - Automatic retries on transaction failures
❌ **Performance Optimization** - Reduce VRF polling interval
❌ **Multi-Game Support** - Handle multiple concurrent games

---

## Success Criteria

✅ **Automated game progression:**
- Games automatically close betting at `endTimestamp`
- VRF automatically checked when status = "awaitingWinnerRandomness"
- Winner automatically selected and paid out
- Counter automatically incremented for next round

✅ **Single-player handling:**
- Auto-refund succeeds when possible
- Manual claim available when auto-refund fails
- No VRF check scheduled for single-player games

✅ **Robustness:**
- Idempotent operations (duplicate calls are safe)
- Graceful error handling (no crashes)
- State validation before each action
- Comprehensive logging for debugging

✅ **Testing:**
- All test cases pass
- Runs stable for 10+ game cycles
- No memory leaks or hung jobs

---

## Open Questions / Review Points

1. **Job Tracking:** Do we need the `scheduledJobs` table? Or is logging sufficient?
   - **Recommendation:** Start without it, add if needed for debugging

2. **VRF Polling Interval:** Is 2 seconds appropriate?
   - **Current:** 2s interval, 10 attempts = 20s max
   - **Alternative:** 1s interval, 15 attempts = 15s max
   - **Recommendation:** Keep 2s (reduces load)

3. **Transaction Confirmation:** Should we wait for `finalized` instead of `confirmed`?
   - **Current:** `confirmed` commitment
   - **Trade-off:** Faster (2-3s) but small risk of reorg
   - **Recommendation:** Keep `confirmed` for MVP, upgrade to `finalized` for mainnet

4. **Error Notifications:** How should we alert on failures?
   - **Options:** Logs only, Discord webhook, email, Sentry
   - **Recommendation:** Start with logs, add alerting later

5. **Concurrent Games:** Can multiple games overlap?
   - **Current Flow:** Counter increments only when game finishes
   - **Implication:** Only 1 active game at a time
   - **Recommendation:** Document this limitation, expand later if needed

