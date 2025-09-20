import { query } from "./_generated/server";
import { v } from "convex/values";

// Get map by ID
export const getMap = query({
  args: { mapId: v.id("maps") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mapId);
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

    const { spawnRadius, minSpacing } = map.spawnConfiguration;
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
