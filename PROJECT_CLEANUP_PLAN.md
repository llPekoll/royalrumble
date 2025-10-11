# Royal Rumble Project Cleanup and Integration Plan

## Current State Analysis

After reviewing all provided files, here's the current state of your project:

### 🎯 **Project Architecture Overview**
- **Frontend** (`~/src`): React app with demo/mock game functionality
- **Convex Backend** (`~/convex`): Mix of real Solana integration code and legacy demo files
- **Anchor Program** (`~/programs/domin8_prgm`): Deployed Solana program with simplified "small games MVP" design

### 📁 **Current File Structure Issues**

#### **Convex Backend - Cleanup Needed**
The convex folder contains a mix of:
- ✅ **Production files**: `gameManager.ts`, `gameManagerDb.ts`, `solana.ts`, `schema.ts`
- ❌ **Legacy demo files**: `games.ts`, `mockSmartContract.ts`, `gameParticipants.ts`, `bets.ts`
- ⚠️ **Outdated schema**: Contains complex game structures not matching the simplified Anchor program

#### **Frontend - Integration Needed**
- Currently uses demo/mock data
- Needs to integrate with real Convex backend
- Demo should remain for idle game states

---

## 🧹 **Phase 1: Convex Backend Cleanup**

### **Files to DELETE** (Legacy demo files)
```
convex/
├── games.ts                    ❌ DELETE - Complex game logic not matching Anchor program
├── mockSmartContract.ts        ❌ DELETE - Mock contract simulation
├── gameParticipants.ts         ❌ DELETE - Complex participant management
├── bets.ts                     ❌ DELETE - Complex betting system
├── transactions.ts             ❌ DELETE - Old transaction handling
├── monitoring.ts               ❌ DELETE - Outdated monitoring
├── cleanup.ts                  ❌ DELETE - Temporary cleanup utilities
├── privy.ts                    ❌ DELETE - Old wallet integration
└── leaderboard.ts             ❌ DELETE - Complex leaderboard (not in MVP)
```

### **Files to KEEP** (Production files)
```
convex/
├── gameManager.ts              ✅ KEEP - Core crank service
├── gameManagerDb.ts            ✅ KEEP - Database operations
├── solana.ts                   ✅ KEEP - Solana client integration
├── characters.ts               ✅ KEEP - Character management
├── maps.ts                     ✅ KEEP - Map management
├── players.ts                  ✅ KEEP - Player management
├── schema.ts                   ✅ KEEP but needs MAJOR cleanup
├── crons.ts                    ✅ KEEP - Cron job definitions
└── lib/                        ✅ KEEP - Utilities
```

---

## 🔄 **Phase 2: Schema Alignment with Anchor Program**

### **Current Anchor Program State Structure**
Based on the Anchor program files, the game has a simplified structure:

```rust
// GameConfig (Global singleton)
pub struct GameConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub house_fee_basis_points: u16,
    pub min_bet_lamports: u64,
    pub small_game_duration_config: GameDurationConfig,
    // ORAO VRF config
    pub vrf_fee_lamports: u64,
    pub vrf_network_state: Pubkey,
    pub vrf_treasury: Pubkey,
}

// GameRound (Current game state)
pub struct GameRound {
    pub round_id: u64,
    pub status: GameStatus, // Idle, Waiting, AwaitingWinnerRandomness, Finished
    pub start_timestamp: i64,
    pub players: Vec<PlayerEntry>, // Max 64 players
    pub initial_pot: u64,
    pub winner: Pubkey,
    // ORAO VRF fields
    pub vrf_request_pubkey: Pubkey,
    pub vrf_seed: [u8; 32],
    pub randomness_fulfilled: bool,
}

// PlayerEntry
pub struct PlayerEntry {
    pub wallet: Pubkey,
    pub total_bet: u64,
    pub timestamp: i64,
}

// GameStatus enum
pub enum GameStatus {
    Idle,                        // Waiting for first player
    Waiting,                     // Accepting bets
    AwaitingWinnerRandomness,   // Waiting for VRF
    Finished,                    // Game concluded
}
```

### **Schema Changes Needed**

#### **REMOVE from schema.ts** (Over-complex structures not in Anchor program)
- `games` table - Too complex, replace with simplified tracking
- `gameParticipants` table - Players are just entries in a Vec in Anchor
- `bets` table - No separate betting system in simplified MVP
- `gameHistory` table - Not needed for MVP
- `leaderboard` table - Not in MVP
- `botConfigs` table - Demo only, not in blockchain
- `vrfRequests` table - VRF handled directly in Anchor program
- `transactionQueue` table - Simplified in new architecture

#### **KEEP and MODIFY in schema.ts**
- `characters` table ✅ - Used for character selection
- `maps` table ✅ - Used for map selection  
- `players` table ✅ - Basic player profiles
- `gameStates` table ✅ - Simplified tracking of current game state
- `gameEvents` table ✅ - Event logging
- `systemHealth` table ✅ - System monitoring

#### **Simplified Schema Structure Needed**
```typescript
// Simplified schema matching Anchor program
export default defineSchema({
  // Core game assets
  characters: defineTable({...}), // ✅ Keep as-is
  maps: defineTable({...}), // ✅ Keep as-is
  
  // Player management
  players: defineTable({
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    gameCoins: v.number(), // For demo mode only
    totalGamesPlayed: v.number(),
    totalWins: v.number(),
    lastActive: v.number(),
  }),
  
  // Simplified game state tracking (mirrors Anchor GameRound)
  gameStates: defineTable({
    gameId: v.string(), // "round_{round_id}"
    status: v.string(), // "idle", "waiting", "awaitingWinnerRandomness", "finished"
    roundId: v.number(),
    startTimestamp: v.number(),
    playersCount: v.number(),
    initialPot: v.number(),
    winner: v.optional(v.string()), // Wallet address
    // Timing
    phaseStartTime: v.number(),
    waitingDuration: v.number(),
    lastChecked: v.number(),
    // VRF tracking
    vrfRequestPubkey: v.optional(v.string()),
    randomnessFulfilled: v.optional(v.boolean()),
  }),
  
  // Event logging for audit trail
  gameEvents: defineTable({...}), // ✅ Keep as-is
  
  // System health monitoring  
  systemHealth: defineTable({...}), // ✅ Keep as-is
});
```

---

## 🎮 **Phase 3: Frontend Integration**

### **Current Frontend State**
- `App.tsx`: Shows demo mode, needs real game integration
- `GameLobby.tsx`: Uses mock Convex queries, needs real data
- `CharacterSelection.tsx`: Places bets via Solana, needs game state integration
- `MultiParticipantPanel.tsx`: Commented out, needs real participant data

### **Frontend Integration Changes Needed**

#### **App.tsx** 
```typescript
// Current: Always in demo mode
const isDemoMode = !gameState || !gameState.gameState;

// Needs: Real game state detection
const gameState = useQuery(api.gameManagerDb.getGameState);
const isDemoMode = !gameState?.gameState || gameState.gameState.status === "idle";
```

#### **GameLobby.tsx**
```typescript
// Current: Uses mock player/game queries
const playerData = useQuery(api.players.getPlayerWithCharacter, ...);

// Needs: Real player data + game state
const playerData = useQuery(api.players.getPlayer, ...);
const gameState = useQuery(api.gameManagerDb.getGameState);
```

#### **CharacterSelection.tsx**
```typescript
// Current: Places Solana bets but no game state integration
await sendDepositBetTransaction({...});

// Needs: Check game state before allowing bets
const gameState = useQuery(api.gameManagerDb.getGameState);
const canPlaceBet = gameState?.gameState?.status === "waiting";
```

#### **MultiParticipantPanel.tsx**
```typescript
// Current: Completely commented out
return null;

// Needs: Real participant data from game state
const gameState = useQuery(api.gameManagerDb.getGameState);
const participants = gameState?.gameState ? 
  await getGameParticipantsFromSolana() : null;
```

---

## 📋 **Implementation Order**

### **Step 1: Convex Cleanup** (1-2 hours)
1. Delete legacy demo files from convex/
2. Clean up schema.ts to match Anchor program
3. Update imports in remaining files

### **Step 2: Schema Migration** ✅ **COMPLETE** (2-3 hours)  
1. ✅ Update gameManagerDb.ts to use simplified schema
2. ⏳ Test Convex deployment with new schema
3. ⏳ Verify cron job still works

### **Step 3: Frontend Integration** (3-4 hours)
1. Update GameLobby.tsx to use real game state
2. Enable MultiParticipantPanel.tsx with real data
3. Connect CharacterSelection.tsx to game state
4. Update App.tsx game state detection

### **Step 4: Testing & Polish** (2-3 hours)
1. Test full flow: idle → waiting → game → finished
2. Verify demo mode still works for idle state
3. Clean up console logs and error handling

---

## 🎯 **Key Integration Points**

### **Game State Flow**
1. **Idle**: Demo mode active, no real game
2. **Waiting**: Real game accepting players, show participants
3. **AwaitingWinnerRandomness**: Show VRF progress
4. **Finished**: Show winner, return to demo

### **Data Sources**
- **Demo Mode**: Mock data for entertainment
- **Real Game**: Solana program state via Convex crank
- **Players**: Always from Convex (for profiles/coins)
- **Characters/Maps**: Always from Convex

### **Critical Functions**
- `gameManagerDb.getGameState()` - Primary game state query
- `players.getPlayer()` - Player profile data
- `sendDepositBetTransaction()` - Places bet on Solana
- Convex crank handles all game progression automatically

---

## ✅ **Success Criteria**

After cleanup and integration:
1. ✅ No legacy demo files in Convex
2. ✅ Schema matches Anchor program structure  
3. ✅ Frontend shows real game participants when game is active
4. ✅ Demo mode still works when no game is running
5. ✅ Players can place bets that appear in real-time
6. ✅ Game progresses automatically via Convex crank
7. ✅ Winners are determined by Solana VRF and displayed

This plan transforms your project from a demo/mock system into a production-ready Solana-integrated game while preserving the demo experience for idle periods.