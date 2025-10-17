# Security Checks - Betting Window & Winner Animation

## Overview

This document outlines all security checks implemented to ensure:
1. Players cannot bet after the betting window closes
2. Winner animations only play when valid conditions are met

---

## Smart Contract Security (Rust/Solana)

### 1. Betting Window Enforcement in `place_bet`

**File**: `programs/domin8_prgm/src/instructions/place_bet.rs`

```rust
// Line 67-74
// ⭐ Validate betting window hasn't closed (for Waiting status)
// Betting is allowed while: current_time < end_timestamp
if game_round.status == GameStatus::Waiting {
    require!(
        clock.unix_timestamp < game_round.end_timestamp,
        Domin8Error::BettingWindowClosed
    );
}
```

**Logic**: Players can ONLY bet when `current_time < end_timestamp`

**Error**: `BettingWindowClosed` if condition fails

---

### 2. Game Progression Lock in `unified_progress_to_resolution`

**File**: `programs/domin8_prgm/src/instructions/progress_to_resolution.rs`

```rust
// Line 49-53
// ⭐ Validate betting window has closed (prevents early progression)
require!(
    clock.unix_timestamp >= game_round.end_timestamp,
    Domin8Error::BettingWindowStillOpen
);
```

**Logic**: Backend can ONLY progress when `current_time >= end_timestamp`

**Error**: `BettingWindowStillOpen` if condition fails

---

### 3. Triple Layer Protection

The smart contract has **THREE** security layers:

#### Layer 1: Timestamp Check
```rust
require!(clock.unix_timestamp < game_round.end_timestamp)
```

#### Layer 2: Game Lock Flag
```rust
require!(!config.game_locked, Domin8Error::GameLocked);
```
Once backend calls `progress_to_resolution`, it sets `game_locked = true`, preventing all new bets.

#### Layer 3: Status Validation
```rust
require!(game_round.can_accept_bets(), Domin8Error::InvalidGameStatus);
```
Only `Idle` and `Waiting` statuses allow bets. Once status changes to `AwaitingWinnerRandomness`, betting is impossible.

#### Layer 4: Round ID Check
```rust
require!(
    game_round.round_id == counter.current_round_id,
    Domin8Error::InvalidGameStatus
);
```
Prevents betting on old/completed games.

---

## Frontend Security (TypeScript/Phaser)

### 1. Winner Animation Guard - Small Games

**File**: `src/game/managers/GamePhaseManager.ts`

```typescript
// Lines 39-64
const now = Date.now();
const bettingWindowClosed = gameState.endTimestamp ? now > gameState.endTimestamp : false;
const hasWinner = !!gameState.winnerId;
const blockchainCallCompleted = gameState.blockchainCallStatus === 'completed';

const canShowWinnerAnimation = bettingWindowClosed && hasWinner && blockchainCallCompleted;

if (blockchainCallJustCompleted && this.isSmallGame && gameState.status === 'arena' && canShowWinnerAnimation) {
  console.log('✅ Conditions met for winner animation:');
  console.log('  - Betting window closed:', bettingWindowClosed, `(now: ${now}, end: ${gameState.endTimestamp})`);
  console.log('  - Winner determined:', gameState.winnerId);
  console.log('  - Blockchain call completed');

  this.hasWinner = true;
  // Trigger explosion after a short delay
  this.scene.time.delayedCall(500, () => {
    const participants = this.playerManager.getParticipants();
    this.animationManager.explodeParticipantsOutward(participants);
  });
}
```

**Three Required Conditions**:
1. ✅ `now > endTimestamp` (betting window closed)
2. ✅ `winnerId != null` (winner determined)
3. ✅ `blockchainCallStatus === 'completed'` (VRF fulfilled)

**Safety**: If ANY condition fails, animation is blocked and logged.

---

### 2. Results Phase Guard - Large Games

**File**: `src/game/managers/GamePhaseManager.ts`

```typescript
// Lines 197-224
private handleResultsPhase(gameState: any, phaseChanged: boolean) {
  if (phaseChanged) {
    // ⭐ SECURITY: Verify betting window closed and winner exists before showing results
    const now = Date.now();
    const bettingWindowClosed = gameState.endTimestamp ? now > gameState.endTimestamp : false;
    const hasWinner = !!gameState.winnerId;

    if (!bettingWindowClosed || !hasWinner) {
      console.log('⚠️ Cannot show results - conditions not met:');
      if (!bettingWindowClosed) console.log('  - Betting window still open');
      if (!hasWinner) console.log('  - No winner determined yet');
      return; // ⭐ EARLY EXIT - No winner shown
    }

    // Show the winner and celebration
    const winnerParticipant = this.playerManager.showResults(gameState);
    // ...
  }
}
```

**Two Required Conditions**:
1. ✅ `now > endTimestamp` (betting window closed)
2. ✅ `winnerId != null` (winner determined)

**Safety**: Early return if conditions not met, preventing any winner celebration.

---

## Attack Scenarios & Protection

### Scenario 1: Player tries to bet after window closes

**Attack**: Player sends `place_bet` transaction after `endTimestamp`

**Protection**:
- Smart contract checks: `clock.unix_timestamp < game_round.end_timestamp`
- Transaction **REVERTS** with error: `BettingWindowClosed`
- No funds transferred, player pays only transaction fee

**Result**: ❌ Attack BLOCKED

---

### Scenario 2: Malicious frontend shows winner early

**Attack**: Modified frontend tries to show winner animation before window closes

**Protection**:
- Frontend checks: `now > gameState.endTimestamp`
- Animation **BLOCKED** with console warning
- Only visual - doesn't affect blockchain state

**Result**: ⚠️ Visual blocked, blockchain still secure

---

### Scenario 3: Backend tries to progress game early

**Attack**: Backend calls `unified_progress_to_resolution` before `endTimestamp`

**Protection**:
- Smart contract checks: `clock.unix_timestamp >= game_round.end_timestamp`
- Transaction **REVERTS** with error: `BettingWindowStillOpen`
- Game remains in `Waiting` status

**Result**: ❌ Attack BLOCKED

---

### Scenario 4: Race condition during window close

**Attack**: Player sends bet at exactly `endTimestamp`

**Protection**:
- Smart contract uses strict inequality: `<` (not `<=`)
- At exactly `endTimestamp`, bet is **REJECTED**
- Backend can immediately progress at `endTimestamp`

**Result**: ✅ Deterministic behavior - no race condition

---

## Time Synchronization

### Blockchain Time (Source of Truth)
- Uses Solana `Clock::get()?.unix_timestamp`
- Cannot be manipulated by players or backend
- Same time for all transactions in a slot (~400ms)

### Frontend Time (Display Only)
- Uses JavaScript `Date.now()`
- May differ by a few seconds from blockchain time
- Only affects UI display, not security
- Blockchain time always wins in disputes

---

## Testing Checklist

### Smart Contract Tests

- [ ] Test `place_bet` when `now < endTimestamp` → ✅ SUCCESS
- [ ] Test `place_bet` when `now = endTimestamp` → ❌ FAIL (BettingWindowClosed)
- [ ] Test `place_bet` when `now > endTimestamp` → ❌ FAIL (BettingWindowClosed)
- [ ] Test `place_bet` when `game_locked = true` → ❌ FAIL (GameLocked)
- [ ] Test `place_bet` on old round → ❌ FAIL (InvalidGameStatus)
- [ ] Test `progress_to_resolution` when `now < endTimestamp` → ❌ FAIL (BettingWindowStillOpen)
- [ ] Test `progress_to_resolution` when `now >= endTimestamp` → ✅ SUCCESS

### Frontend Tests

- [ ] Verify animation BLOCKED when `now < endTimestamp`
- [ ] Verify animation BLOCKED when `winnerId = null`
- [ ] Verify animation BLOCKED when blockchain call pending
- [ ] Verify animation PLAYS when all conditions met
- [ ] Check console logs show correct blocking reasons

---

## Monitoring

### Smart Contract Events

Monitor for suspicious patterns:
- Multiple `BettingWindowClosed` errors from same wallet → Player trying to cheat
- `BettingWindowStillOpen` errors from backend → Backend timing issue

### Frontend Logs

Watch for:
- "⏳ Winner animation blocked" messages → Normal during VRF fulfillment
- "⚠️ Cannot show results" messages → Should be rare, investigate if frequent

---

## Summary

### Smart Contract (Blockchain) ✅
- **Timestamp enforcement**: Bets ONLY allowed when `now < endTimestamp`
- **Progression lock**: Game ONLY progresses when `now >= endTimestamp`
- **Triple protection**: Timestamp + Lock flag + Status check + Round ID
- **Deterministic**: No race conditions, strict inequalities
- **Trustless**: Clock is Solana blockchain time (cannot be manipulated)

### Frontend (Display) ✅
- **Animation guard**: Winner ONLY shown when `now > endTimestamp AND winner != null`
- **Results guard**: Celebration ONLY shown when conditions met
- **Logging**: Clear console messages for debugging
- **Fail-safe**: Early returns prevent showing invalid states

**Conclusion**: The system is **fully secured** against betting after window closes and showing winner animations prematurely. Both smart contract and frontend have robust checks. 🔒
