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

  updateCenter(centerX: number, centerY: number) {
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
        this.updateParticipantData(participant);
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

  addParticipant(participant: any, withFanfare: boolean = false) {
    // Calculate spawn position based on map configuration and spawn index
    const { targetX, targetY } = this.calculateSpawnPosition(participant.spawnIndex);
    const spawnX = targetX;
    const spawnY = -50; // Above the screen

    // Get character key (prioritize character.key, fallback to name)
    let characterKey = 'warrior'; // Default fallback
    if (participant.character) {
      if (participant.character.key) {
        characterKey = participant.character.key;
      } else if (participant.character.name) {
        characterKey = participant.character.name.toLowerCase().replace(/\s+/g, '-');
      }
    }

    console.log(`🎭 Spawning ${participant.displayName} as ${characterKey}`, participant.character);

    // Create a container to hold both sprite and name
    const container = this.scene.add.container(spawnX, spawnY);
    container.setDepth(100);

    // Create participant sprite (position relative to container)
    // First check if the texture exists, if not use default
    let textureKey = characterKey;
    if (!this.scene.textures.exists(characterKey)) {
      console.warn(`Texture '${characterKey}' not found, using default 'warrior'`);
      textureKey = 'warrior';

      // If even warrior doesn't exist, create a fallback colored rectangle
      if (!this.scene.textures.exists('warrior')) {
        console.warn("Default 'warrior' texture not found, creating fallback rectangle");
        if (!this.scene.textures.exists('fallback-sprite')) {
          this.scene.add.graphics()
            .fillStyle(0x00ff00, 1)
            .fillRect(0, 0, 32, 32)
            .generateTexture('fallback-sprite', 32, 32);
        }
        textureKey = 'fallback-sprite';
      }
    }

    const sprite = this.scene.add.sprite(0, 0, textureKey);

    // Mirror sprite if spawning on the right side of the screen (facing center)
    if (targetX > this.centerX) {
      sprite.setFlipX(true);
    }

    // Only play animation if it exists
    const animKey = `${textureKey}-idle`;
    if (this.scene.anims.exists(animKey)) {
      sprite.play(animKey);
    } else {
      console.warn(`Animation '${animKey}' not found, sprite will remain static`);
    }

    // Use size from database or calculate scale based on bet amount
    const scale = participant.size || this.calculateParticipantScale(participant.betAmount);

    // Calculate name position based on sprite size to prevent overlap
    // Assuming sprite base height is ~32px, scaled by the size multiplier
    const spriteHeight = 32 * scale;
    const nameYOffset = (spriteHeight / 2) + 20; // Half sprite height + 20px gap

    // Create name text (positioned below sprite, relative to container)
    const nameText = this.scene.add.text(0, nameYOffset, participant.displayName, {
      fontFamily: 'Arial',
      fontSize: 12, // Slightly smaller for less clutter
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5);

    // Add both sprite and text to container
    container.add([sprite, nameText]);

    // Scale only the sprite, not the text
    sprite.setScale(scale);

    // Show names during spawning for demo mode (helps identify bots)
    // In real games, names show player identity
    nameText.setVisible(true);

    // Keep pixel art crisp when scaling
    sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Apply color tint if specified and not a bot
    if (participant.colorHue !== undefined && !participant.isBot) {
      const hue = participant.colorHue / 360; // Convert to 0-1 range
      const tint = Phaser.Display.Color.HSVToRGB(hue, 0.3, 1.0).color; // Reduced saturation
      sprite.setTint(tint);
    }

    // Note: Removed "BOT" label for cleaner UI - name is sufficient

    // Add flash effect for late joiners (fanfare)
    if (withFanfare) {
      sprite.setTint(0xffd700);
      this.scene.time.delayedCall(200, () => {
        if (participant.colorHue !== undefined && !participant.isBot) {
          const hue = participant.colorHue / 360;
          const tint = Phaser.Display.Color.HSVToRGB(hue, 0.3, 1.0).color;
          sprite.setTint(tint);
        } else {
          sprite.clearTint();
        }
      });
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
      characterKey: textureKey, // Use the actual texture key that was loaded
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

  updateParticipantData(participant: any) {
    const gameParticipant = this.participants.get(participant._id);
    if (gameParticipant) {
      // Update scale if bet amount changed
      const newScale = participant.size || this.calculateParticipantScale(participant.betAmount);
      if (gameParticipant.size !== newScale) {
        gameParticipant.size = newScale;
        gameParticipant.betAmount = participant.betAmount;

        // Scale only the sprite, not the text
        this.scene.tweens.add({
          targets: gameParticipant.sprite,
          scaleX: newScale,
          scaleY: newScale,
          duration: 300,
          ease: 'Power2'
        });
      }

      // Update tint - simple logic
      if (participant.colorHue !== undefined && !participant.isBot) {
        const hue = participant.colorHue / 360;
        const tint = Phaser.Display.Color.HSVToRGB(hue, 0.3, 1.0).color;
        gameParticipant.sprite.setTint(tint);
      } else {
        gameParticipant.sprite.clearTint();
      }

      // Update elimination status from backend
      gameParticipant.eliminated = participant.eliminated || false;
    }
  }

  updateParticipantScale(participant: any) {
    // Legacy method for backward compatibility
    this.updateParticipantData(participant);
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
      // Names already visible - just animate movement

      // Animate container moving towards center (sprite and text move together)
      this.scene.tweens.add({
        targets: participant.container,
        x: this.centerX + (Math.random() - 0.5) * 100,
        y: this.centerY + (Math.random() - 0.5) * 100,
        duration: 800 + Math.random() * 400,
        ease: 'Power2.easeInOut'
      });

      // Change to walking animation
      const walkAnimKey = `${participant.characterKey}-walk`;
      if (this.scene.anims.exists(walkAnimKey)) {
        participant.sprite.play(walkAnimKey);
      }
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
        const attackAnimKey = `${participant.characterKey}-attack`;
        if (this.scene.anims.exists(attackAnimKey)) {
          participant.sprite.play(attackAnimKey);
        }
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
        const victoryAnimKey = `${winnerParticipant.characterKey}-idle`;
        if (this.scene.anims.exists(victoryAnimKey)) {
          winnerParticipant.sprite.play(victoryAnimKey);
        }

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

    // Add new participant with fanfare effect (golden flash)
    this.addParticipant(participant, true);
  }

  // Update participants in any phase (not just waiting)
  updateParticipants(participants: any[]) {
    // Update existing participants with new data from backend
    participants.forEach((participant: any) => {
      const gameParticipant = this.participants.get(participant._id);
      if (gameParticipant) {
        // Update elimination status and other data
        gameParticipant.eliminated = participant.eliminated || false;
        gameParticipant.betAmount = participant.betAmount;
      }
    });
  }

  clearParticipants() {
    this.participants.forEach(participant => {
      participant.container.destroy();
    });
    this.participants.clear();
  }
}
