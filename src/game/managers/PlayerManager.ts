import { Scene } from 'phaser';

export interface GameParticipant {
  id: string;
  playerId?: string;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  characterKey: string;
  displayName: string;
  betAmount: number;
  size: number;
  colorHue?: number;
  isBot: boolean;
  eliminated: boolean;
  targetX: number;
  targetY: number;
  spawnIndex: number;
}

export class PlayerManager {
  private scene: Scene;
  private participants: Map<string, GameParticipant> = new Map();
  private centerX: number;
  private centerY: number;
  private currentMap: any = null;

  constructor(scene: Scene, centerX: number, centerY: number) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
  }

  getParticipants(): Map<string, GameParticipant> {
    return this.participants;
  }

  getParticipant(id: string): GameParticipant | undefined {
    return this.participants.get(id);
  }

  // Get all participants for a specific player
  getPlayerParticipants(playerId: string): GameParticipant[] {
    return Array.from(this.participants.values()).filter(p => p.playerId === playerId);
  }

  updateParticipantsInWaiting(participants: any[], mapData: any) {
    this.currentMap = mapData;

    // Add new participants or update existing ones
    participants.forEach((participant: any) => {
      if (!this.participants.has(participant._id)) {
        this.addParticipant(participant);
      } else {
        this.updateParticipantScale(participant);
      }
    });

    // Remove participants who left
    const currentIds = new Set(participants.map((p: any) => p._id));
    this.participants.forEach((_participant, id) => {
      if (!currentIds.has(id)) {
        this.removeParticipant(id);
      }
    });
  }

  addParticipant(participant: any) {
    // Calculate spawn position based on map configuration and spawn index
    const { targetX, targetY } = this.calculateSpawnPosition(participant.spawnIndex);
    const spawnX = targetX;
    const spawnY = -50; // Above the screen

    // Get character from database
    let characterKey = 'warrior'; // Default fallback
    if (participant.character && participant.character.spriteKey) {
      characterKey = participant.character.spriteKey;
    }

    // Create a container to hold both sprite and name
    const container = this.scene.add.container(spawnX, spawnY);
    container.setDepth(100);

    // Create participant sprite (position relative to container)
    const sprite = this.scene.add.sprite(0, 0, characterKey);
    sprite.play(`${characterKey}-idle`);

    // Use size from database or calculate scale based on bet amount
    const scale = participant.size || this.calculateParticipantScale(participant.betAmount);

    // Create name text (positioned below sprite, relative to container)
    const nameText = this.scene.add.text(0, 40, participant.displayName, {
      fontFamily: 'Arial',
      fontSize: 14,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5);

    // Add both sprite and text to container
    container.add([sprite, nameText]);

    // Scale only the sprite, not the text
    sprite.setScale(scale);

    // Apply color tint if specified
    if (participant.colorHue !== undefined) {
      const hue = participant.colorHue / 360; // Convert to 0-1 range
      const tint = Phaser.Display.Color.HSVToRGB(hue, 0.8, 1.0).color;
      sprite.setTint(tint);
    }

    // Add bot indicator for bots
    if (participant.isBot) {
      const botText = this.scene.add.text(0, -40, 'BOT', {
        fontFamily: 'Arial',
        fontSize: 10,
        color: '#888888',
        stroke: '#000000',
        strokeThickness: 1,
        align: 'center'
      }).setOrigin(0.5);
      container.add(botText);
    }

    // Animate container dropping straight down (sprite and text move together)
    this.scene.tweens.add({
      targets: container,
      y: targetY,  // Only animate Y, X stays the same
      duration: 1000,
      ease: 'Bounce.easeOut'
    });

    // Store participant data
    const gameParticipant: GameParticipant = {
      id: participant._id,
      playerId: participant.playerId,
      container,
      sprite,
      nameText,
      characterKey,
      displayName: participant.displayName,
      betAmount: participant.betAmount,
      size: scale,
      colorHue: participant.colorHue,
      isBot: participant.isBot || false,
      eliminated: participant.eliminated || false,
      targetX,
      targetY,
      spawnIndex: participant.spawnIndex
    };

    this.participants.set(participant._id, gameParticipant);
  }

  private calculateParticipantScale(betAmountInCoins: number): number {
    // Base scale at 10 coins = 1.0 (100%)
    // Max scale at 10000 coins = 2.0 (200%)
    const minBet = 10;
    const maxBet = 10000;
    const minScale = 1.0;
    const maxScale = 2.0;

    // Clamp bet amount
    const clampedBet = Math.max(minBet, Math.min(maxBet, betAmountInCoins));

    // Linear scaling
    const scale = minScale + ((clampedBet - minBet) / (maxBet - minBet)) * (maxScale - minScale);

    return scale;
  }

  // Calculate spawn position based on map configuration and spawn index
  private calculateSpawnPosition(spawnIndex: number) {
    if (!this.currentMap || !this.currentMap.spawnConfiguration) {
      // Fallback to simple circular arrangement
      const angle = (spawnIndex / 20) * Math.PI * 2;
      const radius = 200;
      return {
        targetX: this.centerX + Math.cos(angle) * radius,
        targetY: this.centerY + Math.sin(angle) * radius
      };
    }

    const { spawnRadius } = this.currentMap.spawnConfiguration;
    const totalParticipants = Math.max(8, spawnIndex + 1); // Ensure at least 8 for proper spacing
    const angle = (spawnIndex / totalParticipants) * Math.PI * 2;

    // Add some variation for more natural positioning
    const radiusVariation = (Math.random() - 0.5) * 40;
    const angleVariation = (Math.random() - 0.5) * 0.2;

    const finalRadius = spawnRadius + radiusVariation;
    const finalAngle = angle + angleVariation;

    return {
      targetX: this.centerX + Math.cos(finalAngle) * finalRadius,
      targetY: this.centerY + Math.sin(finalAngle) * finalRadius
    };
  }

  updateParticipantScale(participant: any) {
    const gameParticipant = this.participants.get(participant._id);
    if (gameParticipant) {
      const newScale = participant.size || this.calculateParticipantScale(participant.betAmount);
      gameParticipant.size = newScale;

      // Scale only the sprite, not the text
      this.scene.tweens.add({
        targets: gameParticipant.sprite,
        scaleX: newScale,
        scaleY: newScale,
        duration: 300,
        ease: 'Power2'
      });
    }
  }

  removeParticipant(participantId: string) {
    const participant = this.participants.get(participantId);
    if (participant) {
      // Destroying the container automatically destroys all children
      participant.container.destroy();
      this.participants.delete(participantId);
    }
  }

  moveParticipantsToCenter() {
    this.participants.forEach((participant) => {
      // Animate container moving towards center (sprite and text move together)
      this.scene.tweens.add({
        targets: participant.container,
        x: this.centerX + (Math.random() - 0.5) * 100,
        y: this.centerY + (Math.random() - 0.5) * 100,
        duration: 2000 + Math.random() * 1000,
        ease: 'Power2.easeInOut'
      });

      // Change to walking animation
      participant.sprite.play(`${participant.characterKey}-walk`);
    });
  }

  showSurvivors(survivorIds: string[]) {
    // Highlight the survivors (only called for large games)
    this.participants.forEach((participant, id) => {
      const isSurvivor = survivorIds.includes(id);

      if (isSurvivor) {
        // Highlight survivors
        participant.sprite.setTint(0xffd700); // Golden tint
        participant.nameText.setColor('#ffd700'); // Golden name

        // Add glowing effect to container (affects both sprite and text)
        this.scene.tweens.add({
          targets: participant.container,
          alpha: { from: 1, to: 0.7 },
          duration: 500,
          yoyo: true,
          repeat: -1
        });
      } else {
        // Fade out eliminated participants
        participant.sprite.setTint(0x666666);
        participant.container.setAlpha(0.3);  // Fades both sprite and text
        participant.eliminated = true;
      }
    });
  }

  showBattlePhase() {
    // Animate battle between remaining participants
    this.participants.forEach((participant) => {
      if (!participant.eliminated) {
        // Battle animations - rapid movement of container
        this.scene.tweens.add({
          targets: participant.container,
          x: this.centerX + (Math.random() - 0.5) * 200,
          y: this.centerY + (Math.random() - 0.5) * 200,
          duration: 300,
          ease: 'Power2.easeInOut',
          repeat: 5,
          yoyo: true
        });

        // Change to attack animation
        participant.sprite.play(`${participant.characterKey}-attack`);
      }
    });
  }

  showResults(gameState: any) {
    // Find winner - check for winnerId in game state
    const winnerId = gameState.winnerId;
    const winner = gameState.participants?.find((p: any) => p._id === winnerId);

    if (winner) {
      // Hide all other participants first
      this.participants.forEach((participant, id) => {
        if (id !== winner._id) {
          // Fade out losers
          this.scene.tweens.add({
            targets: participant.container,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              participant.container.setVisible(false);
            }
          });
        }
      });

      const winnerParticipant = this.participants.get(winner._id);
      if (winnerParticipant) {
        // Move winner to center of screen
        this.scene.tweens.add({
          targets: winnerParticipant.container,
          x: this.centerX,
          y: this.centerY,
          duration: 1000,
          ease: 'Power2.easeInOut'
        });

        // Scale up the winner sprite
        this.scene.tweens.add({
          targets: winnerParticipant.sprite,
          scaleX: winnerParticipant.sprite.scaleX * 2,
          scaleY: winnerParticipant.sprite.scaleY * 2,
          duration: 1000,
          ease: 'Back.easeOut'
        });

        // Make winner golden
        winnerParticipant.sprite.setTint(0xffd700);
        winnerParticipant.nameText.setColor('#ffd700');
        winnerParticipant.nameText.setFontSize(20);
        winnerParticipant.nameText.setStroke('#000000', 4);

        // Victory animation
        winnerParticipant.sprite.play(`${winnerParticipant.characterKey}-idle`);

        return winnerParticipant;
      }
    }
    return null;
  }

  spawnParticipantImmediately(participant: any) {
    // Check if participant already exists
    if (this.participants.has(participant._id)) {
      // Update existing participant's bet amount/scale
      this.updateParticipantScale(participant);
      return;
    }

    // Add new participant with special effects
    this.addParticipantWithFanfare(participant);
  }

  private addParticipantWithFanfare(participant: any) {
    // Calculate spawn position
    const { targetX, targetY } = this.calculateSpawnPosition(participant.spawnIndex);
    const spawnX = targetX;
    const spawnY = -50;

    // Get character
    let characterKey = 'warrior';
    if (participant.character && participant.character.spriteKey) {
      characterKey = participant.character.spriteKey;
    }

    // Create container
    const container = this.scene.add.container(spawnX, spawnY);
    container.setDepth(100);

    // Create sprite
    const sprite = this.scene.add.sprite(0, 0, characterKey);
    sprite.play(`${characterKey}-idle`);

    // Calculate scale
    const scale = participant.size || this.calculateParticipantScale(participant.betAmount);

    // Create name text
    const nameText = this.scene.add.text(0, 40, participant.displayName, {
      fontFamily: 'Arial',
      fontSize: 14,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5);

    // Add to container
    container.add([sprite, nameText]);
    sprite.setScale(scale);

    // Apply color tint if specified
    if (participant.colorHue !== undefined) {
      const hue = participant.colorHue / 360;
      const tint = Phaser.Display.Color.HSVToRGB(hue, 0.8, 1.0).color;
      sprite.setTint(tint);
    }

    // Flash effect for new arrival
    sprite.setTint(0xffd700);
    this.scene.time.delayedCall(200, () => {
      if (participant.colorHue !== undefined) {
        const hue = participant.colorHue / 360;
        const tint = Phaser.Display.Color.HSVToRGB(hue, 0.8, 1.0).color;
        sprite.setTint(tint);
      } else {
        sprite.clearTint();
      }
    });

    // Animate container drop
    this.scene.tweens.add({
      targets: container,
      y: targetY,
      duration: 1000,
      ease: 'Bounce.easeOut'
    });

    // Store participant data
    const gameParticipant: GameParticipant = {
      id: participant._id,
      playerId: participant.playerId,
      container,
      sprite,
      nameText,
      characterKey,
      displayName: participant.displayName,
      betAmount: participant.betAmount,
      size: scale,
      colorHue: participant.colorHue,
      isBot: participant.isBot || false,
      eliminated: participant.eliminated || false,
      targetX,
      targetY,
      spawnIndex: participant.spawnIndex
    };

    this.participants.set(participant._id, gameParticipant);
  }

  clearParticipants() {
    this.participants.forEach(participant => {
      participant.container.destroy();
    });
    this.participants.clear();
  }
}
