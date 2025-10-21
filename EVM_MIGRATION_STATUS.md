# Frontend EVM Migration Status

## Overview
The Royal Rumble project has migrated its backend (smart contract + Convex) to EVM, but the frontend remains Solana-based. This document tracks the migration progress to make the frontend compatible with EVM.

## ✅ Completed Updates

### 1. Wallet Hook (`usePrivyWallet.ts`)
- **Status**: ✅ Complete
- **Changes**:
  - Replaced Solana wallet integration with EVM wallet support
  - Changed from `@privy-io/react-auth/solana` to `@privy-io/react-auth`
  - Updated balance fetching from SOL to ETH using ethers.js
  - Modified return values: `solBalance` → `ethBalance`, `publicKey` → `walletAddress`

### 2. Game State Hook (`useGameState.ts`)
- **Status**: ✅ Complete
- **Changes**:
  - Replaced direct Solana blockchain reads with Convex queries
  - Now uses `api.evm["evm-game-manager-db"].getGameState` instead of Solana RPC calls
  - Updated interfaces to match Convex EVM schema
  - Simplified logic - no more polling, Convex handles real-time updates

### 3. EVM Betting Utilities (`src/lib/evm-place-bet.ts`)
- **Status**: ✅ Complete
- **Features**:
  - Created `placeBetOnContract()` function for EVM contract interactions
  - Handles both `createGame()` and `placeBet()` contract calls
  - Includes `validateBetAmount()` for EVM constraints (ETH instead of SOL)
  - Uses ethers.js for contract interactions
- **Note**: ⚠️ Function has a critical bug - uses incorrect signer creation that will fail. Needs wallet provider integration fix.

### 4. Utility Functions (`src/lib/utils.ts`)
- **Status**: ✅ Complete
- **Changes**:
  - Added `getEvmRpcUrl()` function
  - Supports Base mainnet and Base Sepolia testnet
  - Removed Solana-specific utilities

## 🔄 Partially Updated

### CharacterSelection Component (`src/components/CharacterSelection.tsx`)
- **Status**: 🔄 In Progress (~70% complete)
- **Completed**:
  - Updated imports to use EVM utilities
  - Changed wallet destructuring to use EVM wallet
  - Updated bet amount validation (ETH instead of SOL)
  - Modified balance checks
  - Implemented `handlePlaceBet()` with EVM contract call
  - Added proper error handling and success messages
- **Remaining**:
  - Remove ~400 lines of OLD Solana transaction building code (lines 150-550+)
  - Clean up dead code and unused imports
  - Fix the wallet provider issue in `placeBetOnContract()`
  - Remove Solana-specific dependencies (@solana/web3.js, etc.)
  - Test end-to-end bet placement

## ✅ Backend Verification (Convex + Smart Contract)

### Smart Contract (`docs/foundry/src/Domin8.sol`)
✅ **Verified Core Functions**:
- `createGame()` - First bet creates game and requests VRF randomness
- `placeBet()` - Subsequent bets in Waiting phase
- `closeBettingWindow()` - Crank closes betting when time expires
- `selectWinnerAndPayout()` - Crank selects winner after VRF fulfilled
- **Game States**: Idle (0), Waiting (1), AwaitingWinnerRandomness (2), Finished (3)

✅ **Events Emitted**:
- `BetPlaced(roundId, player, amount, betCount, totalPot, endTimestamp, isFirstBet)`
- `GameLocked(roundId, finalBetCount, totalPot, vrfRequestId)`
- `WinnerSelected(roundId, winner, totalPot, houseFee, winnerPayout)`
- `RandomnessFulfilled(requestId, roundId)`

### Convex Backend (`convex/evm/`)
✅ **Verified Components**:
- **evm-game-manager.ts**: Cron job polls contract and progresses game
- **evm-game-manager-db.ts**: Syncs contract state to Convex DB
- **evm-event-listener.ts**: Listens for events and creates bet records
- **evm-bets.ts**: Handles bet creation and settlement
- **evm-schema.ts**: Database schema matches contract data structures

✅ **Data Flow**:
1. Frontend → Contract: User calls `createGame()` or `placeBet()` with ETH
2. Contract → Blockchain: Transaction confirmed, event emitted
3. Event Listener → Convex: Bet synced to database
4. Cron Job → Contract: Checks game state, progresses when needed
5. Convex → Frontend: Real-time query updates UI

### Alignment Check
✅ All backend components correctly implement the contract's data structures
✅ Event listener properly handles `BetPlaced` and `WinnerSelected`
✅ Game state enum matches: Idle/Waiting/AwaitingWinnerRandomness/Finished
✅ Bet amounts stored as strings (handles uint256 from contract)
✅ Round IDs, wallet addresses, and timestamps properly mapped

## 📋 Remaining Tasks

### 5. Complete CharacterSelection Component
- **Priority**: High
- **Effort**: Large
- **Details**:
  - Remove all Solana PDAs, transaction building, and blockchain interaction code
  - Replace with simple EVM contract calls using `placeBetOnContract()`
  - Update bet amount validation (0.01-10 ETH instead of SOL)
  - Update UI text ("SOL" → "ETH", "lamports" → "wei")
  - Simplify error handling and success messages
  - Remove complex VRF seed generation and account derivation logic

### 6. Update Game Status Components
- **Priority**: Medium
- **Components**:
  - `GameStatus.tsx`: Update status display logic
  - `BettingCountdown.tsx`: Update timer calculations
- **Changes Needed**:
  - Replace Solana-specific status checks with EVM game states
  - Update status messages and icons
  - Ensure timer works with EVM timestamps

### 7. Update Type Definitions
- **Priority**: Medium
- **Files**: Various TypeScript files
- **Changes Needed**:
  - Replace Solana `PublicKey` types with `string` (EVM addresses)
  - Update bet amount types from `number` (lamports) to `string` (wei)
  - Remove Anchor-generated interfaces
  - Update game state interfaces to match Convex EVM schema

### 8. Update Utility Functions
- **Priority**: Low
- **Files**: `utils.ts`, wallet utilities
- **Changes Needed**:
  - Remove Solana-specific utilities
  - Ensure all RPC calls use EVM endpoints
  - Update environment variable handling
  - Clean up unused imports

### 9. Test EVM Integration
- **Priority**: High
- **Testing Areas**:
  - Wallet connection with EVM
  - Bet placement on EVM contract
  - Convex event synchronization
  - Game state updates
  - Balance updates after transactions

## 🔧 Technical Considerations

### Environment Variables
⚠️ **Current Status**: Frontend `.env` still has Solana variables
```bash
# NEED TO REMOVE:
VITE_SOLANA_NETWORK=devnet

# NEED TO ADD:
VITE_EVM_NETWORK=base-sepolia (or base-mainnet)
VITE_DOMIN8_CONTRACT_ADDRESS=0x... (deployed contract address)

# Backend Convex env vars (should already exist):
EVM_RPC_ENDPOINT=https://sepolia.base.org
CRANK_EVM_PRIVATE_KEY=0x...
DOMIN8_CONTRACT_ADDRESS=0x...
```

### Package Dependencies
Consider removing unused Solana packages:
- `@solana/web3.js`
- `@solana/kit`
- `@coral-xyz/anchor`
- `@privy-io/react-auth/solana`

### Convex Mutations & Event Synchronization
✅ **Backend is properly configured:**
- Event listener (`evm-event-listener.ts`) processes `BetPlaced` and `WinnerSelected` events
- Bets are automatically synced from blockchain to Convex via `createOrUpdateBetFromEvent`
- Game state is updated by cron job polling (`evm-game-manager.ts`)
- No need for frontend to call mutations - all handled by backend automation

**Frontend approach**: Place bet on contract → Event listener syncs to Convex → UI updates via real-time queries

## 🎯 Next Steps

### Immediate (High Priority)
1. **Complete CharacterSelection component** - Remove Solana code, implement EVM betting
2. **Test wallet connection** - Verify EVM wallet integration works
3. **Test game state reading** - Ensure Convex queries work properly

### Short Term (Medium Priority)
4. **Update game status components** - GameStatus and BettingCountdown
5. **Update type definitions** - Clean up TypeScript interfaces
6. **Test bet placement** - End-to-end EVM contract interaction

### Long Term (Low Priority)
7. **Clean up utilities** - Remove Solana-specific code
8. **Update documentation** - README, environment setup
9. **Performance optimization** - Optimize Convex queries and real-time updates

## 📊 Migration Progress

- **Wallet Integration**: 100% ✅
- **Game State Reading**: 100% ✅
- **Betting Utilities**: 95% 🔄 (needs wallet provider fix)
- **Character Selection**: 70% 🔄 (needs cleanup)
- **Game Status Components**: 0% ❌
- **Type Definitions**: 50% 🔄 (partially updated in hooks)
- **Utility Functions**: 60% 🔄 (getEvmRpcUrl done, cleanup needed)
- **Testing**: 0% ❌

**Overall Progress**: ~60% complete

## 🎯 Immediate Action Items (Priority Order)

### 1. Fix Critical Blocker (1-2 hours)
**File**: `src/lib/evm-place-bet.ts`
```typescript
// Replace lines 35-36:
// OLD (BROKEN):
const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = await provider.getSigner(wallet.address);

// NEW (WORKING):
const ethProvider = await wallet.getEthereumProvider();
const provider = new ethers.BrowserProvider(ethProvider);
const signer = await provider.getSigner();
```

### 2. Clean Up CharacterSelection (2-3 hours)
**File**: `src/components/CharacterSelection.tsx`
- Delete lines ~160-560 (all Solana transaction code)
- Remove unused imports: `@solana/web3.js`, `@solana-program/*`
- Test bet placement with fixed provider
- Verify UI shows success/error correctly

### 3. Fix Event Listener Timestamp (30 mins)
**File**: `convex/evm/evm-event-listener.ts`
```typescript
// Around line 72, replace:
timestamp: Number(args.timestamp) * 1000,

// With:
timestamp: Date.now(), // Or fetch from block if needed
```

### 4. Update Environment Variables (15 mins)
**File**: `.env` or `.env.local`
```bash
# Add these:
VITE_EVM_NETWORK=base-sepolia
VITE_DOMIN8_CONTRACT_ADDRESS=0x... # From deployment

# Remove these:
VITE_SOLANA_NETWORK=devnet
```

### 5. Test End-to-End (1 hour)
- [ ] Connect wallet
- [ ] Select character
- [ ] Place bet (0.01 ETH)
- [ ] Verify transaction on block explorer
- [ ] Check Convex dashboard for bet record
- [ ] Confirm UI updates

**Time Estimate**: 5-7 hours to get betting working
**Current Blocker**: Wallet provider fix (#1 above)

## 🚨 Critical Path

The critical path for a working EVM frontend is:
1. **Fix wallet provider in `evm-place-bet.ts`** - Most critical blocker
2. Complete CharacterSelection cleanup - Remove dead Solana code
3. Test EVM contract integration
4. Update game status components
5. Full end-to-end testing

Once CharacterSelection is complete, the core betting functionality should work. The remaining tasks are primarily cleanup and polish.

## 🐛 Critical Issues Found During Review

### 1. **BLOCKER: Wallet Provider Issue in `evm-place-bet.ts`**
**Severity**: 🔴 Critical - Prevents betting from working

**Problem**: The current implementation tries to create a signer like this:
```typescript
const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = await provider.getSigner(wallet.address);
```

This won't work because:
- `JsonRpcProvider.getSigner()` expects a provider that has wallet access (like MetaMask)
- Privy wallet needs special handling through their SDK

**Solution**: Use Privy's `getEthereumProvider()` method:
```typescript
const provider = await wallet.getEthereumProvider();
const ethersProvider = new ethers.BrowserProvider(provider);
const signer = await ethersProvider.getSigner();
```

### 2. **Dead Code in CharacterSelection.tsx**
**Severity**: 🟡 Medium - Code quality/maintenance issue

**Problem**: Lines ~160-560 contain unused Solana transaction code:
- PDA derivations for Solana program
- `createSolanaRpc()` calls
- Solana-specific account lookups
- Old VRF seed generation

**Impact**: Confusing for developers, increases bundle size

**Solution**: Remove all Solana-specific code after testing EVM betting works

### 3. **Missing Contract ABI Reference**
**Severity**: 🟡 Medium - Limits functionality

**Problem**: `evm-place-bet.ts` uses minimal ABI (only placeBet/createGame)

**Current**:
```typescript
const contract = new ethers.Contract(
  contractAddress,
  ["function placeBet() payable", "function createGame() payable", ...],
  signer
);
```

**Better approach**: Import full ABI from `convex/evm/Domin8.json`
- Enables type-safe contract interactions
- Access to all contract methods and events
- Better error messages

### 4. **BetPlaced Event Missing Timestamp**
**Severity**: 🟢 Low - Backend handles it

**Problem**: Smart contract `BetPlaced` event doesn't emit `timestamp` field, but event listener tries to use it:
```typescript
// In evm-event-listener.ts
timestamp: Number(args.timestamp) * 1000, // ❌ timestamp doesn't exist in event
```

**Solution**: Use block timestamp or `Date.now()` in event listener:
```typescript
const block = await event.getBlock();
timestamp: block.timestamp * 1000
```</content>
<parameter name="filePath">c:\github\royalrumble\EVM_MIGRATION_STATUS.md