import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { PHASE_DURATIONS } from "./constants";
import { addBots, eliminateToFinalists, determineWinner } from "./gameHelpers";
import { processPayouts } from "./payouts";

// Create a new game (internal, called by cron)
export const createNewGame = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if there's already an active game
    const activeGame = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .first();

    if (activeGame) {
      console.log("Game already active, skipping creation");
      return null;
    }

    const now = Date.now();
    const gameId = await ctx.db.insert("games", {
      status: "waiting",
      phase: 1,
      phaseStartTime: now,
      nextPhaseTime: now + (PHASE_DURATIONS.WAITING * 1000),
      startTime: now,
      playerCount: 0,
      totalPot: 0,
      isDemo: false,
      isSinglePlayer: false,
    });

    return gameId;
  },
});

// Advance game phase (internal, called by cron)
export const advanceGamePhase = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status === "completed") return;

    const now = Date.now();
    let nextStatus = game.status;
    let nextPhase = game.phase;
    let nextPhaseTime = now;

    switch (game.status) {
      case "waiting":
        // Check if we have players
        const participants = await ctx.db
          .query("gameParticipants")
          .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
          .filter((q) => q.eq(q.field("isBot"), false))
          .collect();

        if (participants.length === 0) {
          // No players, convert to demo mode
          await addBots(ctx, args.gameId, 8);
          nextStatus = "arena";
          nextPhase = 2;
          nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

          await ctx.db.patch(args.gameId, {
            isDemo: true,
            status: nextStatus,
            phase: nextPhase,
            phaseStartTime: now,
            nextPhaseTime,
          });
        } else if (participants.length === 1) {
          // Single player mode
          await addBots(ctx, args.gameId, 7);
          nextStatus = "arena";
          nextPhase = 2;
          nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

          await ctx.db.patch(args.gameId, {
            isSinglePlayer: true,
            status: nextStatus,
            phase: nextPhase,
            phaseStartTime: now,
            nextPhaseTime,
          });
        } else {
          // Normal multiplayer game
          nextStatus = "arena";
          nextPhase = 2;
          nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

          await ctx.db.patch(args.gameId, {
            status: nextStatus,
            phase: nextPhase,
            phaseStartTime: now,
            nextPhaseTime,
          });
        }
        break;

      case "arena":
        // Get participant count to decide next phase
        const arenaParticipants = await ctx.db
          .query("gameParticipants")
          .withIndex("by_game", (q: any) => q.eq("gameId", args.gameId))
          .filter((q: any) => q.eq(q.field("eliminated"), false))
          .collect();

        if (arenaParticipants.length < 8) {
          // For less than 8 players, skip TOP4 and BATTLE phases
          // Go straight to determining winner
          await determineWinner(ctx, args.gameId);
          nextStatus = "results";
          nextPhase = 3; // Phase 3 in the 3-phase system
          nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
        } else {
          // 8 or more players: eliminate to top 4 for betting phase
          await eliminateToFinalists(ctx, args.gameId, 4);
          nextStatus = "betting";
          nextPhase = 3;
          nextPhaseTime = now + (PHASE_DURATIONS.TOP4 * 1000);
        }
        break;

      case "betting":
        nextStatus = "battle";
        nextPhase = 4;
        nextPhaseTime = now + (PHASE_DURATIONS.BATTLE * 1000);
        break;

      case "battle":
        // Determine winner
        await determineWinner(ctx, args.gameId);
        nextStatus = "results";
        nextPhase = 5;
        nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
        break;

      case "results":
        // Process payouts
        await processPayouts(ctx, args.gameId);
        nextStatus = "completed" as any;
        nextPhase = 6;

        await ctx.db.patch(args.gameId, {
          status: nextStatus,
          phase: nextPhase,
          endTime: now,
        });
        return;
    }

    // Update game phase
    await ctx.db.patch(args.gameId, {
      status: nextStatus,
      phase: nextPhase,
      phaseStartTime: now,
      nextPhaseTime,
    });
  },
});

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

// Main game loop (called by cron every 10 seconds)
export const gameLoop = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check for active game
    const activeGame = await ctx.db
      .query("games")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .first();

    const now = Date.now();

    if (!activeGame) {
      // Check if we recently had a game deleted (to avoid rapid game creation)
      const recentGames = await ctx.db
        .query("games")
        .withIndex("by_start_time")
        .order("desc")
        .take(5);

      // If the last game was very recent (within 2 minutes), don't create immediately
      const lastGameTime = recentGames.length > 0 ? recentGames[0].startTime : 0;
      const timeSinceLastGame = now - lastGameTime;

      // Only create a new game if enough time has passed (2 minutes = 120,000ms)
      // or if there was no recent game
      if (timeSinceLastGame > 120000 || recentGames.length === 0) {
        await ctx.db.insert("games", {
          status: "waiting",
          phase: 1,
          phaseStartTime: now,
          nextPhaseTime: now + (PHASE_DURATIONS.WAITING * 1000),
          startTime: now,
          playerCount: 0,
          totalPot: 0,
          isDemo: false,
          isSinglePlayer: false,
        });

        console.log("Created new game");
      } else {
        console.log(`Waiting ${Math.ceil((120000 - timeSinceLastGame) / 1000)}s before creating new game`);
      }
      return;
    }

    // Check if current phase time is up
    if (now >= activeGame.nextPhaseTime) {
      // Inline phase advancement logic
      let nextStatus: any = activeGame.status;
      let nextPhase = activeGame.phase;
      let nextPhaseTime = now;

      switch (activeGame.status) {
        case "waiting":
          // Check if we have players
          const participants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", activeGame._id))
            .filter((q: any) => q.eq(q.field("isBot"), false))
            .collect();

          if (participants.length === 0) {
            // No players after 30s - delete the game to save database space
            console.log(`Deleting empty game ${activeGame._id} - no players joined`);

            // Delete any related data first (shouldn't be any, but just in case)
            const allParticipants = await ctx.db
              .query("gameParticipants")
              .withIndex("by_game", (q: any) => q.eq("gameId", activeGame._id))
              .collect();

            for (const p of allParticipants) {
              await ctx.db.delete(p._id);
            }

            // Delete the game
            await ctx.db.delete(activeGame._id);
            return; // Exit early, don't create a new game yet
          } else if (participants.length === 1) {
            // Single player mode
            await addBots(ctx, activeGame._id, 7);
            nextStatus = "arena";
            nextPhase = 2;
            nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

            await ctx.db.patch(activeGame._id, {
              isSinglePlayer: true,
              status: nextStatus,
              phase: nextPhase,
              phaseStartTime: now,
              nextPhaseTime,
            });
          } else {
            // Normal multiplayer game
            nextStatus = "arena";
            nextPhase = 2;
            nextPhaseTime = now + (PHASE_DURATIONS.RUNNING * 1000);

            await ctx.db.patch(activeGame._id, {
              status: nextStatus,
              phase: nextPhase,
              phaseStartTime: now,
              nextPhaseTime,
            });
          }
          break;

        case "arena":
          // Get participant count to decide next phase
          const arenaParticipants = await ctx.db
            .query("gameParticipants")
            .withIndex("by_game", (q: any) => q.eq("gameId", activeGame._id))
            .filter((q: any) => q.eq(q.field("eliminated"), false))
            .collect();

          if (arenaParticipants.length < 8) {
            // For less than 8 players, skip TOP4 and BATTLE phases
            // Go straight to determining winner
            await determineWinner(ctx, activeGame._id);
            nextStatus = "results";
            nextPhase = 3; // Phase 3 in the 3-phase system
            nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
          } else {
            // 8 or more players: eliminate to top 4 for betting phase
            await eliminateToFinalists(ctx, activeGame._id, 4);
            nextStatus = "betting";
            nextPhase = 3;
            nextPhaseTime = now + (PHASE_DURATIONS.TOP4 * 1000);
          }
          break;

        case "betting":
          nextStatus = "battle";
          nextPhase = 4;
          nextPhaseTime = now + (PHASE_DURATIONS.BATTLE * 1000);
          break;

        case "battle":
          // Determine winner
          await determineWinner(ctx, activeGame._id);
          nextStatus = "results";
          nextPhase = 5;
          nextPhaseTime = now + (PHASE_DURATIONS.RESULTS * 1000);
          break;

        case "results":
          // Process payouts
          await processPayouts(ctx, activeGame._id);
          nextStatus = "completed" as any;
          nextPhase = 6;

          await ctx.db.patch(activeGame._id, {
            status: nextStatus,
            phase: nextPhase,
            endTime: now,
          });
          console.log(`Completed game ${activeGame._id}`);
          return;
      }

      // Update game phase if not results
      if (nextStatus !== "completed") {
        await ctx.db.patch(activeGame._id, {
          status: nextStatus,
          phase: nextPhase,
          phaseStartTime: now,
          nextPhaseTime,
        });
      }

      console.log(`Advanced game ${activeGame._id} from ${activeGame.status} to ${nextStatus}`);
    }
  },
});
