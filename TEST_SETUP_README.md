# Domin8 Test Setup

## Overview
Successfully configured a test setup similar to the riskdotfun-program-jackpot project. The test framework is now working with TypeScript + Mocha + Chai.

## Test Configuration

### Files Created
1. **`tsconfig.test.json`** - TypeScript configuration for tests
2. **`tests/simple-setup.ts`** - Basic setup test (working example)
3. **`tests/setup-test.ts`** - More comprehensive setup test (for reference)

### Configuration Files Modified
- **`Anchor.toml`** - Updated test script to use ESM loader

## Test Script
```bash
# Run tests
anchor test --skip-build --skip-deploy

# Or directly
NODE_OPTIONS='--loader ts-node/esm' yarn mocha -t 1000000 tests/simple-setup.ts
```

## Test Structure (Following riskdotfun Pattern)

### 1. Provider & Program Setup
```typescript
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.Domin8Prgm;
const connection = provider.connection;
```

### 2. Test Account Generation
```typescript
let adminKeypair: web3.Keypair;
let treasuryKeypair: web3.Keypair;
let player1: web3.Keypair;
let player2: web3.Keypair;

// In before() hook
adminKeypair = web3.Keypair.generate();
treasuryKeypair = web3.Keypair.generate();
player1 = web3.Keypair.generate();
player2 = web3.Keypair.generate();
```

### 3. PDA Derivation
```typescript
const [gameConfigPda] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("game_config")],
  program.programId
);

const [gameRoundPda] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("game_round")],
  program.programId
);

const [gameCounterPda] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("game_counter")],
  program.programId
);
```

### 4. Account Fetching
```typescript
const configAccount = await program.account.gameConfig.fetch(gameConfigPda);
const counterAccount = await program.account.gameCounter.fetch(gameCounterPda);
const roundAccount = await program.account.gameRound.fetch(gameRoundPda);
```

## Current Test Results
```
✓ Should have correct program ID
✓ Should have valid provider connection
✓ Should derive consistent PDAs
✓ Should fetch game config if it exists
✓ Should fetch game counter if it exists
✓ Should check if game round exists
✓ Should display test summary

7 passing (584ms)
```

## Key Patterns from riskdotfun

### Instruction Call Pattern
```typescript
const tx = await program.methods
  .instructionName(params)
  .accounts({
    config: configPda,
    authority: adminKeypair.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
  .signers([adminKeypair])
  .rpc();
```

### Assertions Pattern
```typescript
// Fetch account after transaction
const account = await program.account.gameConfig.fetch(configPda);

// Assert fields
expect(account.authority.toString()).to.equal(expectedAuthority.toString());
expect(account.treasury.toString()).to.equal(expectedTreasury.toString());
```

### Test Organization
```typescript
describe("Program Name - Test Suite", () => {
  before(async () => {
    // Setup: generate accounts, derive PDAs, airdrop (if localnet)
  });

  describe("1. Feature Category", () => {
    it("Should do specific thing", async () => {
      // Test implementation
    });
  });

  describe("2. Next Feature", () => {
    // More tests
  });
});
```

## Common Issues Resolved

### Issue 1: ESM Module Errors
**Problem**: `Must use import to load ES Module` error with ts-mocha
**Solution**: Use Node's ESM loader: `NODE_OPTIONS='--loader ts-node/esm'`

### Issue 2: Type Import Errors
**Problem**: Cannot import from `../target/types/domin8_prgm.js`
**Solution**: Use `anchor.workspace.Domin8Prgm` instead of importing types

### Issue 3: BN Import
**Problem**: `@coral-xyz/anchor` doesn't export `BN`
**Solution**: Don't import BN from anchor, use it from anchor namespace if needed

## Next Steps

### 1. Add More Tests
Follow the riskdotfun pattern to add comprehensive tests:

```typescript
describe("2. Initialize Configuration", () => {
  it("Should initialize game config successfully", async () => {
    const tx = await program.methods
      .initialize(treasuryKeypair.publicKey)
      .accounts({
        authority: provider.wallet.publicKey,
        gameConfig: gameConfigPda,
        gameCounter: gameCounterPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const configAccount = await program.account.gameConfig.fetch(gameConfigPda);
    expect(configAccount.authority.toString()).to.equal(
      provider.wallet.publicKey.toString()
    );
  });
});

describe("3. Create Game", () => {
  it("Should create a new game round with first bet", async () => {
    // Test implementation
  });
});

describe("4. Place Bets", () => {
  it("Should allow additional players to place bets", async () => {
    // Test implementation
  });
});
```

### 2. Add VRF Tests (if using ORAO VRF)
Similar to riskdotfun, you'll need to:
- Initialize VRF config
- Request VRF randomness
- Emulate fulfillment for local testing

### 3. Test Full Game Flow
Create sequential tests that:
1. Initialize configuration
2. Create game (first bet)
3. Add more bets
4. Close betting window
5. Select winner (with VRF)
6. Payout winner
7. Cleanup

## Reference
- Original riskdotfun test: `/Users/peko/work/ferno/riskdotfun-program-jackpot/tests/risk.ts`
- Mocha timeout: 1,000 seconds (1,000,000 ms) for slow blockchain operations
- Anchor.toml test configuration follows riskdotfun pattern

## Tips
1. Use `console.log()` extensively for debugging
2. Wrap account fetches in try-catch to handle non-existent accounts
3. Test on localnet first, then devnet
4. Use `anchor test --skip-build` to save time when code hasn't changed
5. Follow the sequential test pattern from riskdotfun for complex workflows
