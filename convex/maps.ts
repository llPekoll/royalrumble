import { query } from "./_generated/server";
import { v } from "convex/values";

// Get map by ID
export const getMap = query({
  args: { mapId: v.id("maps") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mapId);
  },
});

// Get a default map for display when no game is active
export const getDefaultMap = query({
  args: {},
  handler: async (ctx) => {
    // Get first active map
    const maps = await ctx.db
      .query("maps")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    if (maps.length === 0) {
      return null;
    }
    
    // Return a random map or the first one
    return maps[Math.floor(Math.random() * maps.length)];
  },
});
// Calculate spawn positions for a map
export const calculateSpawnPositions = query({
  args: {
    mapId: v.id("maps"),
    participantCount: v.number(),
  },
  handler: async (ctx, args) => {
    const map = await ctx.db.get(args.mapId);
    if (!map) {
      throw new Error("Map not found");
    }

    const { spawnRadius } = map.spawnConfiguration;
    const positions = [];

    // Calculate positions in a circle around center
    const angleStep = (Math.PI * 2) / Math.max(args.participantCount, 8);

    for (let i = 0; i < args.participantCount; i++) {
      const angle = i * angleStep;
      const x = 512 + Math.cos(angle) * spawnRadius; // Assuming 1024x768 canvas, center at 512
      const y = 384 + Math.sin(angle) * spawnRadius; // Center at 384

      positions.push({ x, y, angle });
    }

    return positions;
  },
});
