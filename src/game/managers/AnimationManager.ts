import { Scene } from 'phaser';
import { GameParticipant } from './PlayerManager';

export class AnimationManager {
  private scene: Scene;
  private centerX: number;
  private centerY: number;

  // Physics configuration for explosion - TWEAK THESE VALUES
  private readonly EXPLOSION_CONFIG = {
    forceMin: 150,          // Minimum outward force (increased for more sideways)
    forceMax: 250,          // Maximum outward force (increased for more sideways)
    upwardKickMin: 200,     // Minimum upward boost (increased for more height)
    upwardKickMax: 400,     // Maximum upward boost (increased for more height)
    upwardKickChance: 0.8,  // Chance to apply upward kick (increased to 80%)
    gravity: 150,           // Gravity force (higher = falls faster)
    rotationSpeed: 10,      // Max rotation speed
    fadeStartTime: 1.5,     // When to start fading (seconds)
    fadeRate: 0.3,          // How fast to fade (0-1 per second)
    maxLifetime: 5,         // Maximum lifetime (seconds)
    showDebugTrails: true   // Set to true to see red trail lines
  };

  constructor(scene: Scene, centerX: number, centerY: number) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
  }

  updateCenter(centerX: number, centerY: number) {
    this.centerX = centerX;
    this.centerY = centerY;
  }

  createExplosionsSequence() {
    const createExplosion = (delay: number = 0) => {
      this.scene.time.delayedCall(delay, () => {
        // Random position around center
        const offsetX = (Math.random() - 0.5) * 150;
        const offsetY = (Math.random() - 0.5) * 150;

        const explosion = this.scene.add.sprite(
          this.centerX + offsetX,
          this.centerY + offsetY,
          'explosion'
        );

        // Scale up the explosion for dramatic effect
        explosion.setScale(2 + Math.random());
        explosion.setDepth(150);

        // Play explosion animation
        if (this.scene.anims.exists('explosion')) {
          explosion.play('explosion');
        }

        // Remove sprite after animation completes
        explosion.once('animationcomplete', () => {
          explosion.destroy();
        });

        // Screen shake for impact
        if (delay === 0) {
          this.scene.cameras.main.shake(200, 0.01);
        }
      });
    };

    // Create multiple explosions over time
    createExplosion(0);
    createExplosion(300);
    createExplosion(600);
    createExplosion(900);
    createExplosion(1200);
  }

  addWinnerCelebration(winnerPlayer: GameParticipant, winner: any) {
    // Victory text above winner
    const victoryText = this.scene.add.text(this.centerX, this.centerY - 120, '🏆 WINNER! 🏆', {
      fontFamily: 'Arial Black',
      fontSize: 48,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center'
    }).setOrigin(0.5).setDepth(200);

    // Winner name below
    const nameText = this.scene.add.text(this.centerX, this.centerY + 100, winner.displayName, {
      fontFamily: 'Arial Black',
      fontSize: 32,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5).setDepth(200);

    // Bet amount text
    const betText = this.scene.add.text(this.centerX, this.centerY + 140, `Bet: ${winner.betAmount} coins`, {
      fontFamily: 'Arial',
      fontSize: 20,
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5).setDepth(200);

    // Animate victory text
    victoryText.setScale(0);
    this.scene.tweens.add({
      targets: victoryText,
      scale: { from: 0, to: 1 },
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Pulse animation for victory text
    this.scene.tweens.add({
      targets: victoryText,
      scale: { from: 1, to: 1.2 },
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay: 500
    });

    // Animate name and bet text
    nameText.setAlpha(0);
    betText.setAlpha(0);

    this.scene.tweens.add({
      targets: nameText,
      alpha: 1,
      duration: 500,
      delay: 300
    });

    this.scene.tweens.add({
      targets: betText,
      alpha: 1,
      duration: 500,
      delay: 500
    });

    // Bounce animation for winner sprite
    this.scene.tweens.add({
      targets: winnerPlayer.container,
      y: this.centerY - 20,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Add confetti particles
    this.createConfetti();
  }

  createConfetti() {
    // Create confetti particle effect
    const colors = [0xffd700, 0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00];

    for (let i = 0; i < 50; i++) {
      const x = Math.random() * (this.scene.game.config.width as number);
      const startY = -50;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const confetti = this.scene.add.rectangle(x, startY, 8, 12, color);
      confetti.setDepth(250);

      // Animate confetti falling
      this.scene.tweens.add({
        targets: confetti,
        y: (this.scene.game.config.height as number) + 50,
        x: x + (Math.random() - 0.5) * 200,
        angle: Math.random() * 720,
        duration: 2000 + Math.random() * 2000,
        ease: 'Linear',
        delay: Math.random() * 1000,
        onComplete: () => {
          confetti.destroy();
        }
      });
    }
  }

  createCenterExplosion() {
    // Create a single large explosion at center
    const explosion = this.scene.add.sprite(
      this.centerX,
      this.centerY,
      'explosion'
    );

    explosion.setScale(3);
    explosion.setDepth(150);
    if (this.scene.anims.exists('explosion')) {
      explosion.play('explosion');
    }

    explosion.once('animationcomplete', () => {
      explosion.destroy();
    });

    // Screen shake for impact
    this.scene.cameras.main.shake(300, 0.02);
  }

  explodeParticipantsOutward(participants: Map<string, any>) {
    const config = this.EXPLOSION_CONFIG;

    // Create explosion at center first
    this.createCenterExplosion();

    // Apply physics to each participant
    participants.forEach((participant) => {
      if (!participant.container || !participant.container.active) return;

      // Calculate angle from center to participant
      const dx = participant.container.x - this.centerX;
      const dy = participant.container.y - this.centerY;
      const angle = Math.atan2(dy, dx);

      // Random force using config values
      const forceMultiplier = config.forceMin + Math.random() * (config.forceMax - config.forceMin);

      // Initial velocity components
      const velocityX = Math.cos(angle) * forceMultiplier;
      const velocityY = Math.sin(angle) * forceMultiplier;

      // Add random upward kick for some particles (like they got punched up)
      const upwardKick = Math.random() > config.upwardKickChance ? 0 :
        -(config.upwardKickMin + Math.random() * (config.upwardKickMax - config.upwardKickMin));

      // Random rotation speed
      const rotationSpeed = (Math.random() - 0.5) * config.rotationSpeed * 2;

      // Store initial values for physics simulation
      const currentVelocityX = velocityX;
      let currentVelocityY = velocityY + upwardKick;
      let elapsedTime = 0;

      // Add debug trail only if enabled
      let debugTrail: Phaser.GameObjects.Graphics | null = null;
      if (config.showDebugTrails) {
        debugTrail = this.scene.add.graphics();
        debugTrail.lineStyle(2, 0xff0000, 0.5);
        debugTrail.moveTo(participant.container.x, participant.container.y);
        debugTrail.setDepth(50);
      }

      // Create physics update loop
      const physicsUpdate = this.scene.time.addEvent({
        delay: 16, // ~60fps
        repeat: -1,
        callback: () => {
          if (!participant.container || !participant.container.active) {
            physicsUpdate.remove();
            if (debugTrail) debugTrail.destroy();
            return;
          }

          const deltaTime = 0.016; // 16ms in seconds
          elapsedTime += deltaTime;

          // Apply gravity to Y velocity
          currentVelocityY += config.gravity * deltaTime;

          // Update position
          participant.container.x += currentVelocityX * deltaTime;
          participant.container.y += currentVelocityY * deltaTime;

          // Draw debug trail if enabled
          if (debugTrail) {
            debugTrail.lineTo(participant.container.x, participant.container.y);
          }

          // Apply rotation to sprite only, not the container
          if (participant.sprite) {
            participant.sprite.angle += rotationSpeed;
          }

          // Keep full opacity - no fading
          // participant.container.alpha stays at 1

          // Remove when off screen or after max lifetime
          const gameWidth = this.scene.game.config.width as number;
          const gameHeight = this.scene.game.config.height as number;

          const isOffScreen = participant.container.x < -100 ||
            participant.container.x > gameWidth + 100 ||
            participant.container.y > gameHeight + 100 ||
            elapsedTime > config.maxLifetime;

          if (isOffScreen) {
            physicsUpdate.remove();
            participant.container.setVisible(false);
            participant.container.setActive(false);

            // Fade out debug trail if it exists
            if (debugTrail) {
              this.scene.tweens.add({
                targets: debugTrail,
                alpha: 0,
                duration: 1000,
                onComplete: () => debugTrail.destroy()
              });
            }
          }
        }
      });

      // Add some visual effects during explosion
      this.scene.tweens.add({
        targets: participant.sprite,
        scaleX: participant.sprite.scaleX * 1.2,
        scaleY: participant.sprite.scaleY * 1.2,
        duration: 200,
        ease: 'Power2'
      });
    });

    // Add extra particle effects
    this.createExplosionParticles();
  }

  private createExplosionParticles() {
    // Create debris particles that fly out
    const particleCount = 20;
    const colors = [0xff0000, 0xffff00, 0xff8800, 0xffffff];

    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.rectangle(
        this.centerX,
        this.centerY,
        4 + Math.random() * 8,
        4 + Math.random() * 8,
        colors[Math.floor(Math.random() * colors.length)]
      );
      particle.setDepth(140);

      const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.5;
      const speed = 200 + Math.random() * 400;
      const lifetime = 1000 + Math.random() * 1000;

      this.scene.tweens.add({
        targets: particle,
        x: this.centerX + Math.cos(angle) * speed,
        y: this.centerY + Math.sin(angle) * speed + Math.random() * 200,
        alpha: 0,
        angle: Math.random() * 720,
        duration: lifetime,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  showBettingPrompt() {
    // Show betting phase indicator
    const bettingText = this.scene.add.text(this.centerX, 50, 'BETTING PHASE', {
      fontFamily: 'Arial Black',
      fontSize: 32,
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5).setDepth(200);

    // Pulse animation
    this.scene.tweens.add({
      targets: bettingText,
      scale: { from: 1, to: 1.2 },
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Remove after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      bettingText.destroy();
    });
  }

  createBattleEffects() {
    // Create multiple small explosions during battle
    const createBattleExplosion = (delay: number) => {
      this.scene.time.delayedCall(delay, () => {
        const x = this.centerX + (Math.random() - 0.5) * 200;
        const y = this.centerY + (Math.random() - 0.5) * 200;

        const explosion = this.scene.add.sprite(x, y, 'explosion');
        explosion.setScale(1.5);
        explosion.setDepth(120);
        if (this.scene.anims.exists('explosion')) {
          explosion.play('explosion');
        }

        explosion.once('animationcomplete', () => {
          explosion.destroy();
        });
      });
    };

    // Create battle explosions over time
    for (let i = 0; i < 8; i++) {
      createBattleExplosion(i * 500);
    }

    // Screen shake throughout battle
    this.scene.cameras.main.shake(3000, 0.005);
  }

  createFinalExplosion() {
    // Create the biggest explosion for battle finale
    const explosion = this.scene.add.sprite(
      this.centerX,
      this.centerY,
      'explosion'
    );

    explosion.setScale(4);
    explosion.setDepth(150);
    if (this.scene.anims.exists('explosion')) {
      explosion.play('explosion');
    }

    explosion.once('animationcomplete', () => {
      explosion.destroy();
    });

    // Biggest screen shake
    this.scene.cameras.main.shake(500, 0.03);
  }
}
