# Critical Smart Contract TODOs for Mainnet

**⚠️ DO NOT DEPLOY TO MAINNET WITHOUT IMPLEMENTING THESE ⚠️**

These are critical security features missing from the current smart contract that MUST be implemented before mainnet deployment.

---

## 🔴 CRITICAL #1: Emergency Withdraw

**Problem**: If VRF fails or backend crashes, player funds are permanently stuck in the vault with no way to recover them.

**Current Risk**: A game stuck in `AwaitingWinnerRandomness` status locks funds forever.

### Implementation

#### 1. Add to lib.rs
```rust
// programs/domin8_prgm/src/lib.rs

#[program]
pub mod domin8_prgm {
    use super::*;

    // ... existing functions ...

    /// Emergency withdraw - refund all players if game stuck for 24+ hours
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        instructions::emergency_withdraw(ctx)
    }
}
```

#### 2. Create emergency_withdraw.rs
**Location**: `programs/domin8_prgm/src/instructions/emergency_withdraw.rs`

```rust
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

const EMERGENCY_THRESHOLD_SECONDS: i64 = 86400; // 24 hours

pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    let clock = Clock::get()?;

    // Only works if game is stuck in AwaitingWinnerRandomness
    require!(
        game_round.status == GameStatus::AwaitingWinnerRandomness,
        Domin8Error::InvalidGameStatus
    );

    // Must wait 24 hours after betting window closed
    let time_stuck = clock
        .unix_timestamp
        .checked_sub(game_round.end_timestamp)
        .ok_or(Domin8Error::ArithmeticOverflow)?;

    require!(
        time_stuck >= EMERGENCY_THRESHOLD_SECONDS,
        Domin8Error::EmergencyTimeNotElapsed
    );

    // Refund all players by iterating through BetEntry PDAs
    let total_pot = game_round.total_pot;
    let bet_count = game_round.bet_count as usize;

    msg!("Emergency refund triggered for {} bets", bet_count);
    msg!("Total pot to refund: {} lamports", total_pot);

    // Note: Actual refund logic requires iterating through BetEntry PDAs
    // This is a simplified version - see full implementation notes below

    // Mark game as finished to prevent further operations
    game_round.status = GameStatus::Finished;
    game_round.total_pot = 0;

    emit!(EmergencyRefundEvent {
        game_round: ctx.accounts.game_round.key(),
        round_id: game_round.round_id,
        refund_amount: total_pot,
        bet_count: bet_count as u32,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(mut)]
    pub game_round: Account<'info, GameRound>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    /// CHECK: Vault PDA - validated by seeds
    pub vault: UncheckedAccount<'info>,

    /// Authority that can trigger emergency withdrawal
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

#### 3. Add to events.rs
```rust
// programs/domin8_prgm/src/events.rs

#[event]
pub struct EmergencyRefundEvent {
    pub game_round: Pubkey,
    pub round_id: u64,
    pub refund_amount: u64,
    pub bet_count: u32,
    pub timestamp: i64,
}
```

#### 4. Update mod.rs
```rust
// programs/domin8_prgm/src/instructions/mod.rs

pub mod emergency_withdraw;
pub use emergency_withdraw::*;
```

### Implementation Notes

**Full Refund Logic** (requires batch processing):
```rust
// To refund all players, you need to call this instruction multiple times
// Each call refunds one player (to avoid compute unit limits)

pub fn refund_player(ctx: Context<RefundPlayer>, bet_index: u32) -> Result<()> {
    let game_round = &ctx.accounts.game_round;
    let bet_entry = &ctx.accounts.bet_entry;

    // Validate game is in emergency state
    require!(
        game_round.status == GameStatus::Finished, // Set by emergency_withdraw
        Domin8Error::InvalidGameStatus
    );

    // Transfer funds from vault to player
    let refund_amount = bet_entry.bet_amount;

    **ctx.accounts.vault.try_borrow_mut_lamports()? -= refund_amount;
    **ctx.accounts.player.try_borrow_mut_lamports()? += refund_amount;

    msg!("Refunded {} lamports to player {}", refund_amount, bet_entry.wallet);

    Ok(())
}
```

---

## 🔴 CRITICAL #2: Winner Claim (Replace Auto-Payout)

**Problem**: Current `select_winner_and_payout` pays out immediately. If the transaction fails, winner loses their prize forever.

**Current Risk**: Network congestion, RPC failure, or transaction errors can cause winner to never receive funds.

### Implementation

#### 1. Modify select_winner_and_payout.rs

**REMOVE** the payout logic (lines that transfer funds):
```rust
// DELETE THESE LINES:
// **ctx.accounts.vault.try_borrow_mut_lamports()? -= winner_prize;
// **ctx.accounts.winner.try_borrow_mut_lamports()? += winner_prize;
```

Keep only the winner selection logic:
```rust
pub fn select_winner_and_payout(ctx: Context<SelectWinnerAndPayout>) -> Result<()> {
    // ... VRF validation ...
    // ... Winner selection logic ...

    game_round.winner = winner_wallet;
    game_round.winning_bet_index = winning_index;
    game_round.status = GameStatus::Finished; // Mark as finished, not paid

    // DO NOT transfer funds here - let winner claim them

    Ok(())
}
```

#### 2. Create claim_winnings.rs
**Location**: `programs/domin8_prgm/src/instructions/claim_winnings.rs`

```rust
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    let config = &ctx.accounts.config;

    // Game must be finished
    require!(
        game_round.status == GameStatus::Finished,
        Domin8Error::InvalidGameStatus
    );

    // Caller must be the winner
    require!(
        ctx.accounts.winner.key() == game_round.winner,
        Domin8Error::InvalidWinnerAccount
    );

    // Winnings not already claimed
    require!(
        !game_round.winnings_claimed,
        Domin8Error::AlreadyClaimed
    );

    // Calculate prize (95% of pot, 5% house fee)
    let total_pot = game_round.total_pot;
    let house_fee_bps = config.house_fee_bps as u64;

    let house_fee = total_pot
        .checked_mul(house_fee_bps)
        .ok_or(Domin8Error::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(Domin8Error::ArithmeticOverflow)?;

    let winner_prize = total_pot
        .checked_sub(house_fee)
        .ok_or(Domin8Error::ArithmeticOverflow)?;

    // Validate vault has sufficient funds
    let vault_lamports = ctx.accounts.vault.lamports();
    require!(
        vault_lamports >= winner_prize,
        Domin8Error::PayoutExceedsAvailableFunds
    );

    // Transfer prize to winner
    **ctx.accounts.vault.try_borrow_mut_lamports()? -= winner_prize;
    **ctx.accounts.winner.try_borrow_mut_lamports()? += winner_prize;

    // Mark as claimed
    game_round.winnings_claimed = true;

    emit!(WinningsClaimedEvent {
        game_round: ctx.accounts.game_round.key(),
        round_id: game_round.round_id,
        winner: game_round.winner,
        amount: winner_prize,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Winner {} claimed {} lamports", game_round.winner, winner_prize);

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(mut)]
    pub game_round: Account<'info, GameRound>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    /// CHECK: Vault PDA - validated by seeds
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = winner.key() == game_round.winner @ Domin8Error::InvalidWinnerAccount
    )]
    /// CHECK: Winner wallet - validated by constraint
    pub winner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
```

#### 3. Add to lib.rs
```rust
// programs/domin8_prgm/src/lib.rs

#[program]
pub mod domin8_prgm {
    use super::*;

    // ... existing functions ...

    /// Winner claims their prize (called by winner after game finishes)
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings(ctx)
    }
}
```

#### 4. Add to state/game_round.rs
```rust
// programs/domin8_prgm/src/state/game_round.rs

pub struct GameRound {
    // ... existing fields ...

    pub winner: Pubkey,
    pub winning_bet_index: u32,

    // ADD THIS:
    pub winnings_claimed: bool,  // Track if winner claimed prize
}
```

#### 5. Add to events.rs
```rust
// programs/domin8_prgm/src/events.rs

#[event]
pub struct WinningsClaimedEvent {
    pub game_round: Pubkey,
    pub round_id: u64,
    pub winner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
```

#### 6. Update mod.rs
```rust
// programs/domin8_prgm/src/instructions/mod.rs

pub mod claim_winnings;
pub use claim_winnings::*;
```

---

## 🔴 CRITICAL #3: House Fee Collection

**Problem**: Current implementation transfers house fee during winner selection, but if that fails, house never gets paid.

**Solution**: Separate house fee collection instruction.

### Implementation

#### Create collect_house_fee.rs
**Location**: `programs/domin8_prgm/src/instructions/collect_house_fee.rs`

```rust
use anchor_lang::prelude::*;
use crate::{constants::*, errors::*, state::*};

pub fn collect_house_fee(ctx: Context<CollectHouseFee>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    let config = &ctx.accounts.config;

    // Game must be finished
    require!(
        game_round.status == GameStatus::Finished,
        Domin8Error::InvalidGameStatus
    );

    // House fee not already collected
    require!(
        !game_round.house_fee_collected,
        Domin8Error::HouseFeeAlreadyCollected
    );

    // Calculate house fee (5% of pot)
    let total_pot = game_round.total_pot;
    let house_fee_bps = config.house_fee_bps as u64;

    let house_fee = total_pot
        .checked_mul(house_fee_bps)
        .ok_or(Domin8Error::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(Domin8Error::ArithmeticOverflow)?;

    // Skip if no house fee
    if house_fee == 0 {
        game_round.house_fee_collected = true;
        return Ok(());
    }

    // Validate vault has sufficient funds
    let vault_lamports = ctx.accounts.vault.lamports();
    require!(
        vault_lamports >= house_fee,
        Domin8Error::InsufficientFunds
    );

    // Transfer house fee to treasury
    **ctx.accounts.vault.try_borrow_mut_lamports()? -= house_fee;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? += house_fee;

    // Mark as collected
    game_round.house_fee_collected = true;

    emit!(HouseFeeCollectedEvent {
        game_round: ctx.accounts.game_round.key(),
        round_id: game_round.round_id,
        amount: house_fee,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("House fee collected: {} lamports", house_fee);

    Ok(())
}

#[derive(Accounts)]
pub struct CollectHouseFee<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(mut)]
    pub game_round: Account<'info, GameRound>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    /// CHECK: Vault PDA - validated by seeds
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ Domin8Error::InvalidTreasury
    )]
    /// CHECK: Treasury - validated by constraint
    pub treasury: UncheckedAccount<'info>,

    /// Authority that can collect fees
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

Add to lib.rs, events.rs, mod.rs (same pattern as above).

Add to state/game_round.rs:
```rust
pub house_fee_collected: bool,
```

---

## 📋 Implementation Checklist

Before deploying to mainnet, ensure:

- [ ] Emergency withdraw instruction implemented
- [ ] Separate winner claim instruction implemented
- [ ] Separate house fee collection implemented
- [ ] GameRound state updated with new fields:
  - [ ] `winnings_claimed: bool`
  - [ ] `house_fee_collected: bool`
- [ ] Events added for all new instructions
- [ ] Tests written for all critical paths:
  - [ ] Emergency withdraw after 24 hours
  - [ ] Emergency withdraw fails before 24 hours
  - [ ] Winner can claim winnings
  - [ ] Non-winner cannot claim winnings
  - [ ] Double claim prevented
  - [ ] House fee collection
  - [ ] Double fee collection prevented
- [ ] Frontend updated to call new instructions
- [ ] Smart contract audit completed
- [ ] Devnet testing completed (all scenarios)

---

## 🔧 Testing Commands

```bash
# Build
anchor build

# Test on localnet
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Test all critical paths
NODE_OPTIONS='--loader ts-node/esm' npx mocha -t 1000000 tests/devnet.test.ts
```

---

## 📊 Account Space Updates

Update `GAME_ROUND_SPACE` in constants.rs to account for new fields:
```rust
// Add 2 bytes for new booleans
pub const GAME_ROUND_SPACE: usize = 660; // Was 658, now +2 for flags
```

---

## ⚠️ Migration Note

If you've already deployed to devnet with the old version:
1. These changes require a **NEW program deployment** (account structure changed)
2. Old games cannot be migrated (account size changed)
3. Must deploy as a new program ID
4. Update frontend to use new program ID

---

**Priority**: 🔴 BLOCKING - DO NOT GO TO MAINNET WITHOUT THESE
**Estimated Work**: 4-6 hours of development + 2-4 hours testing
**Risk if Skipped**: Player funds permanently lost, legal liability

---

**Created**: 2025-10-22
**Last Updated**: 2025-10-22
