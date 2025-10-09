# ORAO VRF Integration Plan

## Overview
Replace the current commit-reveal blockchain-based randomness with ORAO VRF for provable, unbiased randomness in the Royal Rumble game.

## Current Implementation Analysis

### Current Randomness Flow:
1. **progress_to_resolution.rs**: Commits to a future slot for randomness
2. **resolve_winner.rs**: Uses commit-reveal pattern with recent blockhashes
3. **GameRound state**: Stores `randomness_commit_slot` and `winner_randomness_account`

### ORAO VRF Benefits:
- ✅ **Provable randomness**: Cryptographically verifiable
- ✅ **Cost effective**: 0.001 SOL vs current gas costs
- ✅ **Fast**: Sub-second to 4-20s fulfillment
- ✅ **Unbiased**: Cannot be manipulated by miners/validators
- ✅ **Active support**: Well-documented with examples

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

### Phase 3: New VRF Request Instruction

**3.1 Create request_randomness.rs**
```rust
use anchor_lang::prelude::*;
use orao_solana_vrf::cpi::accounts::RequestV2;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::cpi::request_v2;

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
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
    
    /// The crank authority requesting randomness
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

pub fn request_randomness(ctx: Context<RequestRandomness>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    // Validate game state
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );
    
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
    
    // Update game state
    game_round.status = GameStatus::AwaitingWinnerRandomness;
    game_round.randomness_fulfilled = false;
    
    msg!("ORAO VRF request submitted for game {}", game_round.round_id);
    Ok(())
}

fn generate_vrf_seed(round_id: u64) -> [u8; 32] {
    let mut seed = [0u8; 32];
    seed[0..8].copy_from_slice(&round_id.to_le_bytes());
    seed[8..16].copy_from_slice(&Clock::get().unwrap().unix_timestamp.to_le_bytes());
    seed
}
```

### Phase 4: Update Existing Instructions

**4.1 Update progress_to_resolution.rs**
```rust
// Remove commit-reveal logic, add VRF request call
pub fn progress_to_resolution(ctx: Context<ProgressToResolution>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );
    
    let player_count = game_round.players.len();
    msg!("Progressing game to resolution with {} players", player_count);
    
    match player_count {
        0 => return Err(Domin8Error::InvalidGameStatus.into()),
        1 => {
            // Single player - immediate refund
            game_round.status = GameStatus::Finished;
            msg!("Single player game - marking for refund");
        },
        2..=MAX_PLAYERS => {
            // Multi-player game - request randomness via separate instruction
            // This instruction just validates state transition
            // The crank will call request_randomness next
            msg!("Game ready for randomness request with {} players", player_count);
        },
        _ => return Err(Domin8Error::MaxPlayersReached.into()),
    }
    
    Ok(())
}
```

**4.2 Update resolve_winner.rs**
```rust
// Replace generate_verified_randomness with ORAO VRF reading
pub fn resolve_winner(ctx: Context<ResolveWinner>) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    require!(
        game_round.status == GameStatus::AwaitingWinnerRandomness,
        Domin8Error::InvalidGameStatus
    );
    
    // Read randomness from ORAO VRF account
    let randomness = read_orao_randomness(&ctx.accounts.vrf_request)?;
    
    msg!("Retrieved ORAO VRF randomness: {}", randomness);
    
    // Select winner using verified randomness
    require!(
        game_round.players.len() >= 2,
        Domin8Error::InvalidGameStatus
    );
    
    let player_refs: Vec<&PlayerEntry> = game_round.players.iter().collect();
    let winner = select_weighted_winner(&player_refs, randomness)?;
    
    game_round.winner = winner;
    game_round.status = GameStatus::Finished;
    game_round.randomness_fulfilled = true;
    
    msg!("Winner selected: {}", winner);
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
}
```

### Phase 6: Frontend Integration

**6.1 Update game progression calls**
```typescript
// New flow: progress_to_resolution -> request_randomness -> resolve_winner

// 1. Progress game
await program.methods
  .progressToResolution()
  .accounts({
    config: configPDA,
    gameRound: gameRoundPDA,
    crank: authority.publicKey,
  })
  .rpc();

// 2. Request randomness
const vrfRequestPDA = PublicKey.findProgramAddressSync(
  [Buffer.from("vrf_request"), gameRoundPDA.toBuffer()],
  program.programId
)[0];

await program.methods
  .requestRandomness()
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

// 3. Wait for fulfillment and resolve winner
// (Crank service handles this automatically)
```

### Phase 7: Testing Strategy

**7.1 Unit Tests**
- Test VRF request generation
- Test randomness reading from fulfilled accounts
- Test winner selection with ORAO randomness

**7.2 Integration Tests**
- Full game flow with ORAO VRF on devnet
- Multiple players with different bet amounts
- Verify randomness is truly random across multiple games

**7.3 Performance Tests**
- Measure VRF fulfillment time
- Compare gas costs vs current implementation
- Test with maximum player capacity (64 players)

## Migration Strategy

### Step 1: Parallel Implementation
- Keep current implementation as fallback
- Add ORAO VRF as optional path
- Use feature flag to switch between implementations

### Step 2: Testing Phase
- Deploy to devnet with ORAO VRF enabled
- Run extensive testing over 1-2 weeks
- Monitor performance and reliability

### Step 3: Full Migration
- Remove commit-reveal code
- Make ORAO VRF the only randomness source
- Update all documentation

## Cost Analysis

| Component | Current Cost | ORAO VRF Cost | Savings |
|-----------|-------------|---------------|---------|
| Randomness Generation | ~0.005 SOL | 0.001 SOL | 80% reduction |
| Transaction Complexity | High | Low | Simplified |
| Security | Medium | High | Cryptographic proof |
| Manipulation Risk | Medium | None | Eliminated |

## Timeline

- **Week 1**: Dependencies and state updates (Phases 1-2)
- **Week 2**: Instruction implementation (Phases 3-4) 
- **Week 3**: Error handling and testing (Phases 5-7)
- **Week 4**: Frontend integration and deployment

## Success Metrics

1. **Functionality**: All game flows work with ORAO VRF
2. **Performance**: VRF fulfillment < 20 seconds
3. **Cost**: Total transaction cost reduced by >50%
4. **Security**: Zero manipulation vulnerabilities
5. **Reliability**: >99% VRF fulfillment success rate

This plan provides a complete roadmap for integrating ORAO VRF while maintaining game functionality and improving security, performance, and cost-effectiveness.