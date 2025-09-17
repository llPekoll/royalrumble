# Royal Rumble - Solana Battle Game

## Project Overview
A fast-paced, 1-minute battle royale betting game on Solana where players bet on characters, with winners earning NFTs. Built with Convex, React, Phaser.js, and Solana blockchain integration.

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
- **1-minute games**: Continuous 24/7 gameplay
- **6 phases**: Selection → Arena → Elimination → Betting → Battle → Results
- **Bet-to-size**: Character size increases with bet amount
- **Single-player mode**: Auto-refund if playing alone
- **Demo mode**: Bot games when no players for 2 minutes

### Economy System
- **Game Coins**: Internal currency (1 SOL = 1000 coins)
- **Betting**: Min 10, Max 10,000 coins per round
- **Payouts**: 2-10x for self-bets, 1.5-4x for spectator bets
- **NFT Minting**: Winners can mint character NFTs

### Technical Features
- **Real-time**: Convex subscriptions for live updates
- **Type-safe**: End-to-end TypeScript
- **Responsive**: Mobile and desktop support
- **Scalable**: Serverless architecture

## Database Schema

### Core Tables
- `games`: Game state and phases
- `players`: Player data and balances
- `characters`: Character definitions
- `bets`: Betting records
- `nfts`: Minted NFT records

## Animation Engine (Phaser.js)

### Key Animations
- Character movement to center
- Explosion elimination effects
- Battle clash animations
- Victory celebrations
- Coin rain and confetti

### Performance
- 60 FPS target
- WebGL with Canvas fallback
- Sprite pooling for efficiency
- Mobile optimization

## Convex Backend

### Scheduled Functions
- Game loop: Every 60 seconds
- Phase transitions: Every 10 seconds
- Inactivity check: Every 2 minutes

### Real-time Features
- Automatic UI updates
- No WebSocket configuration needed
- Optimistic updates with rollback

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
- NFT minting integration
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
1. Add sprite to `/public/assets/characters.png`
2. Insert character record in Convex schema
3. Update character selection logic

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