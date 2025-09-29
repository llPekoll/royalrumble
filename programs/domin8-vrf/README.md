# Domin8 VRF Program

A lightweight Solana program for generating verifiable random numbers for the Domin8 game.

## Program Structure

```
src/
├── lib.rs                    # Main program entry point
├── errors.rs                 # Custom error definitions
├── state.rs                  # Account structures (VrfState, GameSeed)
└── instructions/
    ├── mod.rs               # Module exports
    ├── initialize.rs        # Initialize VRF state
    ├── request_vrf.rs       # Request random seed for a game
    └── mark_seed_used.rs    # Mark seed as consumed

tests/
└── domin8_vrf.ts            # TypeScript tests
```

## Key Features

- **Minimal On-chain Storage**: Only stores game ID, round number, and random seed
- **Two-Transaction Security**: Long games use separate VRF for each elimination round
- **Authority Control**: Only authorized wallet can request VRF
- **Round Validation**: Supports round 1 (initial/top 4) and round 2 (final)

## Account Structure

### VrfState
- `authority`: Pubkey - Wallet authorized to request VRF
- `nonce`: u64 - Incremental counter for entropy

### GameSeed
- `game_id`: String - Reference to off-chain game (max 32 bytes)
- `round`: u8 - Round number (1 or 2)
- `random_seed`: [u8; 32] - Generated random bytes
- `timestamp`: i64 - Unix timestamp when generated
- `used`: bool - Whether seed has been consumed

## Usage

### Initialize (one-time setup)
```typescript
await program.methods
  .initialize()
  .accounts({
    vrfState,
    authority,
    systemProgram
  })
  .rpc();
```

### Request VRF
```typescript
// Quick game or round 1 of long game
await program.methods
  .requestVrf(gameId, 1)
  .accounts({...})
  .rpc();

// Round 2 of long game (after betting)
await program.methods
  .requestVrf(gameId, 2)
  .accounts({...})
  .rpc();
```

### Mark Seed Used (optional)
```typescript
await program.methods
  .markSeedUsed()
  .accounts({...})
  .rpc();
```

## Security

- Seeds are generated using multiple entropy sources (blockhashes, timestamps, nonce)
- Two-transaction approach prevents prediction of final winner during betting phase
- Authority check ensures only game backend can request VRF

## Testing

```bash
# Start local validator
solana-test-validator

# Run tests
anchor test --skip-local-validator
```

## Deployment

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta
```