import { Scene } from "phaser";
import { calculateEllipsePosition, SPAWN_CONFIG } from "../../config/spawnConfig";

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
  private readonly BASE_SCALE_MULTIPLIER = 3.0; // 5x bigger base size

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
    return Array.from(this.participants.values()).filter((p) => p.playerId === playerId);
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

    console.log("[PlayerManager] addParticipant called", {
      id: participantId,
      existingCount: this.participants.size,
      alreadyExists: this.participants.has(participantId),
    });

    // Double-check participant doesn't already exist
    if (this.participants.has(participantId)) {
      console.error("[PlayerManager] Participant already exists!", participantId);
      return;
    }

    const { targetX, targetY } = this.calculateSpawnPosition(participant.spawnIndex);
    const spawnX = targetX;
    const spawnY = -50;

    let characterKey = "warrior";
    if (participant.character) {
      if (participant.character.key) {
        characterKey = participant.character.key;
      } else if (participant.character.name) {
        characterKey = participant.character.name.toLowerCase().replace(/\s+/g, "-");
      }
    }

    console.log("[PlayerManager] Creating container for", participantId);
    const container = this.scene.add.container(spawnX, spawnY);

    // Set depth based on Y position - higher Y = further back = lower depth
    // This creates proper visual layering
    const baseDepth = 100;
    const depthFromY = Math.floor(targetY); // Use target Y position for depth
    container.setDepth(baseDepth + depthFromY);
    let textureKey = characterKey;
    if (!this.scene.textures.exists(characterKey)) {
      textureKey = "warrior";
    }

    const sprite = this.scene.add.sprite(0, 0, textureKey);

    // Set sprite origin to bottom-center for consistent positioning
    sprite.setOrigin(0.5, 1.0);

    if (targetX > this.centerX) {
      sprite.setFlipX(true);
    }

    const animKey = `${textureKey}-idle`;
    if (this.scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }

    // Apply base 5x multiplier + bet scaling FIRST
    const betScale = participant.size || this.calculateParticipantScale(participant.betAmount);
    const scale = betScale * this.BASE_SCALE_MULTIPLIER;
    sprite.setScale(scale);
    sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Character-specific Y offset adjustments (scales with sprite size)
    // These values are in original sprite pixels and will be scaled automatically
    const spriteOffsetsInPixels: { [key: string]: number } = {
      male: 48, // Transparent space at bottom in original sprite
      orc: 42, // Transparent space at bottom in original sprite
      soldier: 42, // Transparent space at bottom in original sprite
      // Add other characters here if needed
    };
    const offsetPixels = spriteOffsetsInPixels[textureKey] || 0;
    const scaledOffset = offsetPixels * scale;
    sprite.setY(scaledOffset);

    // With bottom-origin sprite, name goes below with consistent gap
    const nameYOffset = 10; // Fixed gap below sprite bottom

    // Style bot names differently
    const isBot = participant.isBot && !participant.playerId;
    const nameColor = isBot ? "#ffff99" : "#ffffff"; // Light yellow for bots
    const strokeColor = isBot ? "#666600" : "#000000"; // Darker yellow stroke for bots

    const nameText = this.scene.add
      .text(0, nameYOffset, participant.displayName, {
        fontFamily: "Arial",
        fontSize: 12,
        color: nameColor,
        stroke: strokeColor,
        strokeThickness: 2,
        align: "center",
      })
      .setOrigin(0.5);

    // Show names immediately in demo mode, hide in real games during spawn
    nameText.setVisible(isBot);

    // Add sprite first, then name text (render order matters)
    container.add(sprite);
    container.add(nameText);
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
      ease: "Cubic.easeOut", // Smooth landing with minimal bounce
      onComplete: () => {
        // Create dust impact effect when character lands
        const dustSprite = this.scene.add.sprite(targetX, targetY, "dust");
        dustSprite.setOrigin(0.5, 1.0); // Bottom-center anchor (same as character)
        dustSprite.setScale(scale * 0.4); // Scale dust relative to character size
        dustSprite.setDepth(baseDepth + depthFromY - 1); // Just behind the character
        dustSprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST); // Keep pixel art crisp

        if (this.scene.anims.exists("dust-impact")) {
          dustSprite.play("dust-impact");
        }

        // Destroy dust sprite after animation completes
        dustSprite.once("animationcomplete", () => {
          dustSprite.destroy();
        });

        // Wait 1 second then play sand step sound when character hits the ground
        this.scene.time.delayedCall(1000, () => {
          try {
            console.log(`[PlayerManager] Playing sand-step sound for ${participantId}`);
            this.scene.sound.play("sand-step", { volume: 0.4 });
          } catch (e) {
            console.error("[PlayerManager] Failed to play sand-step sound:", e);
          }
        });
      },
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
      spawnIndex: participant.spawnIndex,
    };

    this.participants.set(participantId, gameParticipant);
    console.log("[PlayerManager] Participant added successfully", {
      id: participantId,
      newCount: this.participants.size,
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
      // Use ellipse position with randomness
      const position = calculateEllipsePosition(angle, radius, this.centerX, this.centerY, true);
      return {
        targetX: position.x,
        targetY: position.y,
      };
    }

    const { spawnRadius } = this.currentMap.spawnConfiguration;
    const totalParticipants = Math.max(8, spawnIndex + 1);
    const angle = (spawnIndex / totalParticipants) * Math.PI * 2;

    // calculateEllipsePosition handles all randomness via jitter
    const position = calculateEllipsePosition(angle, spawnRadius, this.centerX, this.centerY, true);
    return {
      targetX: position.x,
      targetY: position.y,
    };
  }

  updateParticipantData(participant: any) {
    const gameParticipant = this.participants.get(participant._id);
    if (gameParticipant) {
      // Update scale if bet amount changed (apply base multiplier)
      const betScale = participant.size || this.calculateParticipantScale(participant.betAmount);
      const newScale = betScale * this.BASE_SCALE_MULTIPLIER;
      if (gameParticipant.size !== newScale) {
        gameParticipant.size = newScale;
        gameParticipant.betAmount = participant.betAmount;

        // Scale only the sprite, not the text
        this.scene.tweens.add({
          targets: gameParticipant.sprite,
          scaleX: newScale,
          scaleY: newScale,
          duration: 300,
          ease: "Power2",
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
        ease: "Power2.easeInOut",
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
        participant.nameText.setColor("#ffd700"); // Golden name

        // Add glowing effect to container (affects both sprite and text)
        this.scene.tweens.add({
          targets: participant.container,
          alpha: { from: 1, to: 0.7 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      } else {
        // Fade out eliminated participants
        participant.sprite.setTint(0x666666);
        participant.container.setAlpha(0.3); // Fades both sprite and text
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
          ease: "Power2.easeInOut",
          repeat: 5,
          yoyo: true,
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
    // Find winner - get directly from PlayerManager using winnerId
    const winnerId = gameState.winnerId;

    console.log("[PlayerManager] showResults called", {
      winnerId,
      participantIds: Array.from(this.participants.keys()),
      hasWinner: this.participants.has(winnerId),
    });

    const winnerParticipant = this.participants.get(winnerId);

    if (winnerParticipant) {
      // Hide all other participants first
      this.participants.forEach((participant, id) => {
        if (id !== winnerId) {
          // Fade out losers
          this.scene.tweens.add({
            targets: participant.container,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              participant.container.setVisible(false);
            },
          });
        }
      });

      // Move winner to center of screen
      this.scene.tweens.add({
        targets: winnerParticipant.container,
        x: this.centerX,
        y: this.centerY,
        duration: 1000,
        ease: "Power2.easeInOut",
      });

      // Scale up the winner sprite
      this.scene.tweens.add({
        targets: winnerParticipant.sprite,
        scaleX: winnerParticipant.sprite.scaleX * 2,
        scaleY: winnerParticipant.sprite.scaleY * 2,
        duration: 1000,
        ease: "Back.easeOut",
      });

      // Make winner golden
      winnerParticipant.sprite.setTint(0xffd700);
      winnerParticipant.nameText.setColor("#ffd700");
      winnerParticipant.nameText.setFontSize(20);
      winnerParticipant.nameText.setStroke("#000000", 4);

      // Victory animation
      const victoryAnimKey = `${winnerParticipant.characterKey}-idle`;
      if (this.scene.anims.exists(victoryAnimKey)) {
        winnerParticipant.sprite.play(victoryAnimKey);
      }

      console.log("[PlayerManager] Returning winner participant:", winnerParticipant.id);
      return winnerParticipant;
    }

    console.error("[PlayerManager] Winner participant not found for ID:", winnerId);
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
    this.participants.forEach((participant) => {
      participant.container.destroy();
    });
    this.participants.clear();
  }
}
