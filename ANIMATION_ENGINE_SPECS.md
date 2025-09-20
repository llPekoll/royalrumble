# Animation Engine Specifications

## Recommended: Phaser.js with WebGL

### Why Phaser?
- **Battle-tested**: Used by thousands of browser games
- **Perfect fit**: Designed specifically for 2D games like yours
- **Rich features**: Particles, physics, animations, all built-in
- **Performance**: WebGL rendering with Canvas fallback
- **Mobile ready**: Touch controls and responsive scaling

### Implementation with Phaser

```typescript
// game/GameScene.ts
import Phaser from 'phaser';

export class BattleArenaScene extends Phaser.Scene {
  private players: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private centerPoint: { x: number, y: number };

  constructor() {
    super({ key: 'BattleArena' });
  }

  preload() {
    // Load character sprites - multiple character types
    this.load.spritesheet('warrior', '/assets/characters/warrior.png', {
      frameWidth: 64,
      frameHeight: 64
    });
    this.load.spritesheet('mage', '/assets/characters/mage.png', {
      frameWidth: 64,
      frameHeight: 64
    });
    this.load.spritesheet('archer', '/assets/characters/archer.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    // Load effects
    this.load.spritesheet('explosion', '/assets/explosion.png', {
      frameWidth: 128,
      frameHeight: 128
    });

    // Load multiple map backgrounds
    this.load.image('arena_classic', '/assets/maps/arena_classic.png');
    this.load.image('arena_desert', '/assets/maps/arena_desert.png');
    this.load.image('arena_forest', '/assets/maps/arena_forest.png');
  }

  create(data: { mapId: string, participants: GameParticipant[] }) {
    // Set up arena based on selected map
    const mapKey = this.getMapKey(data.mapId);
    this.add.image(400, 300, mapKey);
    this.centerPoint = { x: 400, y: 300 };

    // Create animations for each character type
    const characterTypes = ['warrior', 'mage', 'archer'];
    characterTypes.forEach(charType => {
      this.anims.create({
        key: `${charType}_walk`,
        frames: this.anims.generateFrameNumbers(charType, { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1
      });

      this.anims.create({
        key: `${charType}_idle`,
        frames: this.anims.generateFrameNumbers(charType, { start: 8, end: 11 }),
        frameRate: 8,
        repeat: -1
      });

      this.anims.create({
        key: `${charType}_attack`,
        frames: this.anims.generateFrameNumbers(charType, { start: 12, end: 17 }),
        frameRate: 12,
        repeat: 0
      });
    });

    this.anims.create({
      key: 'explode',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 15 }),
      frameRate: 30,
      repeat: 0
    });
  }

  // Add game participant to arena (supports multiple per player)
  addParticipant(participantId: string, data: GameParticipantData) {
    // Use predefined spawn position based on participant index and map config
    const spawnPos = this.calculateSpawnPosition(data.spawnIndex, data.totalParticipants);
    const x = spawnPos.x;
    const y = spawnPos.y;

    // Create sprite with correct character type
    const sprite = this.add.sprite(x, y, data.characterType);

    // Scale based on bet amount (fat = higher bet)
    const scale = 1 + (data.betAmount / 1000) * 0.5; // Up to 1.5x size
    sprite.setScale(scale);

    // Set character variant
    sprite.setTint(data.characterColor);

    // Add name label
    const nameText = this.add.text(x, y - 40, data.name, {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    });
    nameText.setOrigin(0.5);

    // Store reference
    this.players.set(playerId, sprite);

    // Start idle animation
    sprite.play('idle');
  }

  // Phase 2: Move players to center
  moveToCenter(duration: number = 10000) {
    this.players.forEach((sprite, playerId) => {
      sprite.play('walk');

      this.tweens.add({
        targets: sprite,
        x: this.centerPoint.x + (Math.random() - 0.5) * 50,
        y: this.centerPoint.y + (Math.random() - 0.5) * 50,
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
          sprite.play('idle');
        }
      });
    });
  }

  // Phase 3: Elimination explosion
  performElimination(survivors: string[]) {
    // Create explosion effect at center
    const explosion = this.add.sprite(this.centerPoint.x, this.centerPoint.y, 'explosion');
    explosion.setScale(3);
    explosion.play('explode');

    // Camera shake
    this.cameras.main.shake(500, 0.02);

    // Particle effects
    const particles = this.add.particles(this.centerPoint.x, this.centerPoint.y, 'spark', {
      speed: { min: 200, max: 400 },
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 600,
      quantity: 30
    });

    // Eliminate non-survivors
    this.players.forEach((sprite, playerId) => {
      if (!survivors.includes(playerId)) {
        // Fade out eliminated players
        this.tweens.add({
          targets: sprite,
          alpha: 0.3,
          scale: sprite.scale * 0.5,
          duration: 1000,
          ease: 'Power2'
        });
      } else {
        // Survivors get bigger and glow
        sprite.setTint(0xffff00);
        this.tweens.add({
          targets: sprite,
          scale: sprite.scale * 1.2,
          duration: 500,
          yoyo: true,
          repeat: 2
        });
      }
    });

    // Clean up explosion
    explosion.on('animationcomplete', () => {
      explosion.destroy();
      particles.destroy();
    });
  }

  // Phase 5: Final battle animations
  performBattle(player1Id: string, player2Id: string, winnerId: string) {
    const player1 = this.players.get(player1Id);
    const player2 = this.players.get(player2Id);

    if (!player1 || !player2) return;

    // Move players to battle positions
    this.tweens.add({
      targets: player1,
      x: this.centerPoint.x - 100,
      y: this.centerPoint.y,
      duration: 1000
    });

    this.tweens.add({
      targets: player2,
      x: this.centerPoint.x + 100,
      y: this.centerPoint.y,
      duration: 1000,
      onComplete: () => {
        // Battle clash effect
        this.createBattleClash(player1, player2, winnerId === player1Id ? player1 : player2);
      }
    });
  }

  private createBattleClash(
    player1: Phaser.GameObjects.Sprite,
    player2: Phaser.GameObjects.Sprite,
    winner: Phaser.GameObjects.Sprite
  ) {
    // Create impact effect
    const impact = this.add.sprite(this.centerPoint.x, this.centerPoint.y, 'impact');
    impact.setScale(2);

    // Screen flash
    this.cameras.main.flash(200, 255, 255, 255);

    // Determine loser
    const loser = winner === player1 ? player2 : player1;

    // Loser gets knocked back and fades
    this.tweens.add({
      targets: loser,
      x: loser.x + (loser === player1 ? -200 : 200),
      y: loser.y - 50,
      rotation: loser === player1 ? -1 : 1,
      alpha: 0,
      duration: 1000,
      ease: 'Power3'
    });

    // Winner celebrates
    this.tweens.add({
      targets: winner,
      scale: winner.scale * 1.5,
      duration: 500,
      yoyo: true,
      repeat: 3
    });

    // Victory particles around winner
    this.add.particles(winner.x, winner.y, 'star', {
      speed: { min: 100, max: 200 },
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 1000,
      quantity: 5,
      frequency: 100
    });
  }
}

// game/GameConfig.ts
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL with Canvas fallback
  parent: 'game-container',
  width: 800,
  height: 600,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BattleArenaScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  }
};
```

### Integration with Next.js/React

```typescript
// components/GameCanvas.tsx
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '@/game/GameConfig';
import { useQuery, useSubscribe } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function GameCanvas() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const currentGame = useQuery(api.games.currentGame);

  useEffect(() => {
    // Initialize Phaser game
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game({
        ...gameConfig,
        parent: 'game-container',
        callbacks: {
          preBoot: (game) => {
            // Make game accessible to React
            window.phaserGame = game;
          }
        }
      });
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  // Update game based on Convex state
  useEffect(() => {
    if (!gameRef.current || !currentGame) return;

    const scene = gameRef.current.scene.getScene('BattleArena');

    // Update players
    currentGame.players.forEach(player => {
      scene.addPlayer(player.id, player);
    });

    // Handle phase transitions
    switch (currentGame.phase) {
      case 'arena':
        scene.moveToCenter();
        break;
      case 'elimination':
        scene.performElimination(currentGame.survivors);
        break;
      case 'battle':
        // Handle battle animations
        break;
    }
  }, [currentGame]);

  return <div id="game-container" className="w-full h-full" />;
}
```

## Alternative Options

### 1. PixiJS
```typescript
// Lighter weight, more control
import * as PIXI from 'pixi.js';

const app = new PIXI.Application({
  width: 800,
  height: 600,
  transparent: true,
  antialias: true
});

// Pros: Smaller bundle, pure rendering
// Cons: No game features, must build everything
```

### 2. Three.js (3D Option)
```typescript
// For 3D characters and effects
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);

// Pros: Amazing 3D effects, future-proof
// Cons: Overkill for 2D game, larger bundle
```

### 3. Canvas API + GSAP
```typescript
// Minimal approach with animation library
import { gsap } from 'gsap';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

gsap.to(player, {
  x: centerX,
  y: centerY,
  duration: 10,
  ease: "power2.inOut"
});

// Pros: Smallest bundle, full control
// Cons: Must implement everything manually
```

### 4. Lottie Animations
```typescript
// For pre-designed animations
import Lottie from 'lottie-react';
import explosionAnimation from './animations/explosion.json';

<Lottie animationData={explosionAnimation} />

// Pros: Designer-friendly, smooth animations
// Cons: Limited interactivity, large JSON files
```

## Performance Optimization

### Asset Management
```typescript
// Texture atlases for better performance
{
  "frames": {
    "character_idle_1": { "x": 0, "y": 0, "w": 64, "h": 64 },
    "character_idle_2": { "x": 64, "y": 0, "w": 64, "h": 64 },
    "character_walk_1": { "x": 128, "y": 0, "w": 64, "h": 64 }
  }
}
```

### Sprite Pooling
```typescript
class SpritePool {
  private pool: Phaser.GameObjects.Sprite[] = [];

  get(): Phaser.GameObjects.Sprite {
    return this.pool.pop() || this.createNew();
  }

  release(sprite: Phaser.GameObjects.Sprite) {
    sprite.setVisible(false);
    this.pool.push(sprite);
  }
}
```

### Mobile Optimization
```typescript
// Adaptive quality based on device
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

const config = {
  render: {
    pixelArt: isMobile, // Lower quality on mobile
    antialias: !isMobile
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 240 },
    max: { width: 1920, height: 1080 }
  }
};
```

## Animation Timeline

```typescript
// Precise timing for game phases
const PHASE_TIMINGS = {
  selection: { duration: 15000, animations: ['character_select', 'countdown'] },
  arena: { duration: 10000, animations: ['walk_to_center', 'crowd_cheer'] },
  elimination: { duration: 10000, animations: ['explosion', 'camera_shake', 'eliminate'] },
  betting: { duration: 10000, animations: ['highlight_survivors', 'bet_counter'] },
  battle: { duration: 10000, animations: ['battle_stance', 'clash', 'victory'] },
  results: { duration: 5000, animations: ['confetti', 'coin_rain', 'nft_mint'] }
};
```

## Visual Effects Library

```typescript
// Reusable effect components
export class VisualEffects {
  static coinRain(scene: Phaser.Scene, amount: number) {
    const coins = scene.physics.add.group({
      key: 'coin',
      quantity: amount,
      setXY: { x: 0, y: -50, stepX: 800 / amount }
    });

    coins.children.entries.forEach(coin => {
      coin.body.setVelocityY(200 + Math.random() * 100);
      coin.body.setBounceY(0.8);
    });
  }

  static characterGlow(sprite: Phaser.GameObjects.Sprite, color: number) {
    const fx = sprite.postFX.addGlow(color, 4, 0, false, 0.5, 10);

    scene.tweens.add({
      targets: fx,
      outerStrength: 8,
      duration: 1000,
      yoyo: true,
      repeat: -1
    });
  }

  static explosionRing(scene: Phaser.Scene, x: number, y: number) {
    const ring = scene.add.circle(x, y, 10, 0xffffff, 0.8);

    scene.tweens.add({
      targets: ring,
      radius: 300,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });
  }
}
```

## Recommended Setup

**Primary Engine**: Phaser.js
- Perfect for 2D battle game
- Rich ecosystem and documentation
- Built-in physics for collision detection
- WebGL performance with Canvas fallback
- Active community and regular updates

**Supporting Libraries**:
- GSAP for complex UI animations
- Lottie for special victory animations
- Howler.js for sound effects

**Asset Pipeline**:
- TexturePacker for sprite atlases
- Aseprite for pixel art characters
- After Effects + Bodymovin for Lottie animations

This setup provides the best balance of performance, features, and development speed for your Solana battle royale game.
