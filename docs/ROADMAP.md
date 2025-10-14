# Domin8 Implementation Roadmap

**Total Timeline: 6-7 weeks**

This roadmap breaks down the implementation into manageable phases with clear deliverables.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│ EVERY USER'S BROWSER (Client-Side Demo)         │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │ Phaser.js: Local Demo Game             │    │
│  │ - 20 bots (client-generated)           │    │
│  │ - Math.random() winner                 │    │
│  │ - All animations                       │    │
│  │ - Infinite loop                        │    │
│  │ - ZERO backend/blockchain calls        │    │
│  └────────────────────────────────────────┘    │
│           ↓ User clicks "Bet 0.5 SOL"          │
│  ┌────────────────────────────────────────┐    │
│  │ createRealGame() mutation → Convex     │    │
│  └────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│ CONVEX BACKEND (Real Games Only)                │
│                                                  │
│  1. Create game document                        │
│  2. Initialize smart contract GamePool          │
│  3. Start 30s countdown                         │
│  4. Other players can join                      │
│  5. Game plays (VRF, settlement)                │
│  6. Payout via smart contract                   │
│  7. Clients return to local demos               │
│                                                  │
│  ✅ No demo game documents                      │
│  ✅ No demo bots in database                    │
│  ✅ No demo cron                                │
└──────────────────────────────────────────────────┘
```

---

## Phase 1: Privy Authentication & Wallets

**Duration**: 1 week
**Can Start**: Immediately
**Goal**: Get users signing in and wallets created

### Tasks

#### 1.1 Setup Privy Account (1 day)
- [x] Sign up at [privy.io](https://privy.io)
- [x] Create new app in dashboard
- [x] Get API keys (App ID + Secret)
- [x] Add credentials to `.env`

```env
# React + Vite client-side (VITE_* exposed to browser)
VITE_PRIVY_APP_ID=your_app_id

# Convex backend-side (not exposed to client)
PRIVY_APP_SECRET=your_secret
```

#### 1.2 Install Privy SDK (1 day)
```bash
bun add @privy-io/react-auth @privy-io/solana
```

#### 1.3 Add Privy Provider (1 day)
```typescript
// src/App.tsx
import { PrivyProvider } from '@privy-io/react-auth';
import { solana } from '@privy-io/react-auth/solana';

// Vite exposes import.meta.env.VITE_* to browser
<PrivyProvider
  appId={import.meta.env.VITE_PRIVY_APP_ID}
  config={{
    loginMethods: ['email', 'google', 'twitter'],
    appearance: {
      theme: 'dark',
      accentColor: '#6366f1',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      requireUserPasswordOnCreate: false,
    },
    supportedChains: [solana],
  }}
>
  {/* Your app */}
</PrivyProvider>
```

#### 1.4 Create Auth Components (2 days)
```typescript
// src/components/LoginButton.tsx
import { usePrivy } from '@privy-io/react-auth';

export const LoginButton = () => {
  const { login, authenticated, user } = usePrivy();

  if (authenticated) {
    return <div>Welcome {user.email?.address}</div>;
  }

  return <button onClick={login}>Login to Play</button>;
}
```

```typescript
// src/components/WalletDisplay.tsx
import { useWallets } from '@privy-io/react-auth';

export const WalletDisplay = () => {
  const { wallets } = useWallets();
  const solanaWallet = wallets.find(w => w.chainType === 'solana');

  return (
    <div>
      <div>Address: {solanaWallet?.address}</div>
      <div>Balance: {/* Query balance */}</div>
    </div>
  );
}
```

```typescript
// src/hooks/usePrivyWallet.ts
import { useWallets } from '@privy-io/react-auth';

export const usePrivyWallet = () => {
  const { wallets } = useWallets();

  const getSolanaWallet = () => {
    return wallets.find(w => w.chainType === 'solana');
  };

  return { getSolanaWallet };
}
```

#### 1.5 Test (1 day)
- [ ] User can login with email
- [ ] Wallet is created automatically
- [ ] Wallet address is displayed
- [ ] User can logout

### Deliverable
✅ Users can authenticate with Privy
✅ Embedded Solana wallets created automatically
✅ Wallet info displayed in UI

---

## Phase 2: Game Bet Escrow Smart Contract

**Duration**: 1 week
**Can Start**: Immediately (parallel with Phase 1)
**Goal**: Build and deploy the bet escrow program

### Tasks

#### 2.1 Create Anchor Project (1 day)
```bash
cd programs
anchor init domin8-game
cd domin8-game
```

Update `Anchor.toml`:
```toml
[programs.devnet]
domin8_game = "YourProgramIDHere"

[provider]
cluster = "devnet"
```

#### 2.2 Define State Structs (1 day)
```rust
// programs/domin8-game/src/state.rs

use anchor_lang::prelude::*;

#[account]
pub struct GamePool {
    pub game_id: String,           // Max 32 chars
    pub total_pool: u64,          // Total lamports in pool
    pub house_wallet: Pubkey,     // House wallet for 5% fee
    pub status: GameStatus,       // Waiting, Playing, Completed, Refunded
    pub vrf_seed_account: Pubkey, // Link to VRF GameSeed account
    pub winner: Option<Pubkey>,   // Winner's wallet (set during settlement)
    pub bump: u8,                 // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GameStatus {
    Waiting,    // Accepting bets
    Playing,    // Game in progress, no more bets
    Completed,  // Winner determined, payouts done
    Refunded,   // Game cancelled, all bets returned
}

#[account]
pub struct Bet {
    pub player: Pubkey,           // Player's Privy wallet
    pub amount: u64,              // Lamports bet
    pub participant_id: String,   // Reference to Convex gameParticipant
    pub timestamp: i64,           // When bet was placed
}
```

#### 2.3 Implement Instructions (3 days)

**initialize_game_pool.rs:**
```rust
// Creates new GamePool PDA for a game
// Authority: Backend wallet

pub fn initialize_game_pool(
    ctx: Context<InitializeGamePool>,
    game_id: String,
) -> Result<()> {
    require!(game_id.len() <= 32, ErrorCode::GameIdTooLong);

    let game_pool = &mut ctx.accounts.game_pool;
    game_pool.game_id = game_id;
    game_pool.total_pool = 0;
    game_pool.house_wallet = ctx.accounts.house_wallet.key();
    game_pool.status = GameStatus::Waiting;
    game_pool.bump = ctx.bumps.game_pool;

    Ok(())
}
```

**place_bet.rs:**
```rust
// Player locks SOL into GamePool
// Authority: Player's Privy wallet

pub fn place_bet(
    ctx: Context<PlaceBet>,
    amount: u64,
    participant_id: String,
) -> Result<()> {
    require!(
        ctx.accounts.game_pool.status == GameStatus::Waiting,
        ErrorCode::BettingClosed
    );

    // Transfer SOL from player to game pool
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.player.to_account_info(),
            to: ctx.accounts.game_pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;

    // Create bet record
    let bet = &mut ctx.accounts.bet;
    bet.player = ctx.accounts.player.key();
    bet.amount = amount;
    bet.participant_id = participant_id;
    bet.timestamp = Clock::get()?.unix_timestamp;

    // Update pool total
    ctx.accounts.game_pool.total_pool += amount;

    Ok(())
}
```

**lock_game.rs:**
```rust
// Prevents new bets, transitions to Playing status
// Authority: Backend wallet

pub fn lock_game(ctx: Context<LockGame>) -> Result<()> {
    require!(
        ctx.accounts.game_pool.status == GameStatus::Waiting,
        ErrorCode::GameAlreadyLocked
    );

    ctx.accounts.game_pool.status = GameStatus::Playing;

    Ok(())
}
```

**settle_game.rs:**
```rust
// Pays out winner, sends 5% to house
// Authority: Backend wallet

pub fn settle_game(
    ctx: Context<SettleGame>,
    winner_pubkey: Pubkey,
    vrf_seed_account: Pubkey,
) -> Result<()> {
    require!(
        ctx.accounts.game_pool.status == GameStatus::Playing,
        ErrorCode::GameNotPlaying
    );

    // Verify VRF seed exists (check vrf_seed_account is valid)
    // TODO: Add cross-program verification of VRF seed

    let game_pool = &mut ctx.accounts.game_pool;
    let total_pool = game_pool.total_pool;

    // Calculate payouts
    let house_fee = total_pool * 5 / 100;  // 5%
    let winner_amount = total_pool - house_fee;

    // Transfer to house
    **game_pool.to_account_info().try_borrow_mut_lamports()? -= house_fee;
    **ctx.accounts.house_wallet.to_account_info().try_borrow_mut_lamports()? += house_fee;

    // Transfer to winner
    **game_pool.to_account_info().try_borrow_mut_lamports()? -= winner_amount;
    **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += winner_amount;

    // Update state
    game_pool.winner = Some(winner_pubkey);
    game_pool.status = GameStatus::Completed;
    game_pool.vrf_seed_account = vrf_seed_account;

    Ok(())
}
```

**refund_game.rs:**
```rust
// Returns all bets to players
// Authority: Backend wallet

pub fn refund_game(ctx: Context<RefundGame>) -> Result<()> {
    // Iterate through all bets and refund
    // Mark game as Refunded

    ctx.accounts.game_pool.status = GameStatus::Refunded;

    Ok(())
}
```

#### 2.4 Write Tests (2 days)
```typescript
// tests/domin8-game.ts

describe("domin8-game", () => {
  it("Initializes game pool", async () => {
    // Test initialize_game_pool
  });

  it("Allows players to place bets", async () => {
    // Test place_bet
  });

  it("Locks game after waiting phase", async () => {
    // Test lock_game
  });

  it("Settles game and pays winner", async () => {
    // Test settle_game
  });

  it("Refunds all bets on cancellation", async () => {
    // Test refund_game
  });

  it("Rejects bets after lock", async () => {
    // Test error cases
  });
});
```

#### 2.5 Deploy to Devnet (1 day)
```bash
anchor build
anchor deploy --provider.cluster devnet

# Save program ID
echo "GAME_PROGRAM_ID=$(solana address -k target/deploy/domin8_game-keypair.json)" >> ../../.env
```

### Deliverable
✅ Smart contract deployed on devnet
✅ All 5 instructions working
✅ All tests passing
✅ Program ID saved to .env

---

## Phase 3: Client-Side Demo Mode

**Duration**: 1 week
**Can Start**: After Phase 1 complete
**Goal**: Phaser demo runs in browser, no backend

### Tasks

#### 3.1 Create Demo Scene (2 days)
```typescript
// src/game/scenes/DemoScene.ts

export class DemoScene extends Phaser.Scene {
  private bots: Bot[] = [];
  private gamePhase: 'waiting' | 'arena' | 'top4' | 'betting' | 'battle' | 'results' = 'waiting';

  create() {
    this.spawnBots(20);
    this.startDemoLoop();
  }

  spawnBots(count: number) {
    this.bots = Array.from({ length: count }, (_, i) => ({
      id: `bot-${i}`,
      name: this.generateBotName(),
      bet: Math.random() * 0.99 + 0.01, // 0.01-1 SOL
      character: this.randomCharacter(),
      sprite: this.createBotSprite(i),
    }));
  }

  startDemoLoop() {
    // Waiting phase (5 seconds)
    this.time.delayedCall(5000, () => {
      this.gamePhase = 'arena';
      this.runArenaPhase();
    });
  }

  runArenaPhase() {
    // Move all bots to center
    // After 10 seconds, select top 4
    this.time.delayedCall(10000, () => {
      const top4 = this.selectTop4();
      this.runTop4Phase(top4);
    });
  }

  selectTop4(): Bot[] {
    // Weighted random based on bet amounts
    return this.weightedRandomSelection(this.bots, 4);
  }

  runTop4Phase(top4: Bot[]) {
    // Show top 4
    // Simulate betting phase (15 seconds)
    this.time.delayedCall(15000, () => {
      this.runBattlePhase(top4);
    });
  }

  runBattlePhase(top4: Bot[]) {
    // Battle animations
    // After 15 seconds, select winner
    this.time.delayedCall(15000, () => {
      const winner = this.selectWinner(top4);
      this.showResults(winner);
    });
  }

  selectWinner(participants: Bot[]): Bot {
    const totalBets = participants.reduce((sum, b) => sum + b.bet, 0);
    const rand = Math.random() * totalBets;

    let cumulative = 0;
    for (const bot of participants) {
      cumulative += bot.bet;
      if (rand <= cumulative) return bot;
    }
    return participants[0];
  }

  showResults(winner: Bot) {
    // Show winner celebration
    // After 5 seconds, restart
    this.time.delayedCall(5000, () => {
      this.restartDemo();
    });
  }

  restartDemo() {
    this.bots = [];
    this.gamePhase = 'waiting';
    this.spawnBots(20);
    this.startDemoLoop();
  }

  generateBotName(): string {
    const prefixes = ['Crypto', 'Degen', 'Diamond', 'Moon', 'Laser'];
    const suffixes = ['Ape', 'Whale', 'Hands', 'Boy', 'Girl'];
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
  }
}
```

#### 3.2 Create Demo Manager (1 day)
```typescript
// src/game/managers/DemoGameManager.ts

export class DemoGameManager {
  private scene: DemoScene;
  private active: boolean = true;

  constructor(scene: DemoScene) {
    this.scene = scene;
  }

  start() {
    this.active = true;
    this.scene.scene.start('DemoScene');
  }

  stop() {
    this.active = false;
    this.scene.scene.stop('DemoScene');
  }

  isActive(): boolean {
    return this.active;
  }
}
```

#### 3.3 Add Demo Overlay UI (2 days)
```typescript
// src/components/DemoOverlay.tsx

export const DemoOverlay = () => {
  const { authenticated, login } = usePrivy();
  const [showBetModal, setShowBetModal] = useState(false);
  const navigate = useNavigate();

  const handleJoinGame = () => {
    if (!authenticated) {
      login();
    } else {
      setShowBetModal(true);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Demo Badge */}
      <div className="absolute top-4 left-4 bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold">
        DEMO MODE
      </div>

      {/* Join Game Button */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
        <button
          onClick={handleJoinGame}
          className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg text-xl font-bold"
        >
          {authenticated ? 'Join Game - Bet SOL' : 'Login to Play'}
        </button>
      </div>

      {/* Bet Modal */}
      {showBetModal && (
        <BetModal onClose={() => setShowBetModal(false)} />
      )}
    </div>
  );
}
```

```typescript
// src/components/BetModal.tsx

export const BetModal = ({ onClose }: { onClose: () => void }) => {
  const [betAmount, setBetAmount] = useState(0.1);
  const { createRealGame } = useGameMutations();

  const handleBet = async () => {
    await createRealGame(betAmount);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center pointer-events-auto">
      <div className="bg-gray-800 p-8 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Place Your Bet</h2>

        <input
          type="number"
          min="0.01"
          max="10"
          step="0.01"
          value={betAmount}
          onChange={(e) => setBetAmount(parseFloat(e.target.value))}
          className="w-full px-4 py-2 rounded mb-4"
        />

        <div className="flex gap-4">
          <button onClick={handleBet} className="bg-green-500 px-6 py-2 rounded">
            Bet {betAmount} SOL
          </button>
          <button onClick={onClose} className="bg-gray-600 px-6 py-2 rounded">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 3.4 Handle Demo → Real Transition (2 days)
```typescript
// src/game/PhaserGame.tsx

export const PhaserGame = () => {
  const [mode, setMode] = useState<'demo' | 'real'>('demo');
  const [gameId, setGameId] = useState<string | null>(null);
  const demoManagerRef = useRef<DemoGameManager | null>(null);

  useEffect(() => {
    // Initialize Phaser
    const config = {
      // ... Phaser config
    };

    const game = new Phaser.Game(config);
    const demoScene = game.scene.add('DemoScene', DemoScene, true);
    demoManagerRef.current = new DemoGameManager(demoScene);

    return () => game.destroy(true);
  }, []);

  const handleJoinGame = async (betAmount: number) => {
    // Stop demo
    demoManagerRef.current?.stop();

    // Create real game on server
    const newGameId = await createRealGame(betAmount);

    // Switch to real game mode
    setMode('real');
    setGameId(newGameId);
  };

  const handleGameEnd = () => {
    // Return to demo
    setMode('demo');
    setGameId(null);
    demoManagerRef.current?.start();
  };

  return (
    <div className="relative w-full h-full">
      <canvas id="phaser-game" />

      {mode === 'demo' && (
        <DemoOverlay onJoin={handleJoinGame} />
      )}

      {mode === 'real' && gameId && (
        <RealGameOverlay gameId={gameId} onEnd={handleGameEnd} />
      )}
    </div>
  );
}
```

#### 3.5 Test (1 day)
- [ ] Demo loads instantly on page load
- [ ] 20 bots spawn with random names/bets
- [ ] Full long game plays (all phases)
- [ ] Winner selected with weighted randomness
- [ ] Demo restarts automatically
- [ ] No backend/blockchain calls during demo
- [ ] Click "Join Game" stops demo

### Deliverable
✅ Client-side demo working in browser
✅ Zero server load
✅ Smooth transition to real game on bet
✅ Infinite loop, instant restart

---

## Phase 4: Database Schema Updates

**Duration**: 3 days
**Can Start**: After Phase 1 complete
**Goal**: Update Convex schema for new architecture

### Tasks

#### 4.1 Update Schema (1 day)
```typescript
// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    // ONLY real games - no demo games stored!
    gamePda: v.string(),                    // On-chain GamePool PDA
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("completed")
    ),
    startTime: v.number(),                  // Unix timestamp
    endTime: v.optional(v.number()),
    blockchainCallStatus: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("completed")
    ),
    blockchainCallStartTime: v.optional(v.number()),
    mapId: v.id("maps"),
  }),

  players: defineTable({
    privyUserId: v.string(),                // Privy user identifier
    privyWalletAddress: v.string(),         // Embedded wallet address
    // NO BALANCE STORAGE - query from Privy wallet directly
    displayName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_privy_user_id", ["privyUserId"]),

  gameParticipants: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    characterId: v.id("characters"),
    betAmount: v.number(),                  // SOL amount
    txSignature: v.string(),                // place_bet transaction
    position: v.optional(v.number()),       // Final position (1st, 2nd, etc.)
    winnings: v.optional(v.number()),       // SOL won
  }).index("by_game", ["gameId"]),

  bets: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    participantId: v.id("gameParticipants"),
    amount: v.number(),                     // SOL amount (no coins!)
    txSignature: v.string(),
    onChainConfirmed: v.boolean(),
    timestamp: v.number(),
  }).index("by_game", ["gameId"]),

  characters: defineTable({
    name: v.string(),
    spriteUrl: v.string(),
    animations: v.object({
      idle: v.string(),
      walk: v.string(),
      attack: v.string(),
    }),
  }),

  maps: defineTable({
    name: v.string(),
    backgroundUrl: v.string(),
    spawnPositions: v.array(v.object({
      x: v.number(),
      y: v.number(),
    })),
  }),

  bankBalance: defineTable({
    balance: v.number(),                    // Available SOL for Bank bot
    lastUpdated: v.number(),
  }),

  transactionQueue: defineTable({
    type: v.union(
      v.literal("vrf_request"),
      v.literal("settle_game"),
      v.literal("refund_game")
    ),
    gameId: v.id("games"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
  }),
});
```

#### 4.2 Create Migrations (1 day)
```typescript
// convex/migrations/001_remove_coins.ts

import { mutation } from "./_generated/server";

export const removeCoins = mutation({
  args: {},
  handler: async (ctx) => {
    // Remove any coin-related fields from existing players
    const players = await ctx.db.query("players").collect();

    for (const player of players) {
      if ('coinBalance' in player) {
        await ctx.db.patch(player._id, {
          coinBalance: undefined,
        });
      }
    }

    console.log("Removed coin balances from all players");
  },
});
```

#### 4.3 Test Migrations (1 day)
- [ ] Run migrations on dev environment
- [ ] Verify schema changes applied
- [ ] Test all queries work with new schema
- [ ] Verify no demo game records in database

### Deliverable
✅ Database schema updated
✅ No coin references
✅ Privy wallet fields added
✅ Demo games NOT in schema

---

## Phase 5: Real Game Backend Logic

**Duration**: 4 days
**Can Start**: After Phase 2 & 4 complete
**Goal**: Server manages real games only

### Tasks

#### 5.1 Game Creation Mutation (1 day)
```typescript
// convex/games.ts

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createRealGame = mutation({
  args: {
    playerId: v.id("players"),
    betAmount: v.number(),
    characterId: v.id("characters"),
  },
  handler: async (ctx, args) => {
    // Check if active real game exists
    const activeGame = await ctx.db
      .query("games")
      .filter(q => q.neq(q.field("status"), "completed"))
      .first();

    if (activeGame) {
      // Join existing game
      return activeGame._id;
    }

    // Create new game
    const gameId = await ctx.db.insert("games", {
      gamePda: "", // Will be set after smart contract initialization
      status: "waiting",
      startTime: Date.now() + 30000, // 30s from now
      blockchainCallStatus: "none",
      mapId: await selectRandomMap(ctx),
    });

    return gameId;
  },
});
```

#### 5.2 Place Bet Mutation (1 day)
```typescript
export const placeBet = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    characterId: v.id("characters"),
    amount: v.number(),
    txSignature: v.string(), // From place_bet instruction
  },
  handler: async (ctx, args) => {
    // Verify game is in waiting status
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== "waiting") {
      throw new Error("Game not accepting bets");
    }

    // Create game participant
    const participantId = await ctx.db.insert("gameParticipants", {
      gameId: args.gameId,
      playerId: args.playerId,
      characterId: args.characterId,
      betAmount: args.amount,
      txSignature: args.txSignature,
    });

    // Create bet record
    await ctx.db.insert("bets", {
      gameId: args.gameId,
      playerId: args.playerId,
      participantId,
      amount: args.amount,
      txSignature: args.txSignature,
      onChainConfirmed: false,
      timestamp: Date.now(),
    });

    return participantId;
  },
});
```

#### 5.3 Game Loop Cron (1 day)
```typescript
// convex/crons.ts

import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "real-game-loop",
  { seconds: 3 },
  async (ctx) => {
    // Get all active real games (no demo games!)
    const games = await ctx.db
      .query("games")
      .filter(q => q.neq(q.field("status"), "completed"))
      .collect();

    for (const game of games) {
      if (game.status === "waiting") {
        await checkWaitingPhaseEnd(ctx, game);
      } else if (game.status === "playing") {
        await processPlayingGame(ctx, game);
      }
    }
  }
);

export default crons;
```

#### 5.4 Helper Functions (1 day)
```typescript
async function checkWaitingPhaseEnd(ctx, game) {
  if (Date.now() >= game.startTime) {
    // Lock the game
    await lockGame(ctx, game);

    // Check player count
    const participants = await getGameParticipants(ctx, game._id);

    if (participants.length === 0) {
      // Should never happen, but just in case
      await refundGame(ctx, game);
    } else if (participants.length === 1) {
      // Solo player vs bank
      await handleSoloPlayer(ctx, game, participants[0]);
    } else {
      // Multiplayer game
      await startMultiplayerGame(ctx, game, participants);
    }
  }
}
```

### Deliverable
✅ Backend creates real games only
✅ Players can join during waiting phase
✅ Game loop processes real games
✅ No demo logic in backend

---

## Phase 6: Smart Contract Integration Layer

**Duration**: 1 week
**Can Start**: After Phase 2 & 5 complete
**Goal**: Connect Convex backend to Solana programs

### Tasks

#### 6.1 Solana Client Setup (2 days)
```typescript
// convex/solana/client.ts

import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { IDL } from './idl/domin8_game';

export const getSolanaConnection = () => {
  return new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
};

export const getBackendWallet = () => {
  const secretKey = JSON.parse(process.env.BACKEND_WALLET_SECRET!);
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
};

export const getGameProgram = () => {
  const connection = getSolanaConnection();
  const wallet = getBackendWallet();
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    { commitment: 'confirmed' }
  );

  const programId = new PublicKey(process.env.GAME_PROGRAM_ID!);
  return new Program(IDL, programId, provider);
};
```

#### 6.2 Smart Contract Wrappers (3 days)
```typescript
// convex/solana/gameEscrow.ts

export const initializeGamePool = async (gameId: string) => {
  const program = getGameProgram();
  const wallet = getBackendWallet();

  const [gamePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_pool"), Buffer.from(gameId)],
    program.programId
  );

  const tx = await program.methods
    .initializeGamePool(gameId)
    .accounts({
      gamePool: gamePda,
      authority: wallet.publicKey,
      houseWallet: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { gamePda: gamePda.toString(), txSignature: tx };
};

export const lockGamePool = async (gamePda: string) => {
  const program = getGameProgram();
  const wallet = getBackendWallet();

  const tx = await program.methods
    .lockGame()
    .accounts({
      gamePool: new PublicKey(gamePda),
      authority: wallet.publicKey,
    })
    .rpc();

  return tx;
};

export const settleGame = async (
  gamePda: string,
  winnerPubkey: string,
  vrfSeedAccount: string
) => {
  const program = getGameProgram();
  const wallet = getBackendWallet();

  const tx = await program.methods
    .settleGame(
      new PublicKey(winnerPubkey),
      new PublicKey(vrfSeedAccount)
    )
    .accounts({
      gamePool: new PublicKey(gamePda),
      authority: wallet.publicKey,
      winner: new PublicKey(winnerPubkey),
      houseWallet: wallet.publicKey,
    })
    .rpc();

  return tx;
};

export const refundGame = async (gamePda: string) => {
  const program = getGameProgram();
  const wallet = getBackendWallet();

  const tx = await program.methods
    .refundGame()
    .accounts({
      gamePool: new PublicKey(gamePda),
      authority: wallet.publicKey,
    })
    .rpc();

  return tx;
};
```

#### 6.3 Integration with Convex Mutations (2 days)
```typescript
// Update convex/games.ts

export const createRealGame = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // ... existing code ...

    // Initialize smart contract GamePool
    const { gamePda, txSignature } = await initializeGamePool(gameId);

    // Update game with PDA
    await ctx.db.patch(gameId, { gamePda });

    return gameId;
  },
});

export const lockGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    // Lock on smart contract
    await lockGamePool(game.gamePda);

    // Update database
    await ctx.db.patch(args.gameId, { status: "playing" });
  },
});
```

#### 6.4 Test Integration (1 day)
- [ ] Backend can initialize GamePool
- [ ] Backend can lock game
- [ ] Backend can settle game
- [ ] Backend can refund game
- [ ] All transactions confirmed on devnet

### Deliverable
✅ Backend can interact with smart contracts
✅ All 5 instructions callable from Convex
✅ Error handling in place
✅ Transaction queue working

---

## Phase 7: Frontend Betting Interface

**Duration**: 1 week
**Can Start**: After Phase 1 & 6 complete
**Goal**: Users can place bets via Privy seamlessly

### Tasks

#### 7.1 Bet Button Component (2 days)
```typescript
// src/components/BetButton.tsx

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBetEscrow } from '../hooks/useBetEscrow';

export const BetButton = ({ gameId, amount }: { gameId: string, amount: number }) => {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { placeBet, isPlacing } = useBetEscrow();

  const solanaWallet = wallets.find(w => w.chainType === 'solana');

  const handleBet = async () => {
    if (!solanaWallet) {
      console.error("No Solana wallet found");
      return;
    }

    try {
      await placeBet(gameId, amount);
    } catch (error) {
      console.error("Bet failed:", error);
    }
  };

  if (!authenticated) {
    return <div>Login to bet</div>;
  }

  return (
    <button
      onClick={handleBet}
      disabled={isPlacing}
      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 px-8 py-4 rounded-lg text-white font-bold"
    >
      {isPlacing ? 'Placing Bet...' : `Bet ${amount} SOL`}
    </button>
  );
}
```

#### 7.2 Smart Contract Hooks (2 days)
```typescript
// src/hooks/useBetEscrow.ts

import { useWallets } from '@privy-io/react-auth';
import { useProgram } from './useProgram';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

export const useBetEscrow = () => {
  const { wallets } = useWallets();
  const program = useProgram();
  const placeBetMutation = useMutation(api.games.placeBet);
  const [isPlacing, setIsPlacing] = useState(false);

  const placeBet = async (gameId: string, amount: number) => {
    setIsPlacing(true);

    try {
      const solanaWallet = wallets.find(w => w.chainType === 'solana');
      if (!solanaWallet) throw new Error("No Solana wallet");

      // Get game PDA
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("game_pool"), Buffer.from(gameId)],
        program.programId
      );

      // Call place_bet instruction
      const tx = await program.methods
        .placeBet(
          new BN(amount * LAMPORTS_PER_SOL),
          "participant-id" // Will be generated by backend
        )
        .accounts({
          gamePool: gamePda,
          player: new PublicKey(solanaWallet.address),
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Update Convex database
      await placeBetMutation({
        gameId,
        amount,
        txSignature: tx,
      });

      return tx;
    } finally {
      setIsPlacing(false);
    }
  };

  return { placeBet, isPlacing };
}
```

#### 7.3 Game Display UI (2 days)
```typescript
// src/components/GameDisplay.tsx

export const GameDisplay = ({ gameId }: { gameId: string }) => {
  const game = useQuery(api.games.getGame, { gameId });
  const participants = useQuery(api.games.getParticipants, { gameId });

  if (!game) return <div>Loading...</div>;

  return (
    <div className="p-4">
      {/* Game Status */}
      <div className="bg-blue-500 px-4 py-2 rounded">
        {game.status === 'waiting' && `Waiting... ${timeRemaining}s`}
        {game.status === 'playing' && 'Game in Progress'}
      </div>

      {/* Participant List */}
      <div className="mt-4">
        <h3 className="text-xl font-bold">Players ({participants.length})</h3>
        {participants.map(p => (
          <div key={p._id} className="flex justify-between p-2">
            <span>{p.displayName}</span>
            <span>{p.betAmount} SOL</span>
          </div>
        ))}
      </div>

      {/* Join Button */}
      {game.status === 'waiting' && (
        <BetButton gameId={gameId} amount={0.5} />
      )}
    </div>
  );
}
```

#### 7.4 Test User Flow (1 day)
- [ ] User logs in with Privy
- [ ] Watches client-side demo
- [ ] Clicks "Join Game"
- [ ] Bet modal appears
- [ ] Transaction signs via Privy
- [ ] 1-2 second confirmation
- [ ] Client switches to real game scene
- [ ] Other players can join

### Deliverable
✅ Complete betting UI
✅ Privy wallet integration working
✅ Smooth demo → real transition
✅ Transaction confirmations shown

---

## Phase 8: End-to-End Testing

**Duration**: 1 week
**Can Start**: After all phases complete
**Goal**: Verify entire flow works on devnet

### Test Scenarios

#### 8.1 Client-Side Demo (1 day)
- [ ] Demo loads instantly on page load
- [ ] 20 bots with random names/bets
- [ ] Full long game plays (all phases)
- [ ] Winner selected fairly (weighted random)
- [ ] Loops infinitely
- [ ] No backend/blockchain calls
- [ ] No database records

#### 8.2 Demo → Real Transition (1 day)
- [ ] User clicks "Join Game"
- [ ] Demo stops immediately
- [ ] Server game created
- [ ] Smart contract initialized
- [ ] Scene switches smoothly
- [ ] Other users can join during countdown

#### 8.3 Solo Player vs Bank (1 day)
- [ ] Single player bets
- [ ] Countdown completes
- [ ] Bank balance checked
- [ ] If sufficient: Bank bot spawned
- [ ] VRF determines winner
- [ ] Settlement via smart contract
- [ ] SOL arrives in winner's wallet
- [ ] If insufficient: Refund works

#### 8.4 Quick Game (2-7 players) (1 day)
- [ ] 2-7 players join
- [ ] All bets locked in smart contract
- [ ] Game locks after countdown
- [ ] VRF determines winner
- [ ] Smart contract pays out
- [ ] All clients return to demo

#### 8.5 Long Game (≥8 players) (1 day)
- [ ] 8+ players join
- [ ] First VRF determines top 4
- [ ] Betting phase works
- [ ] Second VRF determines winner
- [ ] Payout via smart contract
- [ ] Return to demo

#### 8.6 Error Cases (1 day)
- [ ] Insufficient bank balance → refund
- [ ] VRF timeout → retry → refund if fails
- [ ] User cancels bet → others continue
- [ ] Network congestion handled
- [ ] Double bet prevented

#### 8.7 Performance Testing (1 day)
- [ ] Demo runs at 60 FPS
- [ ] Real game stays smooth
- [ ] Multiple concurrent users work
- [ ] No memory leaks
- [ ] Mobile works well

### Deliverable
✅ All scenarios working end-to-end
✅ No critical bugs
✅ Performance acceptable
✅ Ready for mainnet audit

---

## Timeline Summary

| Phase | Duration | Dependencies | Can Parallelize? |
|-------|----------|--------------|------------------|
| **Phase 1: Privy** | 1 week | None | Start immediately |
| **Phase 2: Smart Contract** | 1 week | None | Parallel with Phase 1 |
| **Phase 3: Client Demo** | 1 week | Phase 1 | - |
| **Phase 4: Database** | 3 days | Phase 1 | Parallel with Phase 3 |
| **Phase 5: Backend** | 4 days | Phase 2, 4 | - |
| **Phase 6: Integration** | 1 week | Phase 2, 5 | - |
| **Phase 7: Frontend** | 1 week | Phase 1, 6 | - |
| **Phase 8: Testing** | 1 week | All complete | - |

**Fastest Path with Parallelization: ~6 weeks**

```
Week 1: Phase 1 + Phase 2 (parallel)
Week 2: Phase 3 + Phase 4 (parallel)
Week 3: Phase 5
Week 4: Phase 6
Week 5: Phase 7
Week 6: Phase 8
```

---

## Next Steps

### Immediate Actions (This Week)
1. ✅ Create Privy account
2. ✅ Initialize Anchor project for domin8-game
3. ✅ Set up development environment

### Phase 1 Start Checklist
- [ ] Privy API keys obtained
- [ ] `.env` file configured
- [ ] Bun installed and working
- [ ] Convex dev environment running

### Phase 2 Start Checklist
- [ ] Anchor CLI installed
- [ ] Solana CLI configured for devnet
- [ ] Backend wallet created and funded
- [ ] VRF program deployed

---

**Ready to start building! Which phase would you like to tackle first?**
