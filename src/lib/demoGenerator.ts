// Demo mode utilities - all client-side, no database
export const DEMO_BOT_NAMES = [
  "Shadow", "Blaze", "Frost", "Thunder", "Viper", "Phoenix", "Storm", "Titan",
  "Ghost", "Spark", "Crusher", "Ninja", "Savage", "Fury", "Chaos", "Doom",
  "Reaper", "Ace", "Nova", "Echo", "Bolt", "Striker", "Hunter", "Warrior"
];

export const CHARACTER_TYPES = [
  { name: "Warrior", color: "#ff4444" },
  { name: "Mage", color: "#4444ff" },
  { name: "Archer", color: "#44ff44" },
  { name: "Rogue", color: "#ff44ff" },
  { name: "Paladin", color: "#ffff44" },
  { name: "Necromancer", color: "#884488" }
];

export interface DemoParticipant {
  id: string;
  displayName: string;
  character: { name: string; color: string };
  colorHue: number;
  betAmount: number;
  size: number;
  power: number;
  position: { x: number; y: number };
  eliminated: false;
  isBot: true;
}

export function generateDemoParticipant(index: number, totalCount: number): DemoParticipant {
  // Random bot name
  const name = DEMO_BOT_NAMES[Math.floor(Math.random() * DEMO_BOT_NAMES.length)] + 
               Math.floor(Math.random() * 99);
  
  // Random character type
  const character = CHARACTER_TYPES[Math.floor(Math.random() * CHARACTER_TYPES.length)];
  
  // Random bet amount (50-500)
  const betAmount = Math.floor(Math.random() * 450) + 50;
  
  // Calculate spawn position in a circle
  const angleStep = (Math.PI * 2) / Math.max(totalCount, 8);
  const angle = index * angleStep + (Math.random() * 0.2 - 0.1); // Add some randomness
  const radius = 200 + Math.random() * 50; // Varied radius
  
  // Center of arena (assuming 800x600)
  const centerX = 400;
  const centerY = 300;
  
  return {
    id: `demo_${Date.now()}_${index}`,
    displayName: name,
    character,
    colorHue: Math.floor(Math.random() * 360),
    betAmount,
    size: Math.max(0.8, Math.min(2.0, betAmount / 500)),
    power: betAmount,
    position: {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    },
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