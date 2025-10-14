# Royal Rumble - Solana Battle Game Specifications

## Game Overview
A fast-paced, dynamic battle royale betting game on Solana where players control multiple characters in various arenas, with winners earning NFTs. Game duration adapts based on participant count.

## Core Game Loop

### 1. Game Cycles
- **Dynamic Duration**: 
  - Small games (< 8 participants): 45 seconds
  - Large games (≥ 8 participants): 75 seconds
- **Continuous**: Games run 24/7 with no downtime
- **Multiple Characters**: One player can control multiple GameParticipants
- **Join Anytime**: Players can join during waiting phase
- **Single Player Mode**:
  - If only 1 player joins, game runs with bots
  - Player automatically wins and gets their bet refunded
  - No profit/loss - entertainment and practice mode
- **Auto-Demo Mode**:
  - If no players join, generate demo game with bots
  - Bot games show gameplay to attract players
  - Bots use fake wallets and don't affect real economy

### 2. Game Phases

#### Small Games (< 8 participants) - 3 Phases Total

##### Phase 1: Waiting (30 seconds)
- Players join and select characters
- Players receive a random character upon entry
- **Re-roll Feature**: Players can re-roll their character
- Players can add multiple GameParticipants
- Place initial bets (self-betting only)

##### Phase 2: Arena (10 seconds)  
- All characters spawn in selected map
- Characters move to center of screen
- **Bet-to-Size Mechanic**: Character size increases with bet amount
- Visual preparation for battle

##### Phase 3: Results (5 seconds)
- Winners determined based on bet weights
- Payouts distributed
- Game stats displayed
- Next game countdown

#### Large Games (≥ 8 participants) - 7 Phases Total

##### Phase 1: Waiting (30 seconds)
- Same as small games
- Players can add multiple GameParticipants

##### Phase 2: Selection
- Final character selections
- Lock in participants

##### Phase 3: Arena (10 seconds)
- All characters spawn in selected map
- Characters move to center position

##### Phase 4: Elimination
- Explosion animation at center
- Only top 4 survive (weighted by bet amounts)
- Eliminated players become spectators

##### Phase 5: Betting (15 seconds)
- Top 4 displayed
- Spectator betting opens (bet on others only)
- No additional self-betting allowed

##### Phase 6: Battle (15 seconds)
- Tournament-style battles
- Battle outcomes determined by total bet weights
- Visual combat animations

##### Phase 7: Results (5 seconds)
- Winner announced
- Payouts distributed (95% to winners, 5% house)
- Next game countdown

## Economy System

### Currency Model
- **SOL**: Native Solana token for deposits/withdrawals
- **Game Coins**: Internal currency to reduce transaction fees
  - 1 SOL = 1000 Game Coins (adjustable rate)
  - Used for all in-game betting
  - Instant transactions (no blockchain delay)

### Wallet Integration
- **Deposit**: Convert SOL to Game Coins
- **Withdraw**: Convert Game Coins to SOL
- **Balance Display**: Always visible in UI
- **Transaction History**: Accessible from wallet menu

### Betting System
- **Minimum Bet**: 10 Game Coins
- **Maximum Bet**: 10,000 Game Coins per round
- **Bet Types**:
  - Self-bet (Phase 2): Bet on your own character
  - Spectator bet (Phase 4): Bet on final 4 players
- **Payout Calculation**:
  - Self-bet win: 2-10x multiplier (based on total players)
  - Spectator bet win: 1.5-4x multiplier (based on odds)

## NFT System

### Character NFTs
- **Minting Eligibility**: Only game winners
- **NFT Attributes**:
  - Character appearance
  - Win statistics
  - Game timestamp
  - Total winnings amount
- **Collection Name**: "Royal Rumble Champions"
- **Royalties**: 2.5% on secondary sales

### NFT Utility
- **Display Cabinet**: Show off won NFTs
- **Bonus Multiplier**: Each NFT adds 0.1% to future winnings
- **Leaderboard Points**: NFTs count toward seasonal rankings

## Technical Architecture

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion or Three.js
- **State Management**: Convex React hooks
- **Wallet Connection**: Solana Wallet Adapter

### Backend (Convex)
- **Platform**: Convex (real-time, serverless)
- **Database**: Built-in document store with tables for:
  - games, players, characters, gameParticipants, maps, bets
- **Real-time**: Native subscriptions (no WebSocket setup needed)
- **Functions Types**:
  - **Queries**: Read game state, player stats
  - **Mutations**: Place bets, update game state, manage participants
  - **Actions**: Blockchain interactions, VRF calls
- **Scheduled Functions**: 
  - Game loop timer (every 10 seconds for phase transitions)
  - Transaction processing (every 30 seconds)
  - Cleanup tasks (hourly/daily)

### Blockchain Integration
- **Network**: Solana Mainnet/Devnet
- **Program Language**: Anchor (Rust)
- **Smart Contract Functions**:
  - Deposit/Withdraw SOL
  - Mint NFTs
  - Verify game outcomes
- **RPC Provider**: Helius/Quicknode
- **Integration**: Convex actions call Solana RPC

### Game Engine (Phaser.js)
- **Rendering**: WebGL with Canvas fallback
- **Physics**: Built-in Arcade Physics
- **Character Movement**: Dynamic spawn positions based on map
- **Battle Logic**: Weighted random with bet multipliers
- **Animations**: Sprite-based with multiple states (idle, walk, attack)
- **Maps**: Multiple arenas with different spawn configurations

## User Interface

### Main Game Screen
- **No Landing Page**: Direct to game view
- **Layout**:
  - Center: Game arena
  - Top: Timer and phase indicator
  - Bottom: Betting controls
  - Right: Player list and bets
  - Left: Wallet balance and history

### Character Design
- **Base Models**: 20-30 unique characters
- **Visual Scaling**: Size increases with bet amount
- **Animations**:
  - Idle
  - Walking to center
  - Battle stance
  - Victory/Defeat

### Responsive Design
- Desktop: Full experience
- Mobile: Simplified controls, touch-optimized
- Tablet: Hybrid layout

## Security & Fair Play

### Random Number Generation
- **Method**: Verifiable Random Function (VRF)
- **Provider**: Chainlink VRF or Switchboard
- **Seed**: Combination of block hash and game ID

### Anti-Cheat Measures
- Rate limiting on bets
- Maximum wallet connections per IP
- Bet validation before processing
- Server-side game state management

### Audit Trail
- All bets recorded on-chain
- Game outcomes verifiable
- Transparent odds calculation

## Performance Requirements

### Latency
- WebSocket messages: <50ms
- Bet confirmation: <100ms
- Animation frame rate: 60 FPS

### Scalability
- Support 1,000 concurrent players
- Handle 10,000 bets per minute
- Auto-scaling infrastructure

### Uptime
- 99.9% availability target
- Graceful degradation during issues
- Automatic game state recovery

## Monetization

### Revenue Streams
- **House Edge**: 2-5% on all bets
- **Re-roll Fees**: Fixed coin cost
- **NFT Minting Fee**: 0.01 SOL per mint
- **Premium Features** (future):
  - Custom characters
  - Bet statistics
  - Private rooms

### Fee Structure
- Deposit: No fee
- Withdraw: 0.5% fee (minimum 0.001 SOL)
- Game participation: Free
- Betting: Included in odds

## Launch Phases

### Phase 1: MVP (Month 1-2)
- Basic game loop
- Simple characters
- SOL deposits/withdrawals
- Basic betting

### Phase 2: NFT Integration (Month 3)
- NFT minting for winners
- Character collection display
- Secondary market integration

### Phase 3: Enhanced Features (Month 4-5)
- Character re-rolls
- Advanced animations
- Leaderboards
- Tournament mode

### Phase 4: Scale & Optimize (Month 6+)
- Performance improvements
- Additional game modes
- Mobile app
- Cross-chain expansion

## Compliance & Legal

### Requirements
- Gambling license (jurisdiction-dependent)
- Age verification (18+)
- Responsible gaming features
- Terms of Service
- Privacy Policy

### Geo-Restrictions
- Blocked regions list
- IP-based filtering
- VPN detection

## Success Metrics

### Key Performance Indicators
- Daily Active Users (DAU)
- Average bet per user
- Player retention (7-day, 30-day)
- NFT minting rate
- Total Volume Locked (TVL)

### Target Metrics (First 6 Months)
- 10,000 registered users
- 1,000 DAU
- $1M total betting volume
- 500 NFTs minted
- 30% monthly retention rate
