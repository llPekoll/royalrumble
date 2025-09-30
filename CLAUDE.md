# Domin8 - Solana Battle Game

## Project Overview
A fast-paced battle royale betting game on Solana where players control multiple characters in dynamic arenas. Built with Convex, React, Phaser.js, and Solana blockchain integration.

## Tech Stack
- **Runtime**: Bun (not npm)
- **Backend**: Convex (real-time serverless)
- **Frontend**: React + TypeScript + Vite
- **Game Engine**: Phaser.js (WebGL/Canvas)
- **Blockchain**: Solana (Anchor framework)
- **Wallet**: Privy (embedded wallets, seamless auth)
- **Styling**: Tailwind CSS
- **State**: Convex React hooks

## Commands
```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

# Run tests (if configured)
bun test

# Lint code (if configured)
bun run lint

# Type check (if configured)
bun run typecheck
```

## Project Structure
```
/
├── convex/           # Backend functions and schema
│   ├── games.ts      # Game loop logic
│   ├── players.ts    # Player actions
│   ├── solana.ts     # Blockchain integration
│   ├── schema.ts     # Database schema
│   └── crons.ts      # Scheduled functions
├── programs/
│   ├── domin8-vrf/   # Solana VRF program
│   │   └── programs/domin8_vrf/
│   │       ├── src/
│   │       │   ├── lib.rs           # Program entry
│   │       │   ├── state.rs         # Account structures
│   │       │   ├── errors.rs        # Error definitions
│   │       │   └── instructions/    # Instruction handlers
│   │       └── tests/               # TypeScript tests
│   └── domin8-game/  # Game bet escrow program
│       └── programs/domin8_game/
│           ├── src/
│           │   ├── lib.rs           # Program entry
│           │   ├── state.rs         # GamePool, Bet structs
│           │   ├── errors.rs        # Error definitions
│           │   └── instructions/    # place_bet, settle_game, refund
│           └── tests/               # TypeScript tests
├── src/
│   ├── game/         # Phaser game engine
│   │   ├── scenes/   # Game scenes
│   │   └── config.ts # Game configuration
│   └── components/   # React components
└── public/
    └── assets/       # Game assets (sprites, sounds)
```

## Key Features

### Game Mechanics

#### Global Game Flow
The platform runs **one global game instance** that all players join. There are two distinct modes:

##### Demo Mode (Client-Side Only)
- **Local Execution**: Runs entirely in user's browser (Phaser.js)
- **20 Bots**: Always long game format (top 4 betting)
- **Client-Generated**: Each user sees their own independent demo
- **Randomness**: Uses Math.random() locally, no blockchain/backend calls
- **Purpose**: Showcase gameplay, attract new players, zero cost
- **Infinite Scale**: Each client runs their own demo, no server load
- **Instant Start**: No waiting for server, loads immediately
- **Cycle**: Auto-restarts in browser forever until user bets

##### Real Game Mode (Server-Side)
Triggered when **first player places a bet**:
1. **Game Creation**: Convex creates game document, smart contract initializes GamePool
2. **Demo Stops**: Client-side demo stops in user's browser
3. **Countdown Starts**: 30-second waiting phase begins (server-managed)
4. **Other Players Join**: Additional players can bet during waiting phase
5. **Game Determined**: Final participant count determines game type
6. **Server Execution**: Convex manages all game logic, Phaser renders on all clients
7. **Settlement**: Smart contract distributes winnings
8. **Return to Demo**: All clients return to local client-side demo

#### Game Types by Participant Count
- **1 human player only** (regardless of participant count): Play against "Bank" bot (after countdown)
  - Bank balance check: Must have ≥ sum of all player's participants' bets
  - If insufficient: Auto-refund player, return to demo mode
  - If sufficient: Spawn Bank bot with matching total bet, 55% win chance (player 45%)
  - Player can have multiple participants, Bank checks total combined bet
- **2+ human players, 2-7 total participants**: Quick game (4 phases)
  - Waiting (30s) → Arena (dynamic*) → Results (5s)
  - **\*Dynamic Arena Phase**: Extends until blockchain call completes (3-8 seconds)
  - Single VRF transaction for winner determination
- **2+ human players, ≥ 8 total participants**: Long game with top 4 betting (7 phases)
  - Waiting (30s) → Arena (10s) → Elimination → Betting (15s) → Battle (15s) → Results (5s)
  - Two VRF transactions (top 4, then final winner)

#### Core Features
- **Client-Side Demo**: Each user runs their own demo locally, zero server cost
- **Single Global Real Game**: One server-managed game for all real players
- **Demo-to-Real Transition**: Client demo stops, server game starts on first bet
- **Multiple Characters per Player**: One player can control multiple game participants
- **Multiple Maps**: Various arenas with unique backgrounds and spawn configurations
- **Character System**: Players start with a random character that can be re-rolled
- **Bet-to-size**: Character size increases with bet amount
- **Phase Lock**: All game parameters locked after waiting phase ends
- **Server-side Execution**: No disconnection issues, game runs on server
- **Tie Resolution**: Random winner selection weighted by bet amounts
- **Demo Bot Count**: Always 20 bots in demo mode (client-generated)
- **Bank Opponent**: Solo players face Bank bot (55% bank win, 45% player win)
- **No Demo Backend**: Demo runs purely in browser, no database records

### Betting Rules
- **Self-Betting**: Players can ONLY bet on themselves during game entry (waiting phase)
- **Spectator Betting**: During top 4 phase, players bet on OTHER participants only
- **No Double Self-Betting**: Players cannot bet additional amounts on themselves in top 4
- **Reason**: Maintains game balance and encourages social interaction

### Economy System
- **Currency**: Native SOL (no conversion, direct betting)
- **Betting Limits**: Min 0.01 SOL, Max 10 SOL per bet (dynamic based on house balance)
- **Embedded Wallets**: Privy manages user wallets seamlessly
- **Smart Contract Escrow**: All bets locked in on-chain program (non-custodial)
- **Pool Distribution**: 95% to winners, 5% house edge
- **Self Bet Pool**: All initial entry bets, winners share 95% proportionally
- **Spectator Pool**: All top 4 bets, winners share 95% proportionally
- **Trustless**: Funds secured by smart contract, automatic payouts

### Technical Features
- **Real-time**: Convex subscriptions for live updates
- **Type-safe**: End-to-end TypeScript
- **Responsive**: Mobile and desktop support
- **Scalable**: Serverless architecture
- **Non-custodial**: Smart contract holds funds, not backend
- **Seamless Auth**: Privy embedded wallets (email/social login)
- **Signless UX**: Privy handles transaction signing smoothly

## Database Schema

### Core Tables
- `games`: Game state, phases, map selection, and blockchain call tracking
  - **ONLY real games**: Demo games not stored in database (client-side only)
  - `gamePda` (Pubkey string): References on-chain GamePool account
  - `blockchainCallStatus` ("none" | "pending" | "completed")
  - `blockchainCallStartTime`: Tracking blockchain call duration
  - **Global Game**: Only one active real game at a time
- `players`: Player data and Privy wallet info
  - `privyWalletAddress`: User's embedded wallet address
  - `privyUserId`: Privy user identifier
  - No balance stored (queried from Privy wallet directly)
- `characters`: Generic character definitions (Warrior, Mage, Archer, etc.)
- `gameParticipants`: Individual characters in a game (one player can have multiple)
  - **ONLY real game participants**: No demo bots stored in database
  - Includes "Bank" bot type for solo player games
  - Links to on-chain bet transaction signature
- `maps`: Arena configurations and backgrounds
- `bets`: Off-chain betting record cache (source of truth is on-chain)
  - `txSignature`: Transaction signature of place_bet instruction
  - `amount`: SOL amount (native, no conversion)
  - `onChainConfirmed`: Boolean for confirmation status
- `transactionQueue`: Solana transaction processing
- `bankBalance`: Tracks available funds for Bank bot matchmaking

## Animation Engine (Phaser.js)

### Key Animations
- **Client-Side Demo**: Full game loop runs locally in browser (20 bots, long game)
- **Demo Transition**: Client demo stops, switches to server-synced real game scene
- Character movement to center
- Character idle
- **Smart Explosion Effects**: Only explodes eliminated participants, winner stays in center
- Battle clash animations
- Victory celebrations
- Coin rain and confetti
- **Blockchain Randomness Dialog**: Shows during winner determination process
- **Demo Mode Indicator**: Visual badge showing "DEMO" or "LIVE" status

### Performance
- 60 FPS target
- WebGL with Canvas fallback
- Sprite pooling for efficiency
- Mobile optimization

## Convex Backend

### Scheduled Functions
- **Real game loop**: Every 3 seconds (phase management for active real games only)
- **Blockchain call processor**: Every 5 seconds (processes pending VRF winner determinations)
- **Bank balance tracker**: Every 30 seconds (monitors available funds for solo player matchmaking)
- **Transaction processing**: Every 30 seconds (Solana operations)
- **Transaction cleanup**: Every 1 hour (removes 7-day old transactions)
- **Game cleanup**: Every 6 hours (removes 3-day old completed games)

**Note**: No demo spawner cron needed - demos run client-side only

### Real-time Features
- Automatic UI updates
- No WebSocket configuration needed
- Optimistic updates with rollback

## Winner Selection System

### Blockchain VRF Integration (Verifiable Random Function)

#### Architecture Overview
- **Hybrid Approach**: Bets and VRF seeds on-chain, game logic off-chain
- **Bet Escrow**: Smart contract holds all player funds during game
- **VRF Seeds**: Random seeds stored on blockchain for verification
- **Game State**: Participant data and animations in Convex database
- **User Signing**: Players sign bet transactions via Privy (seamless UX)
- **Backend Settlement**: Server triggers payout after VRF winner determination

#### What Gets Stored On-chain

##### VRF Program State
```rust
// Global VRF State (singleton)
pub struct VrfState {
    pub authority: Pubkey,  // Backend wallet that can request VRF
    pub nonce: u64,        // Counter for additional entropy
}

// Per-game seed storage
pub struct GameSeed {
    pub game_id: String,       // Reference to Convex database (max 32 chars)
    pub round: u8,            // 1 for first round/quick games, 2 for final round
    pub random_seed: [u8; 32], // VRF output for winner selection
    pub timestamp: i64,        // When randomness was generated
    pub used: bool,           // Track if seed was consumed
}
```

##### Game Bet Escrow Program State
```rust
// Game pool holding all bets for a specific game
pub struct GamePool {
    pub game_id: String,           // Reference to Convex game (max 32 chars)
    pub total_pool: u64,          // Total lamports in pool
    pub house_wallet: Pubkey,     // House wallet for 5% fee
    pub status: GameStatus,       // Waiting, Playing, Completed, Refunded
    pub vrf_seed_account: Pubkey, // Link to VRF GameSeed account
    pub winner: Option<Pubkey>,   // Winner's wallet (set during settlement)
    pub bump: u8,                 // PDA bump seed
}

pub enum GameStatus {
    Waiting,    // Accepting bets
    Playing,    // Game in progress, no more bets
    Completed,  // Winner determined, payouts done
    Refunded,   // Game cancelled, all bets returned
}

// Individual bet record (stored in GamePool.bets vector)
pub struct Bet {
    pub player: Pubkey,           // Player's Privy wallet
    pub amount: u64,              // Lamports bet
    pub participant_id: String,   // Reference to Convex gameParticipant
    pub timestamp: i64,           // When bet was placed
}
```

#### VRF Transaction Strategy

##### Demo Games (No Real Players)
- **No VRF**: Uses Math.random() for simulated randomness
- **Cost**: Free (no blockchain transactions)
- **Purpose**: Entertainment and player attraction only

##### Quick Games (2-7 total participants)
- **Applies to**: 2+ players OR 1 player vs Bank bot
- **Single VRF Transaction**: One seed determines the winner
- **Timing**: Requested after waiting phase ends
- **Cost**: ~0.0001 SOL per game

##### Long Games (≥ 8 total participants)
- **Requires**: 2+ human players
- **Two VRF Transactions**: Separate seeds for each elimination round
- **First VRF**: After arena phase - determines top 4
- **Second VRF**: After betting phase closes - determines final winner
- **Security**: Second seed doesn't exist during betting, preventing prediction
- **Cost**: ~0.0002 SOL per game (two transactions)

#### Why Two Transactions for Long Games?
If we used a single seed and derived both results, players could:
1. See the seed when top 4 is announced
2. Calculate the final winner before betting
3. Only bet on the guaranteed winner
4. Break the game economy

Two separate VRF requests ensure true unpredictability.

#### VRF Flow
1. **Backend Request**: Automatically requests VRF at appropriate phase
2. **Blockchain Processing**: Solana generates verifiable random seed (1-3 seconds)
3. **Seed Storage**: Random seed stored on-chain with gameId + round reference
4. **Local Winner Calculation**: Backend uses seed + database data to determine winners
5. **Verification**: Anyone can verify seeds exist on blockchain for fairness proof

#### VRF Program Instructions
1. **initialize**: One-time setup to create VrfState with authority
2. **request_vrf(game_id, round)**: Generate and store random seed for a game/round
3. **mark_seed_used**: Optional tracking to prevent seed reuse

#### Randomness Generation
- Multiple entropy sources: game_id, round, timestamp, slot, nonce, recent blockhashes
- Uses Keccak hash for final seed generation
- Practically impossible to predict or manipulate

#### Implementation Status
- **Current**: Simulated blockchain calls (3-8 second delay)
- **Completed**: Real Solana VRF program with modular structure
  - Located in: `programs/domin8-vrf/`
  - Program ID: `96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF`
  - Structure: Separate files for state, instructions, and errors
  - Tests: Comprehensive test suite in TypeScript
- **Next Steps**: Deploy to devnet and integrate with Convex backend

### Smart Contract Bet Escrow System

#### Game Bet Escrow Program Instructions

##### 1. initialize_game_pool
```rust
// Creates new GamePool PDA for a game
// Authority: Backend wallet
pub fn initialize_game_pool(
    ctx: Context<InitializeGamePool>,
    game_id: String,
) -> Result<()>
```
**Purpose**: Create escrow account when real game starts
**Triggers**: First player clicks "Bet" (demo → real transition)

##### 2. place_bet
```rust
// Player locks SOL into GamePool
// Authority: Player's Privy wallet
pub fn place_bet(
    ctx: Context<PlaceBet>,
    amount: u64,
    participant_id: String,
) -> Result<()>
```
**Purpose**: User places bet, SOL transferred to GamePool PDA
**Timing**: During waiting phase (30 seconds)
**UX**: Privy signs transaction seamlessly (1-2 second confirmation)

##### 3. lock_game
```rust
// Prevents new bets, transitions to Playing status
// Authority: Backend wallet
pub fn lock_game(
    ctx: Context<LockGame>,
) -> Result<()>
```
**Purpose**: Close betting when waiting phase ends
**Timing**: After 30-second countdown

##### 4. settle_game
```rust
// Pays out winner, sends 5% to house
// Authority: Backend wallet
pub fn settle_game(
    ctx: Context<SettleGame>,
    winner_pubkey: Pubkey,
    vrf_seed_account: Pubkey,
) -> Result<()>
```
**Purpose**: Distribute winnings based on VRF-determined winner
**Flow**:
1. Verify VRF seed exists on-chain for this game
2. Calculate payouts (95% to winner, 5% to house)
3. Transfer SOL from GamePool PDA to winner's Privy wallet
4. Mark GamePool as Completed

##### 5. refund_game
```rust
// Returns all bets to players
// Authority: Backend wallet
pub fn refund_game(
    ctx: Context<RefundGame>,
) -> Result<()>
```
**Purpose**: Cancel game and refund all players
**Triggers**:
- Solo player, insufficient bank balance
- VRF timeout/failure
- Technical error during game

#### Bet Escrow Flow

```
┌──────────────────────────────────────────────────┐
│ DEMO MODE                                         │
│ - No smart contract interaction                  │
│ - Pure Convex database + animations              │
└──────────────────────────────────────────────────┘
                      ↓
          First player clicks "Bet"
                      ↓
┌──────────────────────────────────────────────────┐
│ INITIALIZE GAME POOL                             │
│ - Backend calls initialize_game_pool(game_id)    │
│ - Creates GamePool PDA on-chain                  │
│ - Status: Waiting                                │
└──────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────┐
│ PLACE BETS (30 second window)                    │
│ - User: Bet 0.5 SOL via Privy                    │
│ - Privy signs place_bet() transaction            │
│ - SOL locked in GamePool PDA                     │
│ - Convex caches bet record                       │
│ - More players can join                          │
└──────────────────────────────────────────────────┘
                      ↓
          Countdown ends
                      ↓
┌──────────────────────────────────────────────────┐
│ LOCK GAME                                        │
│ - Backend calls lock_game()                      │
│ - Status: Waiting → Playing                     │
│ - No more bets accepted                          │
└──────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────┐
│ GAME PLAYS (off-chain)                           │
│ - Convex runs game logic                         │
│ - Phaser renders animations                      │
│ - VRF determines winner                          │
└──────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────┐
│ SETTLE GAME                                      │
│ - Backend calls settle_game(winner, vrf_seed)    │
│ - Contract verifies VRF seed on-chain            │
│ - 95% → Winner's Privy wallet                    │
│ - 5% → House wallet                              │
│ - Status: Playing → Completed                   │
└──────────────────────────────────────────────────┘
                      ↓
          Return to demo mode
```

#### Security Features

**Non-Custodial:**
- Funds held by smart contract PDA, not backend
- Backend cannot steal funds (only trigger settlement)
- Settlement requires valid VRF seed verification

**Transparency:**
- All bets visible on-chain via GamePool account
- VRF seeds publicly verifiable
- Anyone can audit game results

**Trustless:**
- Winner determined by blockchain VRF, not backend
- Smart contract enforces payout rules
- Cannot change rules mid-game

#### Privy Integration

```typescript
// Frontend: User places bet
import { usePrivy } from '@privy-io/react-auth';

async function placeBet(amount: number) {
  const { wallet } = usePrivy();

  // Privy handles signing smoothly
  const tx = await program.methods
    .placeBet(
      new BN(amount * LAMPORTS_PER_SOL),
      participantId
    )
    .accounts({
      gamePool: gamePda,
      player: wallet.address,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  // User sees: "Bet placed! ✓" (1-2 seconds)
  return tx;
}
```

**User Experience:**
1. User clicks "Bet 0.5 SOL"
2. Privy shows simple confirmation dialog
3. Transaction signs automatically (embedded wallet)
4. 1-2 second wait for confirmation
5. "Bet confirmed! ✓" notification
6. No complex wallet setup required

## Game Flow by Type

### Demo Mode Flow (Client-Side)
- **Client-Side Only**: Runs entirely in user's browser via Phaser.js
- **20 Bots**: Always long game format (locally generated)
- **Math.random()**: Client-side winner selection, no backend/blockchain
- **Continuous**: Auto-restarts in browser forever
- **Zero Cost**: No server resources, infinite scalability
- **Instant Load**: No waiting for server, loads with page
- **Transition**: User bet stops local demo, creates server game

### Player Game Initiation (Server-Side)
1. **First Player Bets**: Triggers createRealGame() mutation in Convex
2. **Client Demo Stops**: Local demo stops in user's browser
3. **Server Game Created**: Convex creates game document, smart contract initializes GamePool
4. **30s Countdown**: Server-managed waiting phase begins
5. **Join Window**: Other players can bet during countdown
6. **Type Determined**: Final count determines game format
7. **Scene Switch**: All clients switch from local demo to server-synced real game scene

### Solo Player vs Bank
- **After Countdown**: Check if only 1 human player present (regardless of their participant count)
- **Bank Balance Check**: Verify bank has ≥ sum of all player's participants' bets combined
- **If Insufficient**: Refund all player bets, return to demo mode
- **If Sufficient**: Spawn Bank bot (matching total bet amount, 55% win chance)
- **Game Proceeds**: Uses VRF for fairness, treated as quick game format

### Quick Games (2-7 total participants)
- **Applies to**: 2+ human players with 2-7 total participants, OR 1 player vs Bank bot
- **VRF Requests**: 1 transaction
- **Dynamic Phase Timing**: Arena phase extends until VRF completes
- **Flow**:
  1. Players move to center (2.5 seconds)
  2. Backend automatically triggers VRF request (round 1)
  3. Blockchain randomness dialog shows progress
  4. VRF seed received from blockchain
  5. Winner calculated using seed + bet weights
  6. Only eliminated participants explode
  7. Winner remains in center for victory

### Long Games (≥ 8 total participants)
- **Requires**: 2+ human players with ≥8 total participants
- **VRF Requests**: 2 transactions
- **Fixed Timing**: Standard phase durations
- **First VRF (Round 1)**:
  - Triggered after arena phase
  - Determines top 4 participants
  - Seed visible but can't predict final winner
- **Betting Phase**: Players bet on top 4 participants
- **Second VRF (Round 2)**:
  - Triggered after betting closes
  - Determines final winner from top 4
  - Completely unpredictable until requested
- **Elimination**: Progressive (many → top 4 → final winner)

### Return to Demo
After any real game completes:
1. Distribute winnings via smart contract
2. Show results (5 seconds)
3. Clean up server game state
4. **Clients return to local demo**: Each browser restarts its own client-side demo
5. Cycle continues (demo runs locally until next bet)

### Backend Implementation
```typescript
// NO demo mode management needed - client-side only!
// ❌ No ensureDemoGameExists()
// ❌ No spawnDemoBots()
// ❌ No demo cron

// Real game management only
// Smart contract integration
initializeGamePool(gameId)   // Create GamePool PDA on-chain
lockGamePool(gamePda)       // Close betting after countdown
settleGame(winner, vrfSeed) // Payout winner via smart contract
refundGame(gamePda)         // Cancel and refund all bets

// Bank opponent system
checkBankBalance()          // Verify funds for solo player
spawnBankBot()             // Create Bank participant (55% win)

// VRF integration
requestVRF(gameId, round)     // Request random seed from blockchain
checkVRFResult(gameId, round) // Poll for VRF seed completion
determineWinnerWithSeed()     // Calculate winner using VRF seed

// Game mode transitions
async function handleFirstPlayerBet(playerId: string, amount: number) {
  const currentGame = await getActiveGame();

  if (currentGame.gameMode === "demo") {
    await evacuateBots(currentGame.id);

    // Initialize smart contract game pool
    const gamePda = await initializeGamePool(currentGame.id);

    // Create real game in database
    await createRealGame(playerId, amount, gamePda);

    // User places bet via Privy (place_bet instruction)
    await userPlaceBet(playerId, amount, gamePda);

    startCountdown(30); // Waiting phase
  } else {
    // User joins existing game pool
    await userPlaceBet(playerId, amount, currentGame.gamePda);
  }
}

// Solo player vs bank
async function handleSoloPlayer(gameId: string, player: Player) {
  const bankBalance = await getBankBalance();

  if (bankBalance >= player.totalBet) {
    await spawnBankBot(gameId, player.totalBet, 0.55);
    await startQuickGame(gameId);
  } else {
    // Refund via smart contract
    await refundGame(game.gamePda);
    await createDemoGame(); // Return to demo
  }
}
```

### Frontend Integration
```typescript
// Key files
src/components/DemoModeIndicator.tsx          // "DEMO" badge/overlay
src/components/BlockchainRandomnessDialog.tsx  // Progress indicator during VRF
src/components/BetButton.tsx                  // Privy-powered betting interface
src/game/managers/GamePhaseManager.ts          // Phase management
src/game/managers/BotEvacuationManager.ts      // Bot runaway animations
src/game/managers/AnimationManager.ts          // Smart explosions
src/hooks/usePrivyWallet.ts                   // Privy wallet integration
src/hooks/useBetEscrow.ts                     // Smart contract interactions
src/App.tsx                                   // Event coordination

// UI States
"demo" → Shows "DEMO" badge, "Join Game" button enabled
"waiting" → Shows countdown, "Join Game" active, bet confirmation (1-2s)
"playing" → Game in progress, spectator mode for non-participants
"settling" → Winner announced, smart contract payout in progress
```

### Cost Analysis (Per Game)

#### Demo Games
- **Total Cost**: $0 (free)
- **Breakdown**: No blockchain transactions, pure off-chain

#### Real Games with Smart Contract Escrow

##### Solo vs Bank (2 participants total)
- Initialize GamePool: ~0.000005 SOL
- Player bet: ~0.000005 SOL (user pays)
- Lock game: ~0.000005 SOL
- VRF request: ~0.0001 SOL
- Settle game: ~0.000005 SOL
- **Backend Cost**: ~0.000115 SOL (~$0.025)
- **User Cost**: ~0.000005 SOL (transaction fee only)

##### Quick Game (2-7 participants)
- Initialize GamePool: ~0.000005 SOL
- Bet transactions: ~0.000005 SOL × players (users pay)
- Lock game: ~0.000005 SOL
- VRF request: ~0.0001 SOL
- Settle game: ~0.000005 SOL
- **Backend Cost**: ~0.000115 SOL (~$0.025)
- **User Cost per player**: ~0.000005 SOL (~$0.001)

##### Long Game (≥8 participants)
- Initialize GamePool: ~0.000005 SOL
- Bet transactions: ~0.000005 SOL × players (users pay)
- Lock game: ~0.000005 SOL
- First VRF (top 4): ~0.0001 SOL
- Second VRF (winner): ~0.0001 SOL
- Settle game: ~0.000005 SOL
- **Backend Cost**: ~0.000215 SOL (~$0.045)
- **User Cost per player**: ~0.000005 SOL (~$0.001)

#### Economic Model
- **House Edge**: 5% of pool covers blockchain costs + profit
- **Example**: 10 SOL pool = 0.5 SOL house fee (~$105)
- **Backend Cost**: ~$0.025-0.045 per game
- **Net Profit**: $104+ per game
- **Scalability**: Costs stay flat, revenue scales with pool size

#### Setup Costs
- **Smart Contract Audit**: $10-50k (one-time, recommended for production)
- **Alternative**: Switchboard VRF (~0.002 SOL/game, $30k savings on audit)
- **Break-even**: ~100-500 games depending on audit cost

### Verification & Fairness

#### Demo Games
- **Randomness**: Math.random() (simulated, not verifiable)
- **Purpose**: Entertainment and player attraction only
- **Trust**: Not required (no real money)

#### Real Games
**Non-Custodial:**
- All bets locked in smart contract (GamePool PDA)
- Backend cannot access funds
- Settlement requires valid VRF seed verification
- Automatic payouts enforced by contract

**Transparent:**
- All bets publicly visible on-chain
- GamePool account queryable by anyone
- Transaction history permanent on Solana

**Verifiable Randomness:**
- VRF seeds stored on-chain (GameSeed accounts)
- Anyone can verify seeds exist for each game
- Reproducible: Same seed + participants = same winner
- Multiple entropy sources (slot, blockhash, nonce, timestamp)

**Audit Trail:**
- Every game has on-chain GamePool account
- Every winner has corresponding VRF seed
- Complete transaction history accessible
- Round separation for long games (independent seeds)

### Error Handling

#### Smart Contract Errors
- **Insufficient Balance**: User shown clear error before transaction
- **Bet After Lock**: Smart contract rejects with error
- **Double Bet**: GamePool tracks bets, prevents duplicates
- **Invalid Settlement**: Requires valid VRF seed account, reverts otherwise

#### VRF Errors
- **Timeout**: Retry once after 5 seconds
- **Second Failure**: Backend calls refund_game(), all bets returned
- **Network Issues**: Queue VRF requests for retry
- **Typical Duration**: 1-3 seconds per VRF request

#### Privy Wallet Errors
- **User Cancels**: Transaction not sent, game continues for others
- **Insufficient SOL**: Privy shows balance error before signing
- **Network Congestion**: Automatic retry with higher priority fees

#### Refund Scenarios
All trigger refund_game() smart contract instruction:
1. Solo player with insufficient bank balance
2. VRF fails twice
3. Game initialization error
4. No players after waiting phase (should never happen, demo catches this)

## Development Workflow

### Getting Started
1. Clone repository
2. Run `bun install` to install dependencies
3. Set up Convex: `npx convex dev`
4. Configure Solana RPC in `.env`
5. Run `bun run dev` to start

### Environment Variables
```env
# Convex Backend
CONVEX_DEPLOYMENT=

# Solana
SOLANA_RPC_URL=
VITE_SOLANA_NETWORK=devnet           # Client-side (Vite exposes VITE_*)
GAME_PROGRAM_ID=                     # domin8-game smart contract
VRF_PROGRAM_ID=96ZRCG9KRB7Js6AENkVpTtwNUXqaxF8ZAAWrmxa8U2QF
BACKEND_WALLET_SECRET=               # For VRF requests and settlements

# Privy
VITE_PRIVY_APP_ID=                   # Client-side (exposed to browser)
PRIVY_APP_SECRET=                    # Backend-only (Convex uses this)

# Note: Vite only exposes variables prefixed with VITE_ to the browser
# All other variables are only accessible server-side in Convex
```

### Testing Approach
- Check for test scripts in package.json
- Use Convex dashboard for backend testing
- Test Solana integration on devnet first

## Important Notes

### Database Management
- **Data Retention**: Real game history kept for 3 days, then automatically deleted
- **Demo Games**: NOT stored in database - run entirely client-side in browsers
- **Transaction History**: Solana transactions kept for 7 days
- **Player Data**: Privy wallet addresses and stats are permanent
- **No Balance Storage**: Balances queried directly from Privy wallets
- **Bank Balance**: Persistent tracking for solo player matchmaking
- **Global Game State**: Only one active REAL game document at any time
- **On-Chain Data**: GamePool and VRF seed accounts remain on Solana permanently
- **No Demo Records**: Zero database/server load for demos

### Bun-Specific
- Use `bun` instead of `npm` for all commands
- Bun has built-in TypeScript support
- Faster installation and execution than npm
- Compatible with npm packages

### Security
- Never commit secrets or private keys
- Use environment variables for sensitive data
- Validate all user inputs
- Server-side game state management

### Best Practices
- Follow existing code conventions
- Use Convex mutations for state changes
- Implement proper error handling
- Optimize assets for web delivery

## Phase Implementation Priority

### MVP (Phase 1) - Core Game
- ✅ VRF program (completed)
- 🔨 Game bet escrow smart contract
- 🔨 Privy integration (auth + embedded wallets)
- 🔨 Demo mode (20 bots, long game)
- 🔨 Basic game loop (Convex + Phaser)
- 🔨 Simple character sprites
- 🔨 Single global game architecture

### Phase 2 - Polish & Features
- Smart contract audit
- Advanced animations (bot evacuation, explosions)
- Character re-roll feature
- Multiple maps
- Leaderboards
- Mobile optimization

### Phase 3 - Scale
- Deploy to mainnet
- Marketing push
- Tournament modes
- Referral system
- Premium character skins

### Phase 4 - Expansion
- Multiple concurrent games (regional?)
- Cross-chain support
- Mobile native apps
- Social features (teams, clans)

## Common Tasks

### Adding a New Character
1. Add sprite to `/public/assets/characters/` directory
2. Insert character record in `characters` table with animations
3. Update character selection logic
4. Add animation configurations (idle, walk, attack)

### Adding a New Map
1. Add background asset to `/public/assets/maps/`
2. Insert map record in `maps` table
3. Configure spawn positions and player limits
4. Test spawn distribution for different player counts

### Modifying Game Phases
1. Update phase durations in `convex/games.ts`
2. Adjust animations in Phaser scenes
3. Update UI components for phase display

### Implementing New Bet Types
1. Add bet type to schema
2. Create mutation in `convex/players.ts`
3. Update payout calculation logic
4. Add UI controls for new bet type

## Debugging Tips
- Use Convex dashboard for real-time data inspection
- Check browser console for Phaser errors
- Monitor WebSocket connections in Network tab
- Use `bun run dev --debug` for verbose logging

## Resources
- [Convex Docs](https://docs.convex.dev/)
- [Phaser.js Docs](https://phaser.io/docs)
- [Solana Cookbook](https://solanacookbook.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Privy Docs](https://docs.privy.io/)
- [Bun Documentation](https://bun.sh/docs)

---

## Architecture Summary

### The Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER EXPERIENCE                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Login with email/social (Privy)                          │
│ 2. Watch demo game (20 bots, entertaining)                  │
│ 3. Click "Bet 0.5 SOL" → Privy signs seamlessly            │
│ 4. Wait 30s for other players                               │
│ 5. Watch game play (Phaser animations)                      │
│ 6. Winner announced → SOL arrives in wallet                 │
│ 7. Return to demo mode                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  TECHNOLOGY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│ Frontend (React + Vite + Phaser)                            │
│   - Privy for auth + embedded wallets                       │
│   - Real-time game state via Convex hooks                   │
│   - 60fps animations on canvas                              │
├─────────────────────────────────────────────────────────────┤
│ Backend (Convex Serverless)                                 │
│   - Game loop (3s intervals)                                │
│   - Phase management (demo ↔ real)                          │
│   - Bot spawning/evacuation                                 │
│   - Coordinates blockchain calls                            │
├─────────────────────────────────────────────────────────────┤
│ Blockchain (Solana)                                         │
│   - domin8-game: Bet escrow (GamePool PDAs)                 │
│   - domin8-vrf: Verifiable randomness (GameSeed)            │
│   - All bets locked in smart contracts                      │
│   - Non-custodial, trustless, transparent                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**1. Hybrid On/Off-Chain**
- ✅ Bets: On-chain (trustless escrow)
- ✅ VRF: On-chain (verifiable randomness)
- ✅ Game Logic: Off-chain (fast, flexible)
- ✅ Animations: Off-chain (smooth, no blockchain lag)

**2. Single Global Game**
- One game instance for entire platform
- Creates urgency and social dynamics
- Simpler architecture than parallel games
- Demo always running when no real players

**3. Direct SOL (No Coins)**
- Users bet real SOL, not internal currency
- Clearer value proposition
- Less code complexity
- No conversion confusion

**4. Privy for Wallets**
- Email/social login (no crypto knowledge required)
- Embedded wallets (seamless transaction signing)
- Users control keys (can export)
- 1-2 second bet confirmations

**5. Smart Contract Escrow**
- Non-custodial (backend can't steal)
- Transparent (all bets on-chain)
- Verifiable (VRF seeds public)
- Marketing advantage (provably fair)

### Why This Works

**For Users:**
- Easy onboarding (email login)
- Fast gameplay (off-chain logic)
- Trustworthy (blockchain escrow)
- Real value (SOL payouts)

**For Operators:**
- Scalable (Convex serverless)
- Profitable (5% house edge >> $0.03 costs)
- Legal (non-custodial positioning)
- Maintainable (TypeScript + Rust)

**For Developers:**
- Modern stack (Bun, React, Convex)
- Type-safe (end-to-end TypeScript)
- Testable (local Convex, devnet Solana)
- Documented (this file!)

### Success Metrics

**MVP Success:**
- Demo mode running smoothly
- Players can bet via Privy
- Smart contract holds funds securely
- VRF determines winners fairly
- Payouts automatic

**Production Success:**
- 100+ games/day
- <1% refund rate
- <2s average bet confirmation
- 0 security incidents
- Positive unit economics

### Next Steps

1. **Build Game Escrow Contract** (`programs/domin8-game/`)
2. **Integrate Privy** (auth + wallet hooks)
3. **Connect Smart Contracts** (Convex ↔ Solana)
4. **Test on Devnet** (end-to-end flow)
5. **Audit Contracts** (security review)
6. **Deploy to Mainnet** (go live!)

**Welcome to Domin8 - where skill meets luck on Solana! 🎮⚔️**
