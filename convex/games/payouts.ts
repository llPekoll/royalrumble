import { Id } from "../_generated/dataModel";

// Helper: Process payouts
export async function processPayouts(ctx: any, gameId: Id<"games">) {
  const game = await ctx.db.get(gameId);
  if (!game || !game.winnerId) return;

  const winner = await ctx.db.get(game.winnerId);
  if (!winner) return;

  const bets = await ctx.db
    .query("bets")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  if (game.isSinglePlayer && !winner.isBot) {
    // Single player mode - refund all bets
    for (const bet of bets) {
      await ctx.db.patch(bet._id, {
        payout: bet.amount,
        status: "refunded",
        settledAt: Date.now(),
      });

      if (bet.playerId) {
        const player = await ctx.db.get(bet.playerId);
        if (player) {
          await ctx.db.patch(player._id, {
            gameCoins: player.gameCoins + bet.amount,
            totalGames: (player.totalGames || 0) + 1,
          });
        }
      }
    }
    return;
  }

  // Separate bets by type
  const selfBets = bets.filter((b: any) => b.betType === "self");
  const spectatorBets = bets.filter((b: any) => b.betType === "spectator");

  // Calculate total pools
  const selfBetPool = selfBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
  const spectatorBetPool = spectatorBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);

  // Calculate winning bets
  const winningSelfBets = selfBets.filter((b: any) => b.targetParticipantId === game.winnerId);
  const winningSpectatorBets = spectatorBets.filter((b: any) => b.targetParticipantId === game.winnerId);

  // Calculate total winning amounts
  const totalWinningSelf = winningSelfBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
  const totalWinningSpectator = winningSpectatorBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);

  // Calculate payable pools (95% of total, 5% house edge)
  const payableSelfPool = Math.floor(selfBetPool * 0.95);
  const payableSpectatorPool = Math.floor(spectatorBetPool * 0.95);

  // Process self bets (main game bets)
  for (const bet of selfBets) {
    let payout = 0;
    let status: "won" | "lost" = "lost";

    if (bet.targetParticipantId === game.winnerId) {
      // Winner gets proportional share of 95% of the self bet pool
      if (totalWinningSelf > 0) {
        const share = bet.amount / totalWinningSelf;
        payout = Math.floor(payableSelfPool * share);
        status = "won";
      }
    }

    await ctx.db.patch(bet._id, {
      payout,
      status,
      settledAt: Date.now(),
    });

    // Credit winnings
    if (payout > 0 && bet.playerId) {
      const player = await ctx.db.get(bet.playerId);
      if (player) {
        await ctx.db.patch(player._id, {
          gameCoins: player.gameCoins + payout,
          totalWins: (player.totalWins || 0) + (status === "won" ? 1 : 0),
          totalGames: (player.totalGames || 0) + 1,
          totalEarnings: (player.totalEarnings || 0) + Math.max(0, payout - bet.amount),
        });
      }
    }
  }

  // Process spectator bets (top 4 betting phase)
  for (const bet of spectatorBets) {
    let payout = 0;
    let status: "won" | "lost" = "lost";

    if (bet.targetParticipantId === game.winnerId) {
      // Winner gets proportional share of 95% of the spectator bet pool
      if (totalWinningSpectator > 0) {
        const share = bet.amount / totalWinningSpectator;
        payout = Math.floor(payableSpectatorPool * share);
        status = "won";
      }
    }

    await ctx.db.patch(bet._id, {
      payout,
      status,
      settledAt: Date.now(),
    });

    // Credit winnings
    if (payout > 0 && bet.playerId) {
      const player = await ctx.db.get(bet.playerId);
      if (player) {
        await ctx.db.patch(player._id, {
          gameCoins: player.gameCoins + payout,
          totalWins: (player.totalWins || 0) + (status === "won" ? 1 : 0),
          totalGames: (player.totalGames || 0) + 1,
          totalEarnings: (player.totalEarnings || 0) + Math.max(0, payout - bet.amount),
        });
      }
    }
  }
}