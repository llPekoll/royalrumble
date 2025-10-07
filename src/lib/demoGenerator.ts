// Demo mode utilities - all client-side, no database
export const DEMO_BOT_NAMES = [
  "Shadow", "Blaze", "Frost", "Thunder", "Viper", "Phoenix", "Storm", "Titan",
  "Ghost", "Spark", "Crusher", "Ninja", "Savage", "Fury", "Chaos", "Doom",
  "Reaper", "Ace", "Nova", "Echo", "Bolt", "Striker", "Hunter", "Warrior"
];

export const DEMO_PARTICIPANT_COUNT = 20; // Always 20 for long game format

export interface DemoParticipant {
  _id: string; // Use _id to match database structure
  id: string; // Keep for backward compatibility
  displayName: string;
  character: any; // Full character object from database
  characterId?: any; // Optional for compatibility with Phaser
  colorHue: number;
  betAmount: number;
  size: number;
  power: number;
  position: { x: number; y: number };
  spawnIndex: number;
  eliminated: false;
  isBot: true;
}

export function generateDemoParticipant(
  index: number,
  totalCount: number,
  dbCharacters: any[], // Accept database characters as parameter
  mapConfig?: { spawnRadius: number; centerX: number; centerY: number }
): DemoParticipant {
  // Random bot name (ensure unique)
  const name = DEMO_BOT_NAMES[Math.floor(Math.random() * DEMO_BOT_NAMES.length)] +
               Math.floor(Math.random() * 999);

  // Random character type from database
  const character = dbCharacters[Math.floor(Math.random() * dbCharacters.length)];

  // Random bet amount (0.01 - 1 SOL equivalent, represented as 10-1000 coins)
  const betAmount = Math.floor(Math.random() * 990) + 10;

  // Calculate spawn position with MORE randomness
  const angleStep = (Math.PI * 2) / Math.max(totalCount, 8);
  const baseAngle = index * angleStep;
  // Much more angle variation (-0.3 to +0.3 radians = ~±17 degrees)
  const angleVariation = (Math.random() - 0.5) * 0.6;
  const angle = baseAngle + angleVariation;

  // Use map config if provided, otherwise use defaults
  const centerX = mapConfig?.centerX ?? 512;
  const centerY = mapConfig?.centerY ?? 384;
  const spawnRadius = mapConfig?.spawnRadius ?? 250;

  // Much larger radius variation (±80 pixels instead of ±20)
  const radiusVariation = (Math.random() - 0.5) * 160;
  const finalRadius = Math.max(150, spawnRadius + radiusVariation); // Ensure minimum radius

  const id = `demo_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    _id: id, // Primary id for database compatibility
    id, // Keep for backward compatibility
    displayName: name,
    character,
    colorHue: Math.floor(Math.random() * 360),
    betAmount,
    size: Math.max(0.8, Math.min(2.0, betAmount / 500)),
    power: betAmount,
    position: {
      x: centerX + Math.cos(angle) * finalRadius,
      y: centerY + Math.sin(angle) * finalRadius
    },
    spawnIndex: index,
    eliminated: false,
    isBot: true
  };
}

export function generateDemoWinner(participants: DemoParticipant[]): DemoParticipant {
  // Weighted random selection based on bet amounts
  const totalWeight = participants.reduce((sum, p) => sum + p.betAmount, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0;
  for (const participant of participants) {
    cumulative += participant.betAmount;
    if (random <= cumulative) {
      return participant;
    }
  }

  return participants[0]; // Fallback
}

/**
 * Generate random spawn intervals for bots
 * Creates varied timing instead of fixed 1.5s intervals
 * Total time will be approximately 30 seconds
 */
export function generateRandomSpawnIntervals(count: number, totalTime: number = 30000): number[] {
  const intervals: number[] = [];
  const minInterval = 800; // Minimum 0.8 seconds between spawns
  const maxInterval = 2500; // Maximum 2.5 seconds between spawns

  let remainingTime = totalTime;
  let remainingBots = count;

  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      // Last bot uses remaining time
      intervals.push(remainingTime);
    } else {
      // Calculate average time per remaining bot
      const avgTime = remainingTime / remainingBots;

      // Generate random interval around the average
      const randomInterval = Math.min(
        maxInterval,
        Math.max(minInterval, avgTime + (Math.random() - 0.5) * 1000)
      );

      intervals.push(randomInterval);
      remainingTime -= randomInterval;
      remainingBots--;
    }
  }

  return intervals;
}