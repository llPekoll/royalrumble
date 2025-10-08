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
    const participantId = participant._id || participant.id;
    
    console.log('[PlayerManager] addParticipant called', {
      id: participantId,
      existingCount: this.participants.size,
      alreadyExists: this.participants.has(participantId)
    });
    
    // Double-check participant doesn't already exist
    if (this.participants.has(participantId)) {
      console.error('[PlayerManager] Participant already exists!', participantId);
      return;
    }
    
    const { targetX, targetY } = this.calculateSpawnPosition(participant.spawnIndex);
    const spawnX = targetX;
    const spawnY = -50;

    let characterKey = 'warrior';
    if (participant.character) {
      if (participant.character.key) {
        characterKey = participant.character.key;
      } else if (participant.character.name) {
        characterKey = participant.character.name.toLowerCase().replace(/\s+/g, '-');
      }
    }

    console.log('[PlayerManager] Creating container for', participantId);
    const container = this.scene.add.container(spawnX, spawnY);
    container.setDepth(100);
    let textureKey = characterKey;
    if (!this.scene.textures.exists(characterKey)) {
      textureKey = 'warrior';

      if (!this.scene.textures.exists('warrior')) {
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

    if (targetX > this.centerX) {
      sprite.setFlipX(true);
    }

    const animKey = `${textureKey}-idle`;
    if (this.scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }

    const scale = participant.size || this.calculateParticipantScale(participant.betAmount);
    const spriteHeight = 32 * scale;
    const nameYOffset = (spriteHeight / 2) + 30;
    
    // Style bot names differently
    const isBot = participant.isBot && !participant.playerId;
    const nameColor = isBot ? '#ffff99' : '#ffffff'; // Light yellow for bots
    const strokeColor = isBot ? '#666600' : '#000000'; // Darker yellow stroke for bots
    
    const nameText = this.scene.add.text(0, nameYOffset, participant.displayName, {
      fontFamily: 'Arial',
      fontSize: 12,
      color: nameColor,
      stroke: strokeColor,
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5);

    container.add([sprite, nameText]);
    sprite.setScale(scale);
    
    // Show names immediately in demo mode, hide in real games during spawn
    nameText.setVisible(isBot);
    sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (participant.colorHue !== undefined && !participant.isBot) {
      const hue = participant.colorHue / 360;
      const tint = Phaser.Display.Color.HSVToRGB(hue, 0.3, 1.0).color;
      sprite.setTint(tint);
    }
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

    this.scene.tweens.add({
      targets: container,
      y: targetY,
      duration: 1000,
      ease: 'Bounce.easeOut'
    });
    const gameParticipant: GameParticipant = {
      id: participantId,
      playerId: participant.playerId,
      container,
      sprite,
      nameText,
      characterKey: textureKey,
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

    this.participants.set(participantId, gameParticipant);
    console.log('[PlayerManager] Participant added successfully', {
      id: participantId,
      newCount: this.participants.size
    });
  }

  private calculateParticipantScale(betAmountInCoins: number): number {
    const minBet = 10;
    const maxBet = 10000;
    const minScale = 1.0;
    const maxScale = 2.0;
    const clampedBet = Math.max(minBet, Math.min(maxBet, betAmountInCoins));
    const scale = minScale + ((clampedBet - minBet) / (maxBet - minBet)) * (maxScale - minScale);
    return scale;
  }

  private calculateSpawnPosition(spawnIndex: number) {
    if (!this.currentMap || !this.currentMap.spawnConfiguration) {
      const angle = (spawnIndex / 20) * Math.PI * 2;
      const radius = 200;
      return {
        targetX: this.centerX + Math.cos(angle) * radius,
        targetY: this.centerY + Math.sin(angle) * radius
      };
    }

    const { spawnRadius } = this.currentMap.spawnConfiguration;
    const totalParticipants = Math.max(8, spawnIndex + 1);
    const angle = (spawnIndex / totalParticipants) * Math.PI * 2;
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
      // Show names when moving to center
      participant.nameText.setVisible(true);

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
