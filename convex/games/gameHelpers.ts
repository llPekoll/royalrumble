import { Id } from "../_generated/dataModel";
import { BOT_NAMES } from "./constants";

// Helper function to select a random active character
async function selectRandomCharacter(ctx: any) {
  const activeCharacters = await ctx.db
    .query("characters")
    .withIndex("by_active")
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .collect();

  if (activeCharacters.length === 0) {
    throw new Error("No active characters available");
  }

  // For now, simple random selection (could add rarity-based weights later)
  const randomIndex = Math.floor(Math.random() * activeCharacters.length);
  return activeCharacters[randomIndex];
}

// Helper: Add bots to game
export async function addBots(ctx: any, gameId: Id<"games">, count: number) {
  const game = await ctx.db.get(gameId);
  if (!game) throw new Error("Game not found");

  const usedNames = new Set<string>();
  
  // Get existing participants to see which spawn positions are taken
  const existingParticipants = await ctx.db
    .query("gameParticipants")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();
  
  const usedSpawnIndices = new Set(existingParticipants.map((p: any) => p.spawnIndex));

  for (let i = 0; i < count; i++) {
    let botName: string;
    do {
      botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    } while (usedNames.has(botName));
    usedNames.add(botName);

    const betAmount = Math.floor(Math.random() * 500) + 50; // 50-550 coins
    
    // Select a random character
    const character = await selectRandomCharacter(ctx);
    
    // Find next available spawn position
    let spawnIndex = 0;
    while (usedSpawnIndices.has(spawnIndex) && spawnIndex < game.spawnPositions.length) {
      spawnIndex++;
    }
    
    if (spawnIndex >= game.spawnPositions.length) {
      throw new Error("No available spawn positions for bot");
    }
    
    usedSpawnIndices.add(spawnIndex);
    const spawnPos = game.spawnPositions[spawnIndex];

    await ctx.db.insert("gameParticipants", {
      gameId,
      displayName: botName,
      characterId: character._id,
      colorHue: Math.floor(Math.random() * 360),
      isBot: true,
      betAmount,
      spawnIndex,
      position: { x: spawnPos.x, y: spawnPos.y },
      eliminated: false,
    });
  }
}

// Helper: Eliminate to finalists (top 2 or top 4)
export async function eliminateToFinalists(ctx: any, gameId: Id<"games">, finalistCount: number) {
  const participants = await ctx.db
    .query("gameParticipants")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .collect();

  if (participants.length <= finalistCount) {
    // If already at or below finalist count, nobody gets eliminated
    return;
  }

  // Calculate survival weights with randomness
  const weights = participants.map((p: any) => {
    // Base survival weight from bet amount (square root to reduce dominance)
    const baseWeight = Math.sqrt(p.betAmount);

    // Add random factor (30-70% of base weight for more chaos)
    const randomFactor = 0.3 + (Math.random() * 0.4);
    const randomBonus = baseWeight * randomFactor;

    return {
      participant: p,
      weight: baseWeight + randomBonus,
    };
  });

  // Sort by final weight (higher survives)
  weights.sort((a: any, b: any) => b.weight - a.weight);

  // Top finalists by weight survive, rest are eliminated
  for (let i = 0; i < weights.length; i++) {
    const { participant } = weights[i];

    if (i >= finalistCount) {
      await ctx.db.patch(participant._id, {
        eliminated: true,
        eliminatedAt: Date.now(),
        finalPosition: weights.length - i + 1, // 3rd place, 4th place, etc.
      });
    }
  }
}

// Helper: Determine winner
export async function determineWinner(ctx: any, gameId: Id<"games">) {
  const game = await ctx.db.get(gameId);
  if (!game) return;

  const participants = await ctx.db
    .query("gameParticipants")
    .withIndex("by_game", (q: any) => q.eq("gameId", gameId))
    .filter((q: any) => q.eq(q.field("eliminated"), false))
    .collect();

  if (participants.length === 0) return;

  let winner: typeof participants[0];

  if (game.isSinglePlayer) {
    // In single player mode, human always wins
    winner = participants.find((p: any) => !p.isBot) || participants[0];
  } else {
    // Calculate weighted probabilities with randomness
    const weights = participants.map((p: any) => {
      // Base weight from bet amount (square root to reduce dominance)
      const baseWeight = Math.sqrt(p.betAmount);

      // Add random factor (20-80% of base weight)
      const randomFactor = 0.2 + (Math.random() * 0.6);
      const randomBonus = baseWeight * randomFactor;

      // Final weight = base + random bonus
      return {
        participant: p,
        weight: baseWeight + randomBonus,
      };
    });

    // Calculate total weight for probability calculation
    const totalWeight = weights.reduce((sum: number, w: any) => sum + w.weight, 0);

    // Create probability distribution
    const probabilities = weights.map((w: any) => ({
      participant: w.participant,
      probability: w.weight / totalWeight,
    }));

    // Random selection with weighted probabilities
    const random = Math.random();
    let cumulative = 0;

    for (const { participant, probability } of probabilities) {
      cumulative += probability;
      if (random <= cumulative) {
        winner = participant;
        break;
      }
    }

    // Fallback to highest bet if somehow no winner selected
    winner = winner! || participants.sort((a: any, b: any) => b.betAmount - a.betAmount)[0];
  }

  // Update winner and losers
  for (const participant of participants) {
    if (participant._id === winner._id) {
      await ctx.db.patch(participant._id, {
        finalPosition: 1,
      });
      await ctx.db.patch(gameId, {
        winnerId: winner._id,
      });
    } else {
      await ctx.db.patch(participant._id, {
        eliminated: true,
        eliminatedAt: Date.now(),
        finalPosition: 2, // All others tie for 2nd in final battle
      });
    }
  }
}