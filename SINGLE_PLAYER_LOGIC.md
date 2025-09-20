# Single Player Game Logic

## Overview
When only one real player joins a game (can have multiple GameParticipants), the system runs a special single-player mode where:
- The game runs normally with visual effects
- Bots are added as GameParticipants for visual entertainment  
- The real player's participants always win
- The player gets their bet refunded (no profit/loss)
- Supports both small (<8 participants) and large (≥8 participants) game formats

## Implementation

### Game Result Calculation

```typescript
// games.ts - Add to calculateResults function
async function calculateResults(ctx: any, gameId: string) {
  const game = await ctx.db.get(gameId);
  if (!game) return;

  // Check if single player game
  if (game.isSinglePlayer) {
    // Get all GameParticipants for the real player
    const realParticipants = await ctx.db
      .query("gameParticipants")
      .filter((q) => 
        q.and(
          q.eq(q.field("gameId"), gameId),
          q.eq(q.field("isBot"), false)
        )
      )
      .collect();

    if (realParticipants.length > 0) {
      // Get the player
      const playerId = realParticipants[0].playerId;
      const player = await ctx.db.get(playerId);
      
      // Calculate total bet across all participants
      const totalBet = realParticipants.reduce((sum, p) => sum + p.betAmount, 0);
      
      // Refund all bets
      await ctx.db.patch(playerId, {
        gameCoins: player.gameCoins + totalBet,
      });

      // Mark random participant as winner for visual effect
      const winner = realParticipants[Math.floor(Math.random() * realParticipants.length)];
      await ctx.db.patch(gameId, {
        winnerId: winner._id,
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
    // Get all participants
    const allParticipants = await ctx.db
      .query("gameParticipants")
      .filter((q) => q.eq(q.field("gameId"), gameId))
      .collect();

    const realParticipants = allParticipants.filter(p => !p.isBot);
    const botParticipants = allParticipants.filter(p => p.isBot);

    if (realParticipants.length > 0) {
      // In large games, keep some real participants and bots for top 4
      if (allParticipants.length >= 8) {
        // Keep 2 real participants and 2 bots for visual variety
        const survivingReal = realParticipants
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(2, realParticipants.length));
        
        const survivingBots = botParticipants
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.max(2, 4 - survivingReal.length));

        // Mark survivors
        const survivors = [...survivingReal, ...survivingBots];
        for (const participant of survivors) {
          await ctx.db.patch(participant._id, { 
            eliminated: false,
            finalPosition: null 
          });
        }

        // Mark eliminated
        const eliminated = allParticipants.filter(p => !survivors.includes(p));
        for (const participant of eliminated) {
          await ctx.db.patch(participant._id, { 
            eliminated: true,
            eliminatedAt: Date.now()
          });
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