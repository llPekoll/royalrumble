// TEMPORARY STUB - This will be removed after frontend integration is complete
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGameParticipants = query({
  args: { gameId: v.id("gameStates") },
  handler: async (ctx, args) => {
    // Return empty array for now - will be replaced with real game state data
    return [];
  },
});