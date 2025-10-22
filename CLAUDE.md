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

### Frontend/Backend

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

```

### Smart Contract (Anchor)

```bash
# Build the smart contract
anchor build

# Run tests (starts local validator, deploys, runs tests)
anchor test

# Deploy to devnet (requires SOL in wallet)
anchor deploy --provider.cluster devnet

# Deploy to localnet (for testing)
anchor deploy
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
│   └── domin8-game/  # Game bet escrow program (Anchor workspace)
│       ├── Anchor.toml              # Anchor configuration
│       ├── programs/domin8_game/
│       │   ├── src/
│       │   │   ├── lib.rs           # Program entry (11 instructions)
│       │   │   ├── state.rs         # Game & Authority PDAs
│       │   │   ├── errors.rs        # 26 error codes
│       │   │   └── instructions/    # 11 instruction modules
│       │   └── Cargo.toml
│       └── tests/
│           └── domin8-game.ts       # Comprehensive test suite
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
- **Instant Start**: No waiting for server, loads immediately

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
  - Waiting (30s) → Arena (dynamic\*) → Results (5s)
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
// Single reusable Game PDA - holds all game state
// Cost optimized: ~0.004 SOL one-time vs 0.00089 SOL per bet (97% savings)
pub struct Game {
    // Game metadata
    pub game_id: u64,              // Increments each game
    pub status: GameStatus,         // EntryPhase → SpectatorPhase → Settled
    pub game_mode: GameMode,        // Unknown → Short/Long

    // Escrow pools
    pub entry_pool: u64,            // Phase 1 total bets
    pub spectator_pool: u64,        // Phase 2 total bets

    // Entry phase bets (arrays, max 64 bets)
    pub entry_bets: [u64; 64],           // Bet amounts
    pub entry_players: [Pubkey; 64],     // Player wallets
    pub entry_bet_count: u8,             // Number of bets placed

    // Spectator phase bets (arrays, max 64 bets)
    pub spectator_bets: [u64; 64],       // Bet amounts
    pub spectator_players: [Pubkey; 64], // Player wallets
    pub spectator_targets: [i8; 64],     // Which top_four they bet on (0-3)
    pub spectator_bet_count: u8,         // Number of bets placed

    // Winners
    pub top_four: [i8; 4],          // Entry bet positions (long games only)
    pub winner: i8,                 // Winning entry bet position

    // Timing
    pub entry_phase_start: i64,          // Unix timestamp
    pub entry_phase_duration: i64,       // 45 seconds
    pub spectator_phase_start: i64,      // Unix timestamp
    pub spectator_phase_duration: i64,   // 45 seconds

    // Settlement tracking
    pub house_collected: bool,           // House fees claimed
    pub entry_winnings_claimed: bool,    // Winner claimed entry pool
    pub entry_refunded: [bool; 64],      // Per-bet refund tracking
    pub spectator_refunded: [bool; 64],  // Per-bet refund tracking

    // Safety features
    pub last_game_end: i64,         // Time lock (5 seconds between games)
    pub vrf_seed_top_four: Option<Pubkey>,  // VRF for top 4 selection
    pub vrf_seed_winner: Option<Pubkey>,    // VRF for final winner
    pub house_wallet: Pubkey,       // House fee destination
    pub bump: u8,                   // PDA bump
}

pub enum GameStatus {
    EntryPhase,        // Accepting entry bets
    SelectingTopFour,  // Backend selecting top 4 (long games)
    SpectatorPhase,    // Accepting spectator bets (long games)
    SelectingWinner,   // Backend selecting winner
    Settled,           // Payouts available
    Cancelled,         // Game cancelled, refunds available
}

pub enum GameMode {
    Unknown,  // Not yet determined
    Short,    // 2-7 participants (one winner selection)
    Long,     // ≥8 participants (top 4 + spectator betting)
}

// Authority PDA - controls backend access
pub struct Authority {
    pub admin: Pubkey,    // Can emergency withdraw, update backend
    pub backend: Pubkey,  // Can set winners, collect fees
    pub bump: u8,
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

**Short Game (2-7 participants):**

```
Demo Mode → Player Bets → initialize_game →
Entry Bets (place_entry_bet) → set_winner →
claim_entry_winnings + collect_house_fees →
Return to Demo
```

**Long Game (≥8 participants):**

```
Demo Mode → Player Bets → initialize_game →
Entry Bets (place_entry_bet) → set_top_four →
Spectator Bets (place_spectator_bet) → set_winner →
claim_entry_winnings + claim_spectator_winnings + collect_house_fees →
Return to Demo
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
import { usePrivy } from "@privy-io/react-auth";

async function placeBet(amount: number) {
  const { wallet } = usePrivy();

  // Privy handles signing smoothly
  const tx = await program.methods
    .placeBet(new BN(amount * LAMPORTS_PER_SOL), participantId)
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

#### Refund Scenarios

All trigger refund_game() smart contract instruction:

1. Solo player with insufficient bank balance
2. VRF fails twice
3. Game initialization error
4. No players after waiting phase (should never happen, demo catches this)

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

### Security

- Never commit secrets or private keys
- Use environment variables for sensitive data
- Validate all user inputs
- Server-side game state management

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
