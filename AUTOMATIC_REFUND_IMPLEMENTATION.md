# Automatic Refund Implementation for Single-Player Games

## Overview
The `close_betting_window` instruction has been updated to automatically process refunds for single-player games, mirroring the automatic payment logic used in `select_winner_and_payout` for multi-player games.

## Changes Made

### 1. Vault Account Type Change
**Before:** `UncheckedAccount<'info>`
**After:** `SystemAccount<'info>`

**Reason:** Needed to access `.lamports()` method for balance checks and enable direct fund transfers via `invoke_signed`.

### 2. Updated Documentation
The function documentation now specifies the required `remaining_accounts` structure:
```
Requires remaining_accounts: 
- First: All BetEntry PDAs for the game (to count unique players)
- Then: Unique player wallet accounts (for automatic refund transfer in single-player games)
```

For single-player games, this means:
- `remaining_accounts[0..bet_count]` = BetEntry PDAs
- `remaining_accounts[bet_count]` = The player's wallet account (for refund transfer)

### 3. Automatic Refund Logic for Single-Player Games

When a game has only one unique wallet (single player):

#### A. Preparation
- Game status set to `GameStatus::Finished`
- Player marked as winner for fallback claim mechanism
- Winner wallet extracted: `unique_wallets[0]`

#### B. Automatic Transfer Attempt
```rust
if total_refund > 0 {
    // Validate wallet account provided
    let winner_wallet_account = &ctx.remaining_accounts[bet_count];
    require!(winner_wallet_account.key() == winner_wallet);
    
    // Check vault has sufficient funds
    require!(vault_lamports >= total_refund);
    
    // Attempt transfer with PDA signing
    let transfer_result = anchor_lang::solana_program::program::invoke_signed(
        &transfer_ix,
        [...accounts...],
        signer_seeds,
    );
}
```

#### C. Graceful Failure Handling
```rust
match transfer_result {
    Ok(_) => {
        // Success: Clear unclaimed prize and mark success
        auto_transfer_success = true;
        game_round.winner_prize_unclaimed = 0;
        msg!("✓ Automatic refund succeeded: {} lamports to {}", total_refund, winner_wallet);
    }
    Err(e) => {
        // Failure: Store refund for manual claim via claim_winner_prize
        auto_transfer_success = false;
        game_round.winner_prize_unclaimed = total_refund;
        msg!("⚠️ Automatic refund failed (error: {:?})", e);
        msg!("   Player can claim {} lamports manually via claim_winner_prize", total_refund);
    }
}
```

#### D. Game State Finalization
- Force field rotated for next game
- Bets unlocked immediately (no VRF needed)
- Counter incremented for next round
- Appropriate message logged showing success/fallback status

## Key Features

✅ **Automatic Processing:** Refunds processed immediately without additional instructions  
✅ **Graceful Failure Handling:** If automatic transfer fails, funds held for manual claim  
✅ **Fallback Mechanism:** `claim_winner_prize` instruction remains available for failed transfers  
✅ **Consistent with Multi-Player:** Uses same error handling pattern as `select_winner_and_payout`  
✅ **No Transaction Failure:** Refund failure doesn't fail the entire transaction  
✅ **Clear Logging:** Messages indicate success or fallback status  

## Workflow Comparison

### Before (Manual Claim Required)
```
close_betting_window (single player)
  → Game marked Finished with unclaimed prize
  → User must call claim_winner_prize
  → User pays additional gas fee
```

### After (Automatic with Fallback)
```
close_betting_window (single player)
  → Automatic refund attempted
  
  Success Path:
    ✓ Refund transferred immediately
    ✓ Game completes
    ✓ Next game ready
  
  Failure Path:
    ⚠️ Transfer failed (graceful)
    → Fund stored as unclaimed
    → User can call claim_winner_prize if needed
    → No transaction failure
```

## Backend Integration

The backend calling this instruction must now provide:

```rust
// For single-player game:
remaining_accounts = [
    bet_entry_pda_0,      // BetEntry PDA (contains wallet_0)
    ...more bet entries...,
    wallet_0,             // The player's actual wallet account (for transfer)
]

// For multi-player game:
remaining_accounts = [
    bet_entry_pda_0,      // BetEntry PDAs only (wallet accounts not needed)
    bet_entry_pda_1,
    ...more bet entries...,
]
```

**Important:** Single-player games require the player's wallet account at index `bet_count`, while multi-player games only need BetEntry PDAs.

## Error Scenarios Handled

| Scenario | Behavior |
|----------|----------|
| Refund > vault balance | `InsufficientFunds` error → stored as unclaimed |
| Invalid wallet account | `Unauthorized` error → stored as unclaimed |
| System/account transfer error | Logged and stored as unclaimed |
| Refund == 0 | Treated as success, nothing transferred |

## Testing Recommendations

1. **Success Case:** Single player game → automatic refund → verify player receives funds
2. **Failure Case:** Simulate transfer error → verify `winner_prize_unclaimed` set → verify `claim_winner_prize` works
3. **Zero Refund:** Empty pot → verify handled gracefully
4. **Multi-Player Unaffected:** Verify 2+ player games still work normally

## Files Modified
- `programs/domin8_prgm/src/instructions/close_betting_window.rs`

## Files Unchanged
- `programs/domin8_prgm/src/instructions/select_winner_and_payout.rs` (reference for pattern)
- `programs/domin8_prgm/src/instructions/claim_winner_prize.rs` (fallback still available)
