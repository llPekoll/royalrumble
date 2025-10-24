# Backend Integration Guide: Automatic Refund Implementation

## Summary
The `close_betting_window` instruction now supports automatic refunds for single-player games. The instruction requires additional wallet accounts to be passed in `remaining_accounts`.

## Required Changes to Backend

### Previous Behavior
```typescript
// OLD: Only BetEntry PDAs passed
const instruction = await program.methods
  .closeBettingWindow()
  .accounts({
    counter: counterPDA,
    gameRound: gameRoundPDA,
    config: configPDA,
    vault: vaultPDA,
    crank: crankAuthority,
    systemProgram: SystemProgram.programId,
  })
  .remainingAccounts(betEntryPDAs)  // Only bet entries
  .rpc();
```

### New Behavior - Single Player Game
```typescript
// NEW: BetEntry PDAs + Player wallet account
const instruction = await program.methods
  .closeBettingWindow()
  .accounts({
    counter: counterPDA,
    gameRound: gameRoundPDA,
    config: configPDA,
    vault: vaultPDA,
    crank: crankAuthority,
    systemProgram: SystemProgram.programId,
  })
  .remainingAccounts([
    ...betEntryPDAs,                    // All BetEntry PDAs (indices 0..bet_count-1)
    { pubkey: playerWallet, isSigner: false, isWritable: true }  // Player wallet (index bet_count)
  ])
  .rpc();
```

### New Behavior - Multi Player Game
```typescript
// NEW: Only BetEntry PDAs needed (same as before, but wallet accounts also permitted)
const instruction = await program.methods
  .closeBettingWindow()
  .accounts({
    counter: counterPDA,
    gameRound: gameRoundPDA,
    config: configPDA,
    vault: vaultPDA,
    crank: crankAuthority,
    systemProgram: SystemProgram.programId,
  })
  .remainingAccounts(
    betEntryPDAs.map(pda => ({ pubkey: pda, isSigner: false, isWritable: false }))
  )
  .rpc();
```

## Account Requirements

### For Single-Player Games
- **Index 0 to (bet_count - 1):** BetEntry PDAs
- **Index bet_count:** The SINGLE player's wallet (SystemAccount)
  - Must match the player wallet from the BetEntry account
  - Must be writable (`isWritable: true`) for transfer
  - Must NOT be a signer (crank signs the transaction)

### For Multi-Player Games
- **Index 0 to (bet_count - 1):** BetEntry PDAs only
- No wallet accounts needed
- Behavior unchanged from previous

## Example Implementation

```typescript
async function closeBettingWindow(
  gameRoundId: bigint,
  betEntries: PublicKey[],
  uniquePlayers: Set<PublicKey>,  // From analyzing bet entries
): Promise<void> {
  const gameRound = await fetchGameRound(gameRoundId);
  const betCount = gameRound.betCount;
  const uniquePlayerCount = uniquePlayers.size;

  let remainingAccounts: AccountMeta[] = [];

  // Add BetEntry PDAs
  for (const betEntry of betEntries) {
    remainingAccounts.push({
      pubkey: betEntry,
      isSigner: false,
      isWritable: false,
    });
  }

  // For single-player games, add the player's wallet
  if (uniquePlayerCount === 1) {
    const playerWallet = Array.from(uniquePlayers)[0];
    remainingAccounts.push({
      pubkey: playerWallet,
      isSigner: false,
      isWritable: true,  // IMPORTANT: Must be writable for transfer
    });

    console.log(`Single-player game: ${betCount} bets from ${playerWallet}`);
    console.log(`Automatic refund will be attempted`);
  } else {
    console.log(`Multi-player game: ${betCount} bets from ${uniquePlayerCount} players`);
  }

  // Send instruction
  const instruction = await program.methods
    .closeBettingWindow()
    .accounts({
      counter: counterPDA,
      gameRound: gameRoundPDA,
      config: configPDA,
      vault: vaultPDA,
      crank: crankAuthority,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  // Execute
  const tx = new Transaction().add(instruction);
  const sig = await connection.sendTransaction(tx, [crankKeypair]);
  await connection.confirmTransaction(sig);

  // Parse event to see if refund was automatic or manual-claim required
  const receipt = await connection.getTransaction(sig);
  // Check WinnerSelected event or other telemetry
}
```

## Event Monitoring

After calling `closeBettingWindow`, you can monitor the results:

```typescript
// Listen for events
program.addEventListener("GameLocked", (event, slot) => {
  if (event.finalBetCount === 1) {
    console.log(`Game ${event.roundId}: Single-player game locked`);
    console.log(`Check GameRound.winner_prize_unclaimed:`, 
      event.winnerPrizeUnclaimed === 0 
        ? "✓ Automatic refund succeeded"
        : "⚠️ Manual claim required");
  }
});
```

Or query the state after transaction:

```typescript
// Check if refund was automatic
const gameRound = await program.account.gameRound.fetch(gameRoundPDA);

if (gameRound.winnerPrizeUnclaimed === 0) {
  console.log("✓ Refund processed automatically");
} else {
  console.log(`⚠️ ${gameRound.winnerPrizeUnclaimed} lamports pending manual claim`);
  console.log(`Player can call claim_winner_prize instruction`);
}
```

## Testing Checklist

- [ ] Single-player automatic refund: wallet receives funds immediately
- [ ] Single-player fallback: if transfer fails, wallet can call claim_winner_prize
- [ ] Multi-player: unaffected by changes, still requires select_winner_and_payout
- [ ] Error handling: transaction completes even if transfer fails (graceful)
- [ ] Account validation: wrong wallet address rejected with Unauthorized error
- [ ] Insufficient funds: handled without crashing transaction

## Logging

The instruction logs indicate the result:

**Automatic Success:**
```
Single player game - immediate finish, refund processed automatically
```

**Manual Claim Required:**
```
Single player game - immediate finish, ready for manual refund claim
```

Check instruction logs to verify refund status.
