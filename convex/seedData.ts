import { internalMutation } from "./_generated/server";

// Seed initial characters and maps data
export const seedInitialData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if data already exists
    const existingCharacters = await ctx.db.query("characters").take(1);
    const existingMaps = await ctx.db.query("maps").take(1);

    if (existingCharacters.length > 0 && existingMaps.length > 0) {
      console.log("Seed data already exists, skipping...");
      return { message: "Seed data already exists" };
    }

    let charactersCreated = 0;
    let mapsCreated = 0;

    // Create initial characters (based on existing character sprites)
    if (existingCharacters.length === 0) {
      const characters = [
        {
          name: "Knight",
          spriteKey: "knight",
          description: "A brave warrior with strong defense",
          rarity: "common",
          stats: {
            baseHealth: 100,
            baseAttack: 80,
            baseDefense: 90,
            speed: 70,
            luck: 75,
          },
          abilities: [
            {
              name: "Shield Block",
              description: "Increased defense for a short time",
              cooldown: 30,
              effect: { type: "defense_boost", amount: 20, duration: 10 }
            }
          ],
          animations: {
            idle: "knight-idle",
            walk: "knight-walk",
            attack: "knight-attack",
            death: "knight-death",
          },
          isActive: true,
        },
        {
          name: "Wizard",
          spriteKey: "wizard",
          description: "A magical spellcaster with high luck",
          rarity: "rare",
          stats: {
            baseHealth: 80,
            baseAttack: 95,
            baseDefense: 60,
            speed: 85,
            luck: 95,
          },
          abilities: [
            {
              name: "Magic Missile",
              description: "Deal extra damage with magical energy",
              cooldown: 25,
              effect: { type: "attack_boost", amount: 30, duration: 5 }
            }
          ],
          animations: {
            idle: "wizard-idle",
            walk: "wizard-walk",
            attack: "wizard-attack",
            death: "wizard-death",
          },
          isActive: true,
        },
        {
          name: "Archer",
          spriteKey: "archer",
          description: "A swift ranger with high speed and accuracy",
          rarity: "common",
          stats: {
            baseHealth: 85,
            baseAttack: 85,
            baseDefense: 70,
            speed: 95,
            luck: 80,
          },
          abilities: [
            {
              name: "Quick Shot",
              description: "Increased attack speed for a short time",
              cooldown: 20,
              effect: { type: "speed_boost", amount: 25, duration: 8 }
            }
          ],
          animations: {
            idle: "archer-idle",
            walk: "archer-walk",
            attack: "archer-attack",
            death: "archer-death",
          },
          isActive: true,
        },
        {
          name: "Rogue",
          spriteKey: "rogue",
          description: "A sneaky assassin with incredible luck",
          rarity: "epic",
          stats: {
            baseHealth: 75,
            baseAttack: 90,
            baseDefense: 65,
            speed: 100,
            luck: 100,
          },
          abilities: [
            {
              name: "Shadow Strike",
              description: "Become invisible and gain massive luck boost",
              cooldown: 45,
              effect: { type: "luck_boost", amount: 50, duration: 15 }
            }
          ],
          animations: {
            idle: "rogue-idle",
            walk: "rogue-walk",
            attack: "rogue-attack",
            death: "rogue-death",
          },
          unlockConditions: {
            minWins: 5,
            specialRequirement: "Win 5 games to unlock",
          },
          isActive: true,
        },
        {
          name: "Paladin",
          spriteKey: "paladin",
          description: "A holy warrior with balanced stats and healing",
          rarity: "epic",
          stats: {
            baseHealth: 110,
            baseAttack: 75,
            baseDefense: 95,
            speed: 75,
            luck: 85,
          },
          abilities: [
            {
              name: "Divine Shield",
              description: "Become immune to elimination briefly",
              cooldown: 60,
              effect: { type: "immunity", duration: 5 }
            }
          ],
          animations: {
            idle: "paladin-idle",
            walk: "paladin-walk",
            attack: "paladin-attack",
            death: "paladin-death",
          },
          unlockConditions: {
            minGames: 10,
            minWins: 3,
            specialRequirement: "Play 10 games and win 3 to unlock",
          },
          isActive: true,
        },
        {
          name: "Dragon Lord",
          spriteKey: "dragon",
          description: "A legendary fighter with immense power",
          rarity: "legendary",
          stats: {
            baseHealth: 120,
            baseAttack: 110,
            baseDefense: 100,
            speed: 80,
            luck: 90,
          },
          abilities: [
            {
              name: "Dragon Breath",
              description: "Devastate all nearby enemies",
              cooldown: 90,
              effect: { type: "area_attack", damage: 50, radius: 100 }
            }
          ],
          animations: {
            idle: "dragon-idle",
            walk: "dragon-walk",
            attack: "dragon-attack",
            death: "dragon-death",
          },
          unlockConditions: {
            minWins: 20,
            specialRequirement: "Win 20 games to unlock this legendary character",
          },
          isActive: true,
        },
      ];

      for (const char of characters) {
        await ctx.db.insert("characters", char);
        charactersCreated++;
      }
    }

    // Create initial maps
    if (existingMaps.length === 0) {
      const maps = [
        {
          name: "Classic Arena",
          background: "arena",
          description: "The original battle arena with balanced gameplay",
          difficulty: "easy",
          seed: 12345,
          centerX: 512,
          centerY: 384,
          features: [
            {
              type: "decoration",
              x: 512,
              y: 200,
              spriteKey: "statue",
              properties: { decorative: true }
            }
          ],
          spawnConfiguration: {
            maxPlayers: 16,
            spawnRadius: 180,
            minSpacing: 0.5, // radians
          },
          isActive: true,
          weight: 50,
        },
        {
          name: "Desert Storm",
          background: "arena2",
          description: "A harsh desert arena with sandstorms",
          difficulty: "medium",
          seed: 67890,
          centerX: 512,
          centerY: 384,
          features: [
            {
              type: "obstacle",
              x: 400,
              y: 300,
              width: 50,
              height: 50,
              spriteKey: "rock",
              properties: { blocking: true }
            },
            {
              type: "obstacle",
              x: 624,
              y: 468,
              width: 50,
              height: 50,
              spriteKey: "rock",
              properties: { blocking: true }
            }
          ],
          spawnConfiguration: {
            maxPlayers: 16,
            spawnRadius: 200,
            minSpacing: 0.4,
          },
          isActive: true,
          weight: 30,
        },
        {
          name: "Mystic Forest",
          background: "forest",
          description: "An enchanted forest with magical properties",
          difficulty: "hard",
          seed: 11111,
          centerX: 512,
          centerY: 384,
          features: [
            {
              type: "powerup",
              x: 450,
              y: 350,
              spriteKey: "magic_crystal",
              properties: { 
                effect: "luck_boost",
                amount: 25,
                duration: 30
              }
            },
            {
              type: "powerup",
              x: 574,
              y: 418,
              spriteKey: "magic_crystal",
              properties: { 
                effect: "luck_boost",
                amount: 25,
                duration: 30
              }
            },
            {
              type: "hazard",
              x: 512,
              y: 384,
              spriteKey: "void_zone",
              properties: {
                damage: 10,
                interval: 5000
              }
            }
          ],
          spawnConfiguration: {
            maxPlayers: 12,
            spawnRadius: 220,
            minSpacing: 0.6,
          },
          isActive: true,
          weight: 20,
        },
      ];

      for (const map of maps) {
        await ctx.db.insert("maps", map);
        mapsCreated++;
      }
    }

    console.log(`Seed data created: ${charactersCreated} characters, ${mapsCreated} maps`);
    
    return { 
      message: "Seed data created successfully",
      charactersCreated,
      mapsCreated
    };
  },
});