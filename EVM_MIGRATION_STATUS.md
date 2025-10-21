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

### 4. Utility Functions (`src/lib/utils.ts`)
- **Status**: ✅ Complete
- **Changes**:
  - Added `getEvmRpcUrl()` function
  - Supports Base mainnet and Base Sepolia testnet
  - Removed Solana-specific utilities

## 🔄 Partially Updated

### CharacterSelection Component (`src/components/CharacterSelection.tsx`)
- **Status**: 🔄 In Progress (~50% complete)
- **Completed**:
  - Updated imports to use EVM utilities
  - Changed wallet destructuring to use EVM wallet
  - Updated bet amount validation (ETH instead of SOL)
  - Modified balance checks
- **Remaining**:
  - Remove ~400 lines of Solana transaction building code
  - Replace complex PDA derivations and instruction creation
  - Simplify betting logic to use `placeBetOnContract()`
  - Update UI text and error messages
  - Remove Solana-specific dependencies

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
Update `.env` files:
```bash
# Remove
VITE_SOLANA_RPC_URL=...
VITE_SOLANA_NETWORK=...

# Add
VITE_EVM_RPC_URL=...
VITE_EVM_NETWORK=...
VITE_DOMIN8_CONTRACT_ADDRESS=...
```

### Package Dependencies
Consider removing unused Solana packages:
- `@solana/web3.js`
- `@solana/kit`
- `@coral-xyz/anchor`
- `@privy-io/react-auth/solana`

### Convex Mutations
The frontend currently calls `placeEntryBet` mutation that doesn't exist. Options:
1. Create the mutation in Convex to handle bet placement
2. Handle bets purely through contract calls (current approach)
3. Hybrid approach: contract call + Convex event listener

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
- **Betting Utilities**: 100% ✅
- **Character Selection**: 50% 🔄
- **Game Status Components**: 0% ❌
- **Type Definitions**: 0% ❌
- **Utility Functions**: 25% 🔄
- **Testing**: 0% ❌

**Overall Progress**: ~45% complete

## 🚨 Critical Path

The critical path for a working EVM frontend is:
1. Complete CharacterSelection component
2. Test EVM contract integration
3. Update game status components
4. Full end-to-end testing

Once CharacterSelection is complete, the core betting functionality should work. The remaining tasks are primarily cleanup and polish.</content>
<parameter name="filePath">c:\github\royalrumble\EVM_MIGRATION_STATUS.md