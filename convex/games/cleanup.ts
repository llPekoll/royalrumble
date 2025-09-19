import { internalMutation } from "../_generated/server";

// Clean up old completed games (called by cron)
export const cleanupOldGames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - (3 * 24 * 60 * 60 * 1000); // 3 days ago

    // Find old completed games
    const oldGames = await ctx.db
      .query("games")
      .withIndex("by_start_time")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("status"), "completed"),
          q.lt(q.field("startTime"), cutoffTime)
        )
      )
      .collect();

    let deletedGames = 0;
    let deletedParticipants = 0;
    let deletedBets = 0;

    for (const game of oldGames) {
      // Delete related participants
      const participants = await ctx.db
        .query("gameParticipants")
        .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
        .collect();

      for (const p of participants) {
        await ctx.db.delete(p._id);
        deletedParticipants++;
      }

      // Delete related bets
      const bets = await ctx.db
        .query("bets")
        .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
        .collect();

      for (const b of bets) {
        await ctx.db.delete(b._id);
        deletedBets++;
      }

      // Delete the game itself
      await ctx.db.delete(game._id);
      deletedGames++;
    }

    if (deletedGames > 0) {
      console.log(`Cleaned up ${deletedGames} old games, ${deletedParticipants} participants, ${deletedBets} bets (older than 3 days)`);
    }

    return {
      deletedGames,
      deletedParticipants,
      deletedBets,
      message: `Cleaned up ${deletedGames} games older than 3 days`
    };
  },
});