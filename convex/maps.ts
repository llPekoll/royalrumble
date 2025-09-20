import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all active maps
export const getActiveMaps = query({
  args: {},
  handler: async (ctx) => {
    const maps = await ctx.db
      .query("maps")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    return maps;
  },
});

// Get map by ID
export const getMap = query({
  args: { mapId: v.id("maps") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mapId);
  },
});

// Get random map for new game
export const getRandomMap = query({
  args: {},
  handler: async (ctx) => {
    const maps = await ctx.db
      .query("maps")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    if (maps.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * maps.length);
    return maps[randomIndex];
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

// Create a new map (admin function)
export const createMap = mutation({
  args: {
    name: v.string(),
    background: v.string(),
    description: v.optional(v.string()),
    spawnConfiguration: v.object({
      maxPlayers: v.number(),
      spawnRadius: v.number(),
      minSpacing: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const mapId = await ctx.db.insert("maps", {
      name: args.name,
      background: args.background,
      description: args.description,
      spawnConfiguration: args.spawnConfiguration,
      isActive: true,
    });
    
    return mapId;
  },
});

// Update map
export const updateMap = mutation({
  args: {
    mapId: v.id("maps"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    spawnConfiguration: v.optional(v.object({
      maxPlayers: v.number(),
      spawnRadius: v.number(),
      minSpacing: v.number(),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.spawnConfiguration !== undefined) updates.spawnConfiguration = args.spawnConfiguration;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    
    await ctx.db.patch(args.mapId, updates);
  },
});