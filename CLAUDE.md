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
- **Dynamic Game Duration**: Based on participant count with blockchain-based winner selection
  - **< 8 participants**: 4 phases - Waiting (30s) → Arena (dynamic*) → Results (5s)
  - **≥ 8 participants**: 7 phases - Waiting (30s) → Arena (10s) → Elimination → Betting (15s) → Battle (15s) → Results (5s)
  - **\*Dynamic Arena Phase**: For small games, arena phase extends until blockchain call completes (3-8 seconds)
- **Multiple Characters per Player**: One player can control multiple game participants
- **Multiple Maps**: Various arenas with unique backgrounds and spawn configurations
- **Character System**: Players start with a random character that can be re-rolled
- **Bet-to-size**: Character size increases with bet amount
- **Single-player mode**: Auto-refund if playing alone (runs with bots for entertainment)
- **Demo mode**: Bot games when no players join
- **Blockchain Winner Selection**: Uses blockchain randomness for fair winner determination in small games

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

### Small Games (< 8 participants)
- **Dynamic Phase Timing**: Arena phase extends until blockchain call completes
- **Frontend Flow**:
  1. Players move to center (2.5 seconds)
  2. Frontend triggers `triggerBlockchainCall` mutation
  3. Blockchain randomness dialog appears at bottom of screen
  4. Backend processes blockchain call (3-8 second simulation)
  5. Winner determined, elimination status updated
  6. Dialog disappears, only eliminated participants explode
  7. Winner remains in center for victory celebration

### Large Games (≥ 8 participants)
- **Fixed Timing**: Standard phase durations
- Winner determined at end of battle phase
- Elimination happens in waves (top 4 → final winner)

### Backend Implementation
```typescript
// Key functions in convex/games.ts
triggerBlockchainCall()        // Frontend → Backend blockchain call initiation
processBlockchainCalls()       // Cron job simulates blockchain completion
determineWinner()             // Selects winner and marks losers as eliminated
```

### Frontend Integration
```typescript
// Key files
src/components/BlockchainRandomnessDialog.tsx  // Progress indicator
src/game/managers/GamePhaseManager.ts          // Phase management
src/game/managers/AnimationManager.ts          // Smart explosions
src/App.tsx                                   // Event coordination
```

## Single Player Logic
- Runs normal game with bots for entertainment
- Player always wins
- Bet is refunded (no profit/loss)
- Good for practice and learning

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
