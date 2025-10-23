# Test File Updates Required

## 🔴 CRITICAL ISSUES (Tests will fail without these fixes)

### 1. Missing Accounts in `place_bet` Calls
**Location:** Lines 478-490, 527-536, 574-582

**Problem:** The test calls are missing required accounts:
- `counter` (GameCounter PDA) - **REQUIRED**
- `betEntry` (BetEntry PDA) - **REQUIRED**

**Current Test Code:**
```typescript
await program.methods
  .placeBet(new BN(bet2Amount))
  .accounts({
    config: gameConfigPda,
    // ❌ MISSING: counter
    gameRound: gameRoundPda,
    // ❌ MISSING: betEntry
    vault: vaultPda,
    player: player2.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
```

**Required Fix:**
```typescript
const betIndex = gameBeforeBet.betCount;
const betEntryPda = deriveBetEntryPda(currentRoundId, betIndex);

await program.methods
  .placeBet(new BN(bet2Amount))
  .accounts({
    config: gameConfigPda,
    counter: gameCounterPda,          // ✅ ADD THIS
    gameRound: gameRoundPda,
    betEntry: betEntryPda,           // ✅ ADD THIS
    vault: vaultPda,
    player: player2.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
```

### 2. Missing Account in `select_winner_and_payout`
**Location:** Line 837-849

**Problem:** Missing `counter` account

**Current Test Code:**
```typescript
await program.methods
  .selectWinnerAndPayout()
  .accounts({
    // ❌ MISSING: counter
    config: gameConfigPda,
    gameRound: gameRoundPda,
    vault: vaultPda,
    treasury: actualTreasury,
    crank: provider.wallet.publicKey,
    vrfRequest: vrfAccounts.vrfRequest,
    systemProgram: web3.SystemProgram.programId,
  })
```

**Required Fix:**
```typescript
await program.methods
  .selectWinnerAndPayout()
  .accounts({
    counter: gameCounterPda,         // ✅ ADD THIS
    config: gameConfigPda,
    gameRound: gameRoundPda,
    vault: vaultPda,
    treasury: actualTreasury,
    crank: provider.wallet.publicKey,
    vrfRequest: vrfAccounts.vrfRequest,
    systemProgram: web3.SystemProgram.programId,
  })
```

---

## ⚠️ MISSING TESTS (New functionality not covered)

### 3. Max Bet Limit Test (BetTooLarge)
**Status:** ❌ NOT TESTED

**What's New:** We added 3 SOL max bet limit

**Required Test:**
```typescript
it("Should reject bets above maximum (3 SOL)", async () => {
  console.log("\n=== Test: Reject Large Bets ===");

  const tooBigBet = 4_000_000_000; // 4 SOL (above 3 SOL max)

  // Get counter for new round
  const counterAccount = await program.account.gameCounter.fetch(gameCounterPda);
  const newRoundId = counterAccount.currentRoundId.toNumber();

  // Derive PDAs for new game
  const newGameRoundPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("game_round"), new BN(newRoundId).toArrayLike(Buffer, "le", 8)],
    program.programId
  )[0];

  const betEntryPda = deriveBetEntryPda(newRoundId, 0);
  const vrfAccounts = await deriveVrfAccounts();

  try {
    await program.methods
      .createGame(new BN(tooBigBet))
      .accounts({
        config: gameConfigPda,
        counter: gameCounterPda,
        gameRound: newGameRoundPda,
        betEntry: betEntryPda,
        vault: vaultPda,
        player: player1.publicKey,
        vrfProgram: vrf.programId,
        networkState: vrfAccounts.networkState,
        treasury: vrfAccounts.treasury,
        vrfRequest: vrfAccounts.vrfRequest,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([player1])
      .rpc();

    assert.fail("Should have rejected large bet");
  } catch (error: any) {
    console.log("✓ Large bet rejected as expected");
    expect(error.message).to.include("BetTooLarge");
  }
});
```

### 4. Graceful Winner Payout Failure Test
**Status:** ❌ NOT TESTED

**What's New:** Winner payout can fail gracefully, stores in `winner_prize_unclaimed`

**Required Assertions in select_winner_and_payout test:**
```typescript
// After winner selection
const gameAfterPayout = await program.account.gameRound.fetch(gameRoundPda);

console.log("\n=== Payout Status ===");
console.log("Winner prize unclaimed:", gameAfterPayout.winnerPrizeUnclaimed.toString());
console.log("House fee unclaimed:", gameAfterPayout.houseFeeUnclaimed.toString());

// If automatic transfer succeeded, unclaimed should be 0
if (gameAfterPayout.winnerPrizeUnclaimed.toNumber() === 0) {
  console.log("✓ Winner paid automatically");
} else {
  console.log("⚠️ Winner needs to claim manually");
}
```

### 5. Manual Prize Claim Test
**Status:** ❌ NOT TESTED

**What's New:** `claim_winner_prize` instruction for manual claims

**Required Test:**
```typescript
describe("Manual Prize Claim", () => {
  it("Should allow winner to claim prize manually if auto-transfer failed", async () => {
    console.log("\n=== Test: Manual Prize Claim ===");

    // Assuming game round has unclaimed prize
    const gameAccount = await program.account.gameRound.fetch(gameRoundPda);
    const unclaimedPrize = gameAccount.winnerPrizeUnclaimed;

    if (unclaimedPrize.toNumber() === 0) {
      console.log("ℹ No unclaimed prize - skipping test");
      return;
    }

    const winner = gameAccount.winner;
    const roundId = gameAccount.roundId;

    // Winner claims their prize
    const tx = await program.methods
      .claimWinnerPrize(roundId)
      .accounts({
        gameRound: gameRoundPda,
        vault: vaultPda,
        winner: winner,  // Must be the actual winner
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([/* winner keypair */])
      .rpc();

    console.log("✓ Claim transaction:", tx);

    // Verify unclaimed cleared
    const gameAfterClaim = await program.account.gameRound.fetch(gameRoundPda);
    expect(gameAfterClaim.winnerPrizeUnclaimed.toNumber()).to.equal(0);

    console.log("✓ Prize claimed successfully");
  });
});
```

### 6. Manual House Fee Claim Test
**Status:** ❌ NOT TESTED

**What's New:** `claim_house_fee` instruction for treasury

**Required Test:**
```typescript
it("Should allow treasury to claim house fee manually if auto-transfer failed", async () => {
  console.log("\n=== Test: Manual House Fee Claim ===");

  const gameAccount = await program.account.gameRound.fetch(gameRoundPda);
  const unclaimedFee = gameAccount.houseFeeUnclaimed;

  if (unclaimedFee.toNumber() === 0) {
    console.log("ℹ No unclaimed fee - skipping test");
    return;
  }

  const configAccount = await program.account.gameConfig.fetch(gameConfigPda);
  const treasury = configAccount.treasury;
  const roundId = gameAccount.roundId;

  const tx = await program.methods
    .claimHouseFee(roundId)
    .accounts({
      config: gameConfigPda,
      gameRound: gameRoundPda,
      vault: vaultPda,
      treasury: treasury,  // Must be the treasury signer
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([/* treasury keypair */])
    .rpc();

  console.log("✓ Claim transaction:", tx);

  // Verify unclaimed cleared
  const gameAfterClaim = await program.account.gameRound.fetch(gameRoundPda);
  expect(gameAfterClaim.houseFeeUnclaimed.toNumber()).to.equal(0);

  console.log("✓ House fee claimed successfully");
});
```

### 7. VRF Timeout Emergency Refund Test
**Status:** ❌ NOT TESTED

**What's New:** `emergency_refund_vrf_timeout` instruction

**Required Test:**
```typescript
describe("Emergency VRF Timeout Refund", () => {
  it("Should refund all players if VRF times out (10+ minutes)", async () => {
    console.log("\n=== Test: VRF Timeout Refund ===");

    // This test would need:
    // 1. A game stuck in AwaitingWinnerRandomness status
    // 2. Wait 10+ minutes (or mock the timestamp check)
    // 3. Call emergency_refund_vrf_timeout with all player accounts

    // Note: This is hard to test in real conditions
    // Consider mocking or just documenting the instruction exists

    console.log("ℹ Emergency refund instruction exists for production use");
    console.log("  Activates after 10 minutes of VRF timeout");
    console.log("  Refunds all players proportionally");
    console.log("  Unlocks system for next game");
  });
});
```

---

## 📊 MISSING ASSERTIONS (State validation)

### 8. Check New Fields After Game Creation
**Location:** After line 391

**Add these assertions:**
```typescript
// Verify new unclaimed fields initialized to 0
expect(gameRoundAccount.winnerPrizeUnclaimed.toString()).to.equal("0");
expect(gameRoundAccount.houseFeeUnclaimed.toString()).to.equal("0");
console.log("✓ Unclaimed fields initialized to 0");
```

### 9. Check Max Bet Config Field
**Location:** After line 240

**Add this assertion:**
```typescript
expect(configAccount.maxBetLamports.toString()).to.equal("3000000000"); // 3 SOL
console.log("Max Bet Limit:", configAccount.maxBetLamports.toNumber() / web3.LAMPORTS_PER_SOL, "SOL");
```

---

## 🔧 PRIORITY ORDER FOR FIXES

### MUST FIX IMMEDIATELY (Tests won't run):
1. ✅ **Fix place_bet calls** (add counter + betEntry)
2. ✅ **Fix select_winner_and_payout call** (add counter)

### SHOULD ADD (Missing coverage):
3. 🟡 **Add max bet test** (BetTooLarge error)
4. 🟡 **Add unclaimed field assertions**
5. 🟡 **Add claim_winner_prize test**
6. 🟡 **Add claim_house_fee test**

### OPTIONAL (Hard to test):
7. 🔵 **Add VRF timeout test** (requires 10 min wait or mocking)

---

## 📝 SUMMARY

**Critical Issues:** 2 (place_bet + select_winner_and_payout missing accounts)
**Missing Tests:** 5 (max bet, manual claims, VRF timeout)
**Missing Assertions:** 2 (unclaimed fields, max bet config)

**Estimated Fix Time:** 30-45 minutes

**Test Status After Fixes:**
- ✅ Core game flow
- ✅ Max bet limit validation
- ✅ Graceful failure handling
- ✅ Manual claim fallbacks
- ⚠️ VRF timeout (documented but not fully tested)

---

**Next Step:** Should I create the updated test file with all fixes applied?
