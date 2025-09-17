# Convex Backend Implementation Guide

## Why Convex?

- **Real-time by default**: No WebSocket configuration needed
- **Serverless**: Auto-scaling with no infrastructure management  
- **Type-safe**: End-to-end TypeScript with generated types
- **Built-in database**: No separate database setup required
- **Reactive queries**: UI updates automatically when data changes
- **Scheduled functions**: Perfect for game loop timing

## Data Schema

### Tables

```typescript
// schema.ts
defineSchema({
  games: defineTable({
    phase: v.string(), // "selection" | "arena" | "elimination" | "betting" | "battle" | "results"
    startedAt: v.number(),
    phaseStartedAt: v.number(),
    players: v.array(v.id("players")),
    survivors: v.array(v.id("players")),
    winner: v.optional(v.id("players")),
    totalPot: v.number(),
    status: v.string(), // "active" | "completed"
    isDemo: v.optional(v.boolean()), // Flag for bot-only games
    isSinglePlayer: v.optional(v.boolean()), // Flag for single player games
  }),

  players: defineTable({
    walletAddress: v.string(),
    gameCoins: v.number(),
    currentGameId: v.optional(v.id("games")),
    characterId: v.optional(v.id("characters")),
    betAmount: v.number(),
    isAlive: v.boolean(),
    size: v.number(), // Visual size based on bet
    isBot: v.optional(v.boolean()),
    botName: v.optional(v.string()),
  }).index("by_wallet", ["walletAddress"]),

  characters: defineTable({
    name: v.string(),
    imageUrl: v.string(),
    baseStats: v.object({
      strength: v.number(),
      speed: v.number(),
      luck: v.number(),
    }),
  }),

  bets: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    targetPlayerId: v.id("players"),
    amount: v.number(),
    type: v.string(), // "self" | "spectator"
    payout: v.optional(v.number()),
    timestamp: v.number(),
  }).index("by_game", ["gameId"]),

  nfts: defineTable({
    mintAddress: v.string(),
    playerId: v.id("players"),
    characterId: v.id("characters"),
    gameId: v.id("games"),
    metadata: v.object({
      winAmount: v.number(),
      gameDate: v.number(),
      totalPlayers: v.number(),
    }),
  }).index("by_player", ["playerId"]),
})
```

## Core Functions

### Scheduled Functions

```typescript
// crons.ts
import { cronJobs } from "convex/server";

const crons = cronJobs();

// Main game loop - runs every minute
crons.interval(
  "gameLoop",
  { seconds: 60 },
  api.games.startNewGame
);

// Phase transitions - runs every 10 seconds
crons.interval(
  "phaseTransition",
  { seconds: 10 },
  api.games.advancePhase
);

// Check for inactive games - runs every 2 minutes
crons.interval(
  "inactivityCheck",
  { seconds: 120 },
  api.games.checkInactivity
);

export default crons;
```

### Game Management

```typescript
// games.ts
export const startNewGame = mutation({
  handler: async (ctx) => {
    // Check for waiting players
    const waitingPlayers = await ctx.db
      .query("players")
      .filter((q) => q.eq(q.field("currentGameId"), undefined))
      .collect();

    const isSinglePlayer = waitingPlayers.length === 1;
    const isDemo = waitingPlayers.length === 0;
    
    // Create new game
    const gameId = await ctx.db.insert("games", {
      phase: "selection",
      startedAt: Date.now(),
      phaseStartedAt: Date.now(),
      players: [],
      survivors: [],
      totalPot: 0,
      status: "active",
      isDemo, // Flag for bot games
      isSinglePlayer, // Flag for single player games
    });

    if (isDemo) {
      // Generate bot players for demo
      await generateBotPlayers(ctx, gameId, 8 + Math.floor(Math.random() * 12));
    } else {
      // Add real waiting players
      for (const player of waitingPlayers) {
        await ctx.db.patch(player._id, { currentGameId: gameId });
        
        // Add to game
        const game = await ctx.db.get(gameId);
        if (game) {
          await ctx.db.patch(gameId, {
            players: [...game.players, player._id],
          });
        }
      }
      
      if (isSinglePlayer) {
        // Add some bots to make it visually interesting
        await generateBotPlayers(ctx, gameId, 7 + Math.floor(Math.random() * 8));
      }
    }

    return gameId;
  },
});

export const checkInactivity = mutation({
  handler: async (ctx) => {
    const lastGame = await ctx.db
      .query("games")
      .order("desc")
      .first();

    if (!lastGame) {
      // No games ever, start demo
      return await startDemoGame(ctx);
    }

    const timeSinceLastGame = Date.now() - lastGame.startedAt;
    
    // If no game for 2 minutes, start demo
    if (timeSinceLastGame > 120000) {
      return await startDemoGame(ctx);
    }
  },
});

async function startDemoGame(ctx: any) {
  const gameId = await ctx.db.insert("games", {
    phase: "selection",
    startedAt: Date.now(),
    phaseStartedAt: Date.now(),
    players: [],
    survivors: [],
    totalPot: 0,
    status: "active",
    isDemo: true,
  });

  await generateBotPlayers(ctx, gameId, 10 + Math.floor(Math.random() * 15));
  return gameId;
}

async function generateBotPlayers(ctx: any, gameId: string, count: number) {
  const botNames = [
    "CryptoKing", "SolanaWhale", "DeFiDegen", "NFTCollector", "MoonBoi",
    "DiamondHands", "PaperHands", "ApeStrong", "HODLer", "Pumper",
    "Dumper", "WhaleAlert", "SatoshiFan", "VitalikJr", "AnonymousApe",
    "RugPuller", "YieldFarmer", "GasGuzzler", "BagHolder", "FOMOBuyer"
  ];

  const characters = await ctx.db.query("characters").collect();
  
  for (let i = 0; i < count; i++) {
    const botId = await ctx.db.insert("players", {
      walletAddress: `bot_${Date.now()}_${i}`,
      gameCoins: 10000,
      currentGameId: gameId,
      characterId: characters[Math.floor(Math.random() * characters.length)]._id,
      betAmount: 100 + Math.floor(Math.random() * 900),
      isAlive: true,
      isBot: true,
      botName: botNames[i % botNames.length],
      size: 1 + Math.random() * 2,
    });

    // Add to game
    const game = await ctx.db.get(gameId);
    if (game) {
      await ctx.db.patch(gameId, {
        players: [...game.players, botId],
      });
    }

    // Simulate bot betting
    await ctx.db.insert("bets", {
      gameId,
      playerId: botId,
      targetPlayerId: botId,
      amount: 100 + Math.floor(Math.random() * 500),
      type: "self",
      timestamp: Date.now(),
    });
  }
}

export const advancePhase = mutation({
  handler: async (ctx) => {
    const activeGame = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!activeGame) return;

    const phases = ["selection", "arena", "elimination", "betting", "battle", "results"];
    const currentIndex = phases.indexOf(activeGame.phase);
    const nextPhase = phases[currentIndex + 1];

    if (nextPhase) {
      await ctx.db.patch(activeGame._id, {
        phase: nextPhase,
        phaseStartedAt: Date.now(),
      });

      // Handle phase-specific logic
      switch (nextPhase) {
        case "elimination":
          await performElimination(ctx, activeGame._id);
          break;
        case "battle":
          await performBattle(ctx, activeGame._id);
          break;
        case "results":
          await calculateResults(ctx, activeGame._id);
          break;
      }
    }
  },
});
```

### Player Actions

```typescript
// players.ts
export const joinGame = mutation({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const activeGame = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!activeGame) throw new Error("No active game");

    // Get or create player
    let player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      const playerId = await ctx.db.insert("players", {
        walletAddress: args.walletAddress,
        gameCoins: 0,
        betAmount: 0,
        isAlive: true,
        size: 1,
      });
      player = await ctx.db.get(playerId);
    }

    // Assign random character
    const characters = await ctx.db.query("characters").collect();
    const randomChar = characters[Math.floor(Math.random() * characters.length)];

    await ctx.db.patch(player!._id, {
      currentGameId: activeGame._id,
      characterId: randomChar._id,
    });

    // Add to game
    await ctx.db.patch(activeGame._id, {
      players: [...activeGame.players, player!._id],
    });

    return player;
  },
});

export const placeBet = mutation({
  args: {
    playerId: v.id("players"),
    targetPlayerId: v.id("players"),
    amount: v.number(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    if (player.gameCoins < args.amount) {
      throw new Error("Insufficient coins");
    }

    // Deduct coins
    await ctx.db.patch(args.playerId, {
      gameCoins: player.gameCoins - args.amount,
      betAmount: player.betAmount + args.amount,
      size: 1 + (args.amount / 1000), // Size increases with bet
    });

    // Record bet
    await ctx.db.insert("bets", {
      gameId: player.currentGameId!,
      playerId: args.playerId,
      targetPlayerId: args.targetPlayerId,
      amount: args.amount,
      type: args.type,
      timestamp: Date.now(),
    });

    // Update game pot
    const game = await ctx.db.get(player.currentGameId!);
    if (game) {
      await ctx.db.patch(game._id, {
        totalPot: game.totalPot + args.amount,
      });
    }
  },
});
```

### Blockchain Actions

```typescript
// solana.ts
import { action } from "./_generated/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

export const depositSol = action({
  args: {
    walletAddress: v.string(),
    amount: v.number(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify transaction on Solana
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    const tx = await connection.getTransaction(args.signature);
    
    if (!tx || !tx.meta?.postBalances) {
      throw new Error("Invalid transaction");
    }

    // Credit game coins (1 SOL = 1000 coins)
    const gameCoins = args.amount * 1000;
    
    await ctx.runMutation(api.players.creditCoins, {
      walletAddress: args.walletAddress,
      amount: gameCoins,
    });

    return { gameCoins };
  },
});

export const mintNFT = action({
  args: {
    playerId: v.id("players"),
    gameId: v.id("games"),
    characterId: v.id("characters"),
  },
  handler: async (ctx, args) => {
    // Call Anchor program to mint NFT
    // This would interact with your Solana program
    
    const mintAddress = "generated_mint_address";
    
    await ctx.runMutation(api.nfts.recordMint, {
      playerId: args.playerId,
      mintAddress,
      characterId: args.characterId,
      gameId: args.gameId,
    });

    return { mintAddress };
  },
});
```

### Real-time Subscriptions

```typescript
// subscriptions.ts
export const currentGame = query({
  handler: async (ctx) => {
    const game = await ctx.db
      .query("games")
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (!game) return null;

    const players = await Promise.all(
      game.players.map(id => ctx.db.get(id))
    );

    return {
      ...game,
      playersData: players,
    };
  },
});

export const playerStats = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) return null;

    const nfts = await ctx.db
      .query("nfts")
      .withIndex("by_player", (q) => q.eq("playerId", player._id))
      .collect();

    return {
      ...player,
      nftCount: nfts.length,
      totalWinnings: nfts.reduce((sum, nft) => sum + nft.metadata.winAmount, 0),
    };
  },
});
```

## Frontend Integration

```typescript
// app/game/page.tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function GamePage() {
  const game = useQuery(api.subscriptions.currentGame);
  const joinGame = useMutation(api.players.joinGame);
  const placeBet = useMutation(api.players.placeBet);

  // Real-time updates automatically trigger re-renders
  if (!game) {
    return <div>Waiting for next game...</div>;
  }

  return (
    <div>
      <div>Phase: {game.phase}</div>
      <div>Players: {game.playersData.length}</div>
      {/* Game UI */}
    </div>
  );
}
```

## Advantages of Convex Architecture

1. **No WebSocket Management**: Real-time subscriptions work automatically
2. **Type Safety**: Generated types for all queries/mutations
3. **Optimistic Updates**: UI updates instantly, rollback on error
4. **Serverless Scaling**: Handles any number of concurrent players
5. **Built-in Auth**: Integrates with wallet authentication
6. **Development Speed**: Hot reload with local Convex dev server
7. **Cost Effective**: Pay only for actual usage, no idle servers