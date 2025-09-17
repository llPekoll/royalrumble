# Single Player Game Logic

## Overview
When only one real player joins a game, the system runs a special single-player mode where:
- The game runs normally with visual effects
- Bots are added for visual entertainment
- The real player always wins
- The player gets their bet refunded (no profit/loss)

## Implementation

### Game Result Calculation

```typescript
// games.ts - Add to calculateResults function
async function calculateResults(ctx: any, gameId: string) {
  const game = await ctx.db.get(gameId);
  if (!game) return;

  // Check if single player game
  if (game.isSinglePlayer) {
    const realPlayers = await ctx.db
      .query("players")
      .filter((q) => 
        q.and(
          q.eq(q.field("currentGameId"), gameId),
          q.neq(q.field("isBot"), true)
        )
      )
      .collect();

    if (realPlayers.length === 1) {
      const player = realPlayers[0];
      
      // Refund the player's bet
      await ctx.db.patch(player._id, {
        gameCoins: player.gameCoins + player.betAmount,
        betAmount: 0,
      });

      // Mark as winner for NFT eligibility (optional)
      await ctx.db.patch(gameId, {
        winner: player._id,
        status: "completed",
      });

      // Create refund record
      await ctx.db.insert("bets", {
        gameId,
        playerId: player._id,
        targetPlayerId: player._id,
        amount: 0,
        type: "refund",
        payout: player.betAmount,
        timestamp: Date.now(),
      });

      return;
    }
  }

  // Normal game result calculation for multi-player games
  // ... existing logic ...
}

// Modified performElimination for single player
async function performElimination(ctx: any, gameId: string) {
  const game = await ctx.db.get(gameId);
  if (!game) return;

  if (game.isSinglePlayer) {
    // In single player, always keep the real player as survivor
    const realPlayer = await ctx.db
      .query("players")
      .filter((q) => 
        q.and(
          q.eq(q.field("currentGameId"), gameId),
          q.neq(q.field("isBot"), true)
        )
      )
      .first();

    if (realPlayer) {
      // Select 3 random bots to survive with the player
      const bots = await ctx.db
        .query("players")
        .filter((q) => 
          q.and(
            q.eq(q.field("currentGameId"), gameId),
            q.eq(q.field("isBot"), true)
          )
        )
        .collect();

      const selectedBots = bots
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(b => b._id);

      await ctx.db.patch(gameId, {
        survivors: [realPlayer._id, ...selectedBots],
      });

      // Mark eliminated bots
      for (const bot of bots) {
        if (!selectedBots.includes(bot._id)) {
          await ctx.db.patch(bot._id, { isAlive: false });
        }
      }
    }
  } else {
    // Normal elimination logic for multi-player games
    // ... existing weighted selection logic ...
  }
}

// Modified performBattle for single player
async function performBattle(ctx: any, gameId: string) {
  const game = await ctx.db.get(gameId);
  if (!game) return;

  if (game.isSinglePlayer) {
    // In single player, real player always wins
    const realPlayer = await ctx.db
      .query("players")
      .filter((q) => 
        q.and(
          q.eq(q.field("currentGameId"), gameId),
          q.neq(q.field("isBot"), true)
        )
      )
      .first();

    if (realPlayer) {
      // Simulate battles but real player always advances
      await ctx.db.patch(gameId, {
        winner: realPlayer._id,
      });

      // Mark all bots as eliminated
      const bots = game.survivors.filter(id => id !== realPlayer._id);
      for (const botId of bots) {
        await ctx.db.patch(botId, { isAlive: false });
      }
    }
  } else {
    // Normal battle logic for multi-player games
    // ... existing weighted battle logic ...
  }
}
```

### UI Display

```typescript
// Frontend display for single player games
export function GameResults({ game, player }) {
  if (game.isSinglePlayer && game.winner === player._id) {
    return (
      <div className="results-container">
        <h2>Practice Round Complete!</h2>
        <p>You were the only player - your bet has been refunded</p>
        <p>Coins returned: {player.betAmount}</p>
        <p>Wait for more players to join for real prizes!</p>
      </div>
    );
  }

  // Normal results display
  return (
    <div className="results-container">
      {/* Regular game results */}
    </div>
  );
}
```

## Benefits

1. **No Empty Games**: Player always sees action even when alone
2. **Risk-Free Practice**: New players can learn mechanics without losing money
3. **Fair System**: No profit or loss when playing alone
4. **Visual Entertainment**: Bots make the game look alive
5. **Smooth Experience**: No need to wait for other players

## Edge Cases Handled

- Player disconnection during single-player game
- Player joining mid-game when another is playing alone
- Refund calculation ensures exact bet return
- NFT minting optional for single-player wins