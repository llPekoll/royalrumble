import { Scene } from 'phaser';
import { Player } from './PlayerManager';

export class AnimationManager {
  private scene: Scene;
  private centerX: number;
  private centerY: number;

  constructor(scene: Scene, centerX: number, centerY: number) {
    this.scene = scene;
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
        explosion.play('explosion');

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

  addWinnerCelebration(winnerPlayer: Player, winner: any) {
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
}
