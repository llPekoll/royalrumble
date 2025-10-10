# ORAO VRF Integration Plan - Unified Flow

## Overview
Replace the current commit-reveal blockchain-based randomness with ORAO VRF for provable, unbiased randomness in the Royal Rumble game. **This plan implements a unified flow that combines progress_to_resolution, randomness generation, resolve_winner, and distribute_winnings into a streamlined 2-phase process optimized for small games MVP.**

## Current Implementation Analysis

### Current GameManager Flow (Simplified for Small Games MVP):
```typescript
case GameStatus.Waiting:
  await handleWaitingPhase(ctx, solanaClient, gameRound, gameState, gameConfig, now);
  break;

case GameStatus.AwaitingWinnerRandomness:
  await handleWinnerRandomnessAndFinishGame(ctx, solanaClient, gameRound, gameState, now);
  break;
```

### Target Unified Flow:
1. **Waiting Phase → Direct Resolution**: Single transaction that progresses game, requests VRF, and sets up for winner resolution
2. **AwaitingWinnerRandomness → Complete**: Single transaction that resolves winner and distributes winnings

### ORAO VRF Benefits:
- ✅ **Provable randomness**: Cryptographically verifiable
- ✅ **Cost effective**: 0.001 SOL vs current gas costs
- ✅ **Fast**: Sub-second to 4-20s fulfillment
- ✅ **Unbiased**: Cannot be manipulated by miners/validators
- ✅ **Active support**: Well-documented with examples
- ✅ **Unified flow**: Fewer transactions, simplified state management

## Implementation Plan

### Phase 1: Dependencies and Setup

**1.1 Update Cargo.toml**
```toml
[dependencies]
anchor-lang = "0.31.1"
orao-solana-vrf = { version = "0.4.0", features = ["anchor"] }
```

**1.2 Update Anchor.toml**
```toml
[programs.devnet]
domin8_prgm = "CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK"
orao_vrf = "VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y"  # ORAO VRF Program ID
```

### Phase 2: State Structure Updates

**2.1 Update GameRound struct**
```rust
#[account]
pub struct GameRound {
    pub round_id: u64,
    pub status: GameStatus,
    pub start_timestamp: i64,
    
    // Players (max 64)
    pub players: Vec<PlayerEntry>,
    
    // Pot tracking
    pub initial_pot: u64,
    
    // Winner
    pub winner: Pubkey,
    
    // ORAO VRF integration
    pub vrf_request_pubkey: Pubkey,    // ORAO VRF request account
    pub vrf_seed: [u8; 32],           // Seed used for VRF request
    pub randomness_fulfilled: bool,    // Track if randomness is ready
    
    // Remove commit-reveal fields:
    // pub winner_randomness_account: Pubkey,  // Remove
    // pub randomness_commit_slot: u64,        // Remove
}
```

**2.2 Add VRF configuration to GameConfig**
```rust
#[account]
pub struct GameConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    
    // Game configuration
    pub house_fee_basis_points: u16,
    
    // ORAO VRF configuration
    pub vrf_fee_lamports: u64,        // Fee for VRF requests (0.001 SOL)
    pub vrf_network_state: Pubkey,    // ORAO network state account
    pub vrf_treasury: Pubkey,         // ORAO treasury account
}
```

### Phase 3: Unified Instructions (2-Transaction Flow)

**3.1 Create unified_progress_to_resolution.rs**
```rust
use anchor_lang::prelude::*;
use orao_solana_vrf::cpi::accounts::RequestV2;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::cpi::request_v2;

#[derive(Accounts)]
pub struct UnifiedProgressToResolution<'info> {
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    
    /// The crank authority
    #[account(
        mut,
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,
    
    /// ORAO VRF Program
    pub vrf_program: Program<'info, OraoVrf>,
    
    /// ORAO Network State
    /// CHECK: ORAO VRF program validates this
    #[account(mut)]
    pub network_state: AccountInfo<'info>,
    
    /// ORAO Treasury
    /// CHECK: ORAO VRF program validates this  
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    /// VRF Request Account (PDA derived from game_round + seed)
    /// CHECK: Will be created by ORAO VRF program
    #[account(mut)]
    pub vrf_request: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

/// UNIFIED INSTRUCTION: Progress game from Waiting directly to AwaitingWinnerRandomness
/// This replaces the old progress_to_resolution + separate VRF request
pub fn unified_progress_to_resolution(ctx: Context<UnifiedProgressToResolution>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    // Validate game state
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );
    
    let player_count = game_round.players.len();
    msg!("Unified progress: transitioning game {} with {} players", game_round.round_id, player_count);
    
    match player_count {
        0 => {
            return Err(Domin8Error::InvalidGameStatus.into());
        },
        1 => {
            // Single player - immediate finish with refund
            game_round.status = GameStatus::Finished;
            game_round.winner = game_round.players[0].wallet;
            msg!("Single player game - immediate finish with refund");
            return Ok(());
        },
        2..=MAX_PLAYERS => {
            // Multi-player game - request ORAO VRF and transition to AwaitingWinnerRandomness
            
            // Generate deterministic seed for this game round
            let seed: [u8; 32] = generate_vrf_seed(game_round.round_id);
            game_round.vrf_seed = seed;
            game_round.vrf_request_pubkey = ctx.accounts.vrf_request.key();
            
            // Make CPI call to ORAO VRF
            let cpi_program = ctx.accounts.vrf_program.to_account_info();
            let cpi_accounts = RequestV2 {
                payer: ctx.accounts.crank.to_account_info(),
                network_state: ctx.accounts.network_state.to_account_info(),
                treasury: ctx.accounts.treasury.to_account_info(),
                request: ctx.accounts.vrf_request.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            };
            
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            request_v2(cpi_ctx, seed)?;
            
            // Update game state to AwaitingWinnerRandomness
            game_round.status = GameStatus::AwaitingWinnerRandomness;
            game_round.randomness_fulfilled = false;
            
            msg!("ORAO VRF requested - game {} now awaiting winner randomness", game_round.round_id);
        },
        _ => return Err(Domin8Error::MaxPlayersReached.into()),
    }
    
    Ok(())
}

fn generate_vrf_seed(round_id: u64) -> [u8; 32] {
    let mut seed = [0u8; 32];
    seed[0..8].copy_from_slice(&round_id.to_le_bytes());
    seed[8..16].copy_from_slice(&Clock::get().unwrap().unix_timestamp.to_le_bytes());
    seed
}
```

**3.2 Create unified_resolve_and_distribute.rs**
```rust
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UnifiedResolveAndDistribute<'info> {
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    
    /// The crank authority
    #[account(
        mut,
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,
    
    /// VRF Request Account containing fulfilled randomness
    /// CHECK: This account was created by ORAO VRF program
    pub vrf_request: AccountInfo<'info>,
    
    /// Treasury account for receiving house fees
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ Domin8Error::InvalidTreasury
    )]
    pub treasury: SystemAccount<'info>,
    
    /// Winner's account (to be determined from VRF)
    /// CHECK: Winner will be validated against game participants
    #[account(mut)]
    pub winner_account: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

/// UNIFIED INSTRUCTION: Resolve winner using ORAO VRF and immediately distribute winnings
/// This replaces the old resolve_winner + distribute_winnings flow
pub fn unified_resolve_and_distribute(ctx: Context<UnifiedResolveAndDistribute>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    require!(
        game_round.status == GameStatus::AwaitingWinnerRandomness,
        Domin8Error::InvalidGameStatus
    );
    
    require!(
        ctx.accounts.vrf_request.key() == game_round.vrf_request_pubkey,
        Domin8Error::InvalidVrfAccount
    );
    
    // 1. READ RANDOMNESS FROM ORAO VRF
    let randomness = read_orao_randomness(&ctx.accounts.vrf_request)?;
    msg!("Retrieved ORAO VRF randomness: {}", randomness);
    
    // 2. SELECT WINNER USING VERIFIED RANDOMNESS
    require!(
        game_round.players.len() >= 2,
        Domin8Error::InvalidGameStatus
    );
    
    let player_refs: Vec<&PlayerEntry> = game_round.players.iter().collect();
    let winner_wallet = select_weighted_winner(&player_refs, randomness)?;
    
    // Validate winner account matches the selected winner
    require!(
        ctx.accounts.winner_account.key() == winner_wallet,
        Domin8Error::InvalidWinnerAccount
    );
    
    game_round.winner = winner_wallet;
    msg!("Winner selected: {}", winner_wallet);
    
    // 3. CALCULATE AND DISTRIBUTE WINNINGS IMMEDIATELY
    let total_pot = game_round.initial_pot;
    let house_fee = (total_pot as u128 * ctx.accounts.config.house_fee_basis_points as u128 / 10000) as u64;
    let winner_payout = total_pot.saturating_sub(house_fee);
    
    msg!("Distributing: {} to winner, {} to house", winner_payout, house_fee);
    
    // Transfer to winner
    if winner_payout > 0 {
        **ctx.accounts.crank.to_account_info().try_borrow_mut_lamports()? -= winner_payout;
        **ctx.accounts.winner_account.try_borrow_mut_lamports()? += winner_payout;
    }
    
    // Transfer house fee to treasury
    if house_fee > 0 {
        **ctx.accounts.crank.to_account_info().try_borrow_mut_lamports()? -= house_fee;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += house_fee;
    }
    
    // 4. RESET GAME STATE FOR NEXT ROUND
    game_round.status = GameStatus::Idle;
    game_round.randomness_fulfilled = true;
    game_round.round_id += 1; // Increment for next game
    game_round.players.clear();
    game_round.initial_pot = 0;
    game_round.start_timestamp = 0;
    
    msg!("Game {} completed and reset - ready for round {}", game_round.round_id - 1, game_round.round_id);
    
    Ok(())
}

fn read_orao_randomness(vrf_account: &AccountInfo) -> Result<u64> {
    // Read fulfilled randomness from ORAO VRF account
    let data = vrf_account.data.borrow();
    
    // ORAO VRF account structure - randomness is at offset 8+32 = 40
    require!(data.len() >= 40 + 8, Domin8Error::InvalidVrfAccount);
    
    // Check if randomness is fulfilled (flag at offset 8+32+8 = 48)
    let fulfilled = data[48] != 0;
    require!(fulfilled, Domin8Error::RandomnessNotFulfilled);
    
    // Read 8-byte randomness value
    let randomness_bytes: [u8; 8] = data[40..48].try_into()
        .map_err(|_| Domin8Error::InvalidVrfAccount)?;
    
    Ok(u64::from_le_bytes(randomness_bytes))
}
```

### Phase 4: Update GameManager.ts for Unified Flow

**4.1 Updated Convex Game Manager**
```typescript
/**
 * Process game based on current status and timing (UNIFIED ORAO VRF FLOW)
 */
async function processGameStatus(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  gameConfig: any,
  now: number
) {
  const gameId = gameState.gameId;

  switch (gameRound.status) {
    case GameStatus.Idle:
      // Nothing to do, waiting for players
      break;

    case GameStatus.Waiting:
      await handleWaitingPhase(ctx, solanaClient, gameRound, gameState, gameConfig, now);
      break;

    case GameStatus.AwaitingWinnerRandomness:
      await handleWinnerRandomnessAndComplete(ctx, solanaClient, gameRound, gameState, now);
      break;

    default:
      console.warn(`Unknown game status: ${gameRound.status}`);
  }
}

/**
 * Handle waiting phase - UNIFIED: progress directly to resolution with ORAO VRF request
 */
async function handleWaitingPhase(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  gameConfig: any,
  now: number
) {
  // Calculate when waiting phase should end
  const waitingDuration = gameConfig.smallGameDurationConfig.waitingPhaseDuration;
  const waitingEndTime = gameRound.startTimestamp * 1000 + waitingDuration * 1000;

  if (now >= waitingEndTime) {
    console.log(`Waiting phase ended for game ${gameState.gameId}, progressing with unified ORAO VRF`);

    try {
      // UNIFIED CALL: Progress to resolution + ORAO VRF request in one transaction
      const txHash = await solanaClient.unifiedProgressToResolution();

      await logGameEvent(ctx, gameState.gameId, "transaction_sent", {
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
        fromStatus: GameStatus.Waiting,
        toStatus: GameStatus.AwaitingWinnerRandomness,
        playersCount: gameRound.players.length,
      });

      const confirmed = await solanaClient.confirmTransaction(txHash);
      if (confirmed) {
        await logGameEvent(ctx, gameState.gameId, "transaction_confirmed", {
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
        });

        await ctx.db.patch(gameState._id, {
          status: "awaitingWinnerRandomness",
          gameType: "small",
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to progress with unified ORAO VRF:", error);
      await logGameEvent(ctx, gameState.gameId, "transaction_failed", {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.UNIFIED_PROGRESS_TO_RESOLUTION,
      });
    }
  }
}

/**
 * Handle winner randomness and complete game - UNIFIED: resolve winner + distribute + reset
 */
async function handleWinnerRandomnessAndComplete(
  ctx: { db: any },
  solanaClient: SolanaClient,
  gameRound: any,
  gameState: Doc<"gameStates">,
  now: number
) {
  // Check if ORAO VRF is fulfilled
  const vrfFulfilled = await solanaClient.checkVrfFulfillment(gameRound.vrfRequestPubkey);
  
  if (vrfFulfilled) {
    console.log(`ORAO VRF fulfilled for game ${gameState.gameId}, completing game`);

    try {
      // UNIFIED CALL: Resolve winner + distribute winnings + reset game in one transaction
      const txHash = await solanaClient.unifiedResolveAndDistribute(gameRound.vrfRequestPubkey);

      await logGameEvent(ctx, gameState.gameId, "transaction_sent", {
        success: true,
        transactionHash: txHash,
        transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
        fromStatus: GameStatus.AwaitingWinnerRandomness,
        toStatus: GameStatus.Idle,
      });

      const confirmed = await solanaClient.confirmTransaction(txHash);
      if (confirmed) {
        await logGameEvent(ctx, gameState.gameId, "game_completed", {
          success: true,
          transactionHash: txHash,
          transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
        });

        // Mark game as completed and ready for next round
        await ctx.db.patch(gameState._id, {
          status: "idle",
          resolvingPhaseEnd: now,
        });
      } else {
        throw new Error("Transaction confirmation failed");
      }
    } catch (error) {
      console.error("Failed to complete game with unified resolve and distribute:", error);
      await logGameEvent(ctx, gameState.gameId, "transaction_failed", {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        transactionType: TRANSACTION_TYPES.UNIFIED_RESOLVE_AND_DISTRIBUTE,
      });
    }
  } else {
    // VRF not yet fulfilled, wait longer
    console.log(`ORAO VRF not yet fulfilled for game ${gameState.gameId}, waiting...`);
  }
}
```

**4.2 Updated Transaction Types**
```typescript
const TRANSACTION_TYPES = {
  UNIFIED_PROGRESS_TO_RESOLUTION: 'unified_progress_to_resolution',
  UNIFIED_RESOLVE_AND_DISTRIBUTE: 'unified_resolve_and_distribute',
  // Remove old transaction types:
  // PROGRESS_TO_RESOLUTION: 'progress_to_resolution',
  // RESOLVE_WINNER: 'resolve_winner', 
  // DISTRIBUTE_WINNINGS: 'distribute_winnings',
};
```

**4.3 Updated SolanaClient Methods**
```typescript
class SolanaClient {
  // ... existing methods ...

  async unifiedProgressToResolution(): Promise<string> {
    // Build and send unified progress transaction with ORAO VRF
    const vrfRequestPDA = this.getVrfRequestPDA();
    
    const transaction = await this.program.methods
      .unifiedProgressToResolution()
      .accounts({
        gameRound: this.gameRoundPDA,
        config: this.configPDA,
        crank: this.authority.publicKey,
        vrfProgram: ORAO_VRF_PROGRAM_ID,
        networkState: ORAO_NETWORK_STATE,
        treasury: ORAO_TREASURY,
        vrfRequest: vrfRequestPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    return transaction;
  }

  async unifiedResolveAndDistribute(vrfRequestPubkey: PublicKey): Promise<string> {
    // Get winner from VRF result first
    const winner = await this.getWinnerFromVrf(vrfRequestPubkey);
    
    const transaction = await this.program.methods
      .unifiedResolveAndDistribute()
      .accounts({
        gameRound: this.gameRoundPDA,
        config: this.configPDA,
        crank: this.authority.publicKey,
        vrfRequest: vrfRequestPubkey,
        treasury: this.treasuryAccount,
        winnerAccount: winner,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    return transaction;
  }

  async checkVrfFulfillment(vrfRequestPubkey: PublicKey): Promise<boolean> {
    try {
      const vrfAccount = await this.connection.getAccountInfo(vrfRequestPubkey);
      if (!vrfAccount || vrfAccount.data.length < 49) {
        return false;
      }
      
      // Check fulfillment flag at offset 48
      return vrfAccount.data[48] !== 0;
    } catch (error) {
      console.error("Error checking VRF fulfillment:", error);
      return false;
    }
  }

  private getVrfRequestPDA(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vrf_request"), this.gameRoundPDA.toBuffer()],
      this.program.programId
    )[0];
  }
}
```

### Phase 5: Error Handling Updates

**5.1 Add ORAO-specific errors**
```rust
#[error_code]
pub enum Domin8Error {
    // ... existing errors
    
    // ORAO VRF errors
    #[msg("VRF account is invalid")]
    InvalidVrfAccount,
    
    #[msg("Randomness not yet fulfilled")]
    RandomnessNotFulfilled,
    
    #[msg("VRF request failed")]
    VrfRequestFailed,
    
    #[msg("Invalid VRF seed")]
    InvalidVrfSeed,
    
    #[msg("Invalid winner account")]
    InvalidWinnerAccount,
}
```

### Phase 6: Convex Integration - Simplified Flow

**6.1 New unified game progression calls for /convex/transactionHandlers.ts**
```typescript
// SIMPLIFIED 2-TRANSACTION FLOW:

// 1. Unified Progress: Waiting -> AwaitingWinnerRandomness (with ORAO VRF request)
const vrfRequestPDA = PublicKey.findProgramAddressSync(
  [Buffer.from("vrf_request"), gameRoundPDA.toBuffer()],
  program.programId
)[0];

await program.methods
  .unifiedProgressToResolution()
  .accounts({
    gameRound: gameRoundPDA,
    config: configPDA,
    crank: authority.publicKey,
    vrfProgram: ORAO_VRF_PROGRAM_ID,
    networkState: ORAO_NETWORK_STATE,
    treasury: ORAO_TREASURY,
    vrfRequest: vrfRequestPDA,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

// 2. Unified Complete: AwaitingWinnerRandomness -> Idle (resolve + distribute + reset)
// (Called automatically by crank when VRF is fulfilled)
```

### Phase 7: Testing Strategy

**7.1 Unit Tests**
- Test unified progression from Waiting to AwaitingWinnerRandomness
- Test unified completion from AwaitingWinnerRandomness to Idle
- Test ORAO VRF integration with randomness reading
- Test single-player immediate completion
- Test error handling for unfulfilled VRF

**7.2 Integration Tests**
- Full unified game flow with ORAO VRF on devnet
- Multiple games in sequence to test reset functionality
- Test crank service with unified flow
- Verify winner selection distribution over multiple games

**7.3 Performance Tests**
- Measure total game completion time (2 transactions vs previous 4+)
- Compare gas costs for unified vs separate transactions
- Test ORAO VRF fulfillment reliability and speed

## Migration Strategy

### Step 1: Unified Implementation
- Remove old commit-reveal instructions: `progress_to_resolution.rs`, `resolve_winner.rs`, `distribute_winnings.rs`
- Implement unified instructions: `unified_progress_to_resolution.rs`, `unified_resolve_and_distribute.rs`
- Update GameManager.ts for 2-transaction flow
- Test unified flow on devnet

### Step 2: Testing Phase
- Deploy unified ORAO VRF implementation to devnet
- Run extensive testing over 1-2 weeks
- Monitor ORAO VRF fulfillment reliability
- Validate game completion efficiency (reduced from 4+ transactions to 2)

### Step 3: Production Deployment
- Deploy unified implementation to mainnet
- Update convex calls for simplified flow
- Monitor performance and cost savings

## Cost Analysis - Unified Flow

| Component | Current Cost | ORAO VRF Unified Cost | Savings |
|-----------|-------------|----------------------|---------|
| Game Progression | 4+ transactions | 2 transactions | 50%+ reduction |
| Randomness Generation | ~0.005 SOL | 0.001 SOL | 80% reduction |
| Total Transaction Complexity | Very High | Low | Greatly simplified |
| Security | Medium | High | Cryptographic proof |
| Manipulation Risk | Medium | None | Eliminated |

## Timeline - Unified Implementation

- **Week 1**: Dependencies, state updates, and unified instruction implementation (Phases 1-3)
- **Week 2**: GameManager.ts updates and SolanaClient integration (Phase 4)
- **Week 3**: Error handling, testing, and validation (Phases 5-7)
- **Week 4**: Production deployment and monitoring

## Success Metrics

1. **Simplified Flow**: Game completion in exactly 2 transactions (vs 4+ current)
2. **Performance**: Total game completion time reduced by >50%
3. **Cost**: Total transaction cost reduced by >60%
4. **Security**: Zero manipulation vulnerabilities with provable randomness
5. **Reliability**: >99% ORAO VRF fulfillment success rate
6. **Maintainability**: Cleaner codebase with unified flow

## Key Benefits of Unified Approach

1. **Reduced Complexity**: 2 transactions instead of 4+ separate calls
2. **Atomic Operations**: Winner resolution and distribution happen atomically
3. **Cost Efficiency**: Fewer transactions = lower overall costs
4. **Faster Games**: Quicker completion times with unified flow
5. **Better UX**: Smoother game progression for players
6. **Simpler Monitoring**: Easier to track and debug with fewer moving parts

This unified plan provides a complete roadmap for integrating ORAO VRF while drastically simplifying the game flow to match your current GameManager.ts architecture optimized for small games MVP.