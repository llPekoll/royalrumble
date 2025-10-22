# Game Recovery System

## Problem
Games can get stuck if:
- Scheduler doesn't fire (rare Convex issue)
- Server restarts mid-game
- Game created manually via script (bypasses scheduler)
- VRF takes abnormally long

## Solution: Self-Healing Cron

A recovery cron runs **every 30 seconds** and checks:
1. Is there an active game on blockchain?
2. Are we past the deadline for any action?
3. If yes → trigger that action immediately

## How It Works

### Recovery Checks

```typescript
// Check if betting should have closed
if (status === 'waiting' && currentTime > startTime + 30s) {
  → Trigger closeBettingWindow() immediately
}

// Check if VRF should have been processed
if (status === 'awaitingWinnerRandomness' && currentTime > startTime + 40s) {
  → Check VRF fulfillment
  → If fulfilled → Trigger selectWinner() immediately
  → If not fulfilled → Log warning, keep waiting
}
```

### Database Sync

If game exists on blockchain but not in Convex:
```typescript
→ Create game record in Convex
→ Link to blockchain state
→ Proceed with recovery
```

## Architecture

```
convex/gameRecovery.ts          - Recovery logic
convex/crons.ts                  - Scheduled every 30s
convex/lib/gamePhases.ts         - shouldExecuteAction() helper
```

## Recovery Flow

```
Cron fires (every 30s)
  ↓
Check blockchain state
  ↓
Is there an active game? → No → Done
  ↓ Yes
Calculate time elapsed since start
  ↓
Is any action overdue?
  ↓ Yes
Trigger that action immediately
  ↓
Schedule next check (VRF might need retries)
```

## Example: Stuck VRF

**Scenario:**
- Game started at 15:17:00
- Betting closed at 15:17:30 ✅
- VRF requested at 15:17:30 ✅
- **VRF never checked** (scheduler didn't fire)
- Game stuck in `awaitingWinnerRandomness`
- Current time: 15:37:00 (20 minutes later!)

**Recovery:**
1. Cron runs at 15:37:00
2. Sees game is 20 minutes old
3. Realizes VRF should have been checked 19 minutes ago
4. Checks VRF fulfillment immediately
5. If fulfilled → Selects winner and completes game
6. If not fulfilled → Logs warning, waits for next cron

## Benefits

✅ **No manual intervention needed**
✅ **Works with scheduler-based flow** (doesn't replace it)
✅ **Handles edge cases** (script-created games, restarts)
✅ **Max 30s delay** to recover from stuck state
✅ **Idempotent** - safe to run multiple times

## Testing

### Simulate stuck game:
```bash
# 1. Create game via script (bypasses scheduler)
NODE_OPTIONS='--loader ts-node/esm' npx ts-node scripts/create-game.ts

# 2. Wait 2 minutes
# 3. Check blockchain debug panel - should show "awaitingWinnerRandomness"
# 4. Wait up to 30s for recovery cron
# 5. Game should complete automatically
```

### Check recovery logs:
```bash
# Watch Convex logs for:
🔍 Recovery check - Status: awaitingWinnerRandomness, Started: 1234567890
🚨 VRF overdue! Checking VRF fulfillment now...
✅ VRF is fulfilled! Selecting winner now...
```

## Configuration

```typescript
// convex/crons.ts
crons.interval(
  "game-recovery",
  { seconds: 30 },  // Check every 30 seconds
  internal.gameRecovery.checkGameRecovery
);
```

To adjust frequency, change `{ seconds: 30 }` to desired interval.

**Recommendation:** Keep at 30s for good balance between:
- Quick recovery (max 30s delay)
- Low overhead (120 checks per hour)

## Monitoring

Watch for these log patterns:

✅ **Normal:** No logs (no games stuck)

⚠️ **Recovery triggered:**
```
🚨 OVERDUE: Betting should have closed 5s ago!
⚡ Triggering closeBettingWindow now...
```

❌ **VRF taking too long:**
```
⚠️ VRF taking abnormally long! Consider manual intervention.
```

If you see the last message (VRF >50s), check:
- ORAO VRF service status (devnet can be slow)
- VRF request pubkey in Solana Explorer
- Network connectivity

## Future Improvements

- [ ] Alert system for stuck games (Discord webhook)
- [ ] Automatic refunds if VRF times out (>5 minutes)
- [ ] Metrics: Track recovery trigger frequency
- [ ] Admin dashboard to manually trigger recovery

## Summary

The game recovery system ensures games never get permanently stuck. It's a safety net that catches edge cases while letting the normal scheduler-based flow handle 99% of games smoothly.

**Max delay to recover:** 30 seconds
**Overhead:** Minimal (only checks blockchain every 30s)
**Reliability:** High (works even if server restarts)
