# Domin8 - Solana Battle Game

## Project Overview
A fast-paced battle royale betting game on Solana where players control multiple characters in dynamic arenas. Built with Convex, React, Phaser.js, and Solana blockchain integration.

## Tech Stack
- **Runtime**: Bun (not npm)
- **Backend**: Convex (real-time serverless)
- **Frontend**: React + TypeScript + Vite
- **Game Engine**: Phaser.js (WebGL/Canvas)
- **Blockchain**: Solana (Anchor framework)
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
│   └── domin8-vrf/   # Solana VRF program
│       └── programs/domin8_vrf/
│           ├── src/
│           │   ├── lib.rs           # Program entry
│           │   ├── state.rs         # Account structures
│           │   ├── errors.rs        # Error definitions
│           │   └── instructions/    # Instruction handlers
│           └── tests/               # TypeScript tests
├── src/
│   ├── game/         # Phaser game engine
│   │   ├── scenes/   # Game scenes
│   │   └── config.ts # Game configuration
│   ├── components/   # React components
│   └── app/          # Next.js pages
└── public/
    └── assets/       # Game assets (sprites, sounds)
```

## Key Features

### Game Mechanics

#### Game Modes by Player Count
- **0 players**: Demo mode with up to 20 bots (random bets 0-1 SOL)
- **1 player (any participants)**: Play against bank with 45% player win chance
  - If bank balance < minimum (1 SOL): Auto-refund player
  - Player can have multiple participants
- **2+ players, < 8 participants**: Short game (4 phases)
  - Waiting (30s) → Arena (dynamic*) → Results (5s)
  - **\*Dynamic Arena Phase**: Extends until blockchain call completes (3-8 seconds)
- **2+ players, ≥ 8 participants**: Long game with top 4 betting (7 phases)
  - Waiting (30s) → Arena (10s) → Elimination → Betting (15s) → Battle (15s) → Results (5s)

#### Core Features
- **Multiple Characters per Player**: One player can control multiple game participants
- **Multiple Maps**: Various arenas with unique backgrounds and spawn configurations
- **Character System**: Players start with a random character that can be re-rolled
- **Bet-to-size**: Character size increases with bet amount
- **Phase Lock**: All game parameters locked after waiting phase ends
- **Server-side Execution**: No disconnection issues, game runs on server
- **Tie Resolution**: Random winner selection weighted by bet amounts
- **Bot Limits**: Maximum 20 bots per game
- **Bot Betting**: Random between 0-1 SOL, or matches player range if present

### Betting Rules
- **Self-Betting**: Players can ONLY bet on themselves during game entry (waiting phase)
- **Spectator Betting**: During top 4 phase, players bet on OTHER participants only
- **No Double Self-Betting**: Players cannot bet additional amounts on themselves in top 4
- **Reason**: Maintains game balance and encourages social interaction

### Economy System
- **Game Coins**: Internal currency (1 SOL = 1000 coins)
- **Betting Limits**: Min 10, Max 10,000 coins per bet
- **Pool Distribution**: 95% to winners, 5% house edge
- **Self Bet Pool**: All initial entry bets, winners share 95% proportionally
- **Spectator Pool**: All top 4 bets, winners share 95% proportionally

### Technical Features
- **Real-time**: Convex subscriptions for live updates
- **Type-safe**: End-to-end TypeScript
- **Responsive**: Mobile and desktop support
- **Scalable**: Serverless architecture

## Database Schema

### Core Tables
- `games`: Game state, phases, map selection, and blockchain call tracking
  - Added: `blockchainCallStatus` ("none" | "pending" | "completed")
  - Added: `blockchainCallStartTime` for tracking blockchain call duration
- `players`: Player data and balances
- `characters`: Generic character definitions (Warrior, Mage, Archer, etc.)
- `gameParticipants`: Individual characters in a game (one player can have multiple)
- `maps`: Arena configurations and backgrounds
- `bets`: Betting records
- `transactionQueue`: Solana transaction processing

## Animation Engine (Phaser.js)

### Key Animations
- Character movement to center
- Character idle
- **Smart Explosion Effects**: Only explodes eliminated participants, winner stays in center
- Battle clash animations
- Victory celebrations
- Coin rain and confetti
- **Blockchain Randomness Dialog**: Shows during winner determination process

### Performance
- 60 FPS target
- WebGL with Canvas fallback
- Sprite pooling for efficiency
- Mobile optimization

## Convex Backend

### Scheduled Functions
- Game loop: Every 3 seconds (game phase management)
- Blockchain call processor: Every 5 seconds (processes pending blockchain winner determinations)
- Transaction processing: Every 30 seconds (Solana operations)
- Transaction cleanup: Every 1 hour (removes 7-day old transactions)
- Game cleanup: Every 6 hours (removes 3-day old completed games)

### Real-time Features
- Automatic UI updates
- No WebSocket configuration needed
- Optimistic updates with rollback

## Winner Selection System

### Blockchain VRF Integration (Verifiable Random Function)

#### Architecture Overview
- **Minimal On-chain**: Only random seeds stored on blockchain
- **Game Data**: All participant data, bets, and game state remain in Convex database
- **Backend-controlled**: Server wallet handles all blockchain interactions automatically
- **No User Interaction**: Players don't need wallets or to sign transactions

#### What Gets Stored On-chain
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

#### VRF Transaction Strategy

##### Quick Games (< 8 participants)
- **Single VRF Transaction**: One seed determines the winner
- **Timing**: Requested after waiting phase ends
- **Cost**: ~0.0001 SOL per game

##### Long Games (≥ 8 participants)
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

## Game Flow by Type

### Quick Games (< 8 participants)
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

### Long Games (≥ 8 participants)
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

### Backend Implementation
```typescript
// Current (simulated)
triggerBlockchainCall()        // Initiates simulated VRF
processBlockchainCalls()       // Simulates blockchain delay
determineWinner()             // Uses Math.random() currently

// Target (real VRF)
requestVRF(gameId, round)     // Sends transaction to Solana
checkVRFResult(gameId, round) // Polls for VRF seed
determineWinnerWithSeed()     // Uses VRF seed for fairness

// Long game example
async function handleLongGame(gameId: string) {
  // Round 1: Determine top 4
  const seed1 = await requestVRF(gameId, 1);
  const top4 = determineTop4(participants, seed1);

  // ... betting phase ...

  // Round 2: Determine final winner (new VRF request)
  const seed2 = await requestVRF(gameId, 2);
  const winner = determineFinalWinner(top4, seed2);
}
```

### Frontend Integration
```typescript
// Key files
src/components/BlockchainRandomnessDialog.tsx  // Progress indicator
src/game/managers/GamePhaseManager.ts          // Phase management
src/game/managers/AnimationManager.ts          // Smart explosions
src/App.tsx                                   // Event coordination
```

### VRF Cost Analysis
- **Quick Game**: ~0.0001 SOL (1 transaction)
- **Long Game**: ~0.0002 SOL (2 transactions)
- **Setup Cost**: Audit required for production ($10-50k)
- **Break-even**: ~1-4 months depending on game volume
- **Alternative**: Switchboard VRF (~0.002 SOL/game) for faster setup

### Verification & Fairness
- **Public Seeds**: Anyone can query blockchain for game's random seeds
- **Reproducible**: Given seed + participant data = same winner every time
- **No Manipulation**: Seeds generated by blockchain, not controlled by backend
- **Audit Trail**: All game seeds permanently stored on Solana
- **Round Separation**: Each elimination round has independent randomness

### Error Handling
- **VRF Timeout**: Retry once after 5 seconds
- **Second Failure**: Refund all bets to players
- **Network Issues**: Queue VRF requests for retry
- **Typical Duration**: 1-3 seconds per VRF request

## Development Workflow

### Getting Started
1. Clone repository
2. Run `bun install` to install dependencies
3. Set up Convex: `npx convex dev`
4. Configure Solana RPC in `.env`
5. Run `bun run dev` to start

### Environment Variables
```env
CONVEX_DEPLOYMENT=
SOLANA_RPC_URL=
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

### Testing Approach
- Check for test scripts in package.json
- Use Convex dashboard for backend testing
- Test Solana integration on devnet first

## Important Notes

### Database Management
- **Data Retention**: Game history kept for 3 days, then automatically deleted
- **Empty Game Cleanup**: Games with no players are deleted immediately after waiting phase
- **Transaction History**: Solana transactions kept for 7 days
- **Player Data**: Account balances and leaderboard stats are permanent

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

### MVP (Phase 1)
- Basic game loop
- Simple character sprites
- Convex backend setup
- Basic betting system

### Enhancement (Phase 2-3)
- Advanced animations
- Character re-roll feature
- Leaderboards

### Scale (Phase 4+)
- Performance optimization
- Mobile app
- Tournament modes
- Cross-chain support

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
- [Bun Documentation](https://bun.sh/docs)
