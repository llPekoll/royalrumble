import { Scene } from 'phaser';
import { getRandomCharacter } from '../config/characters';

export interface Player {
    id: string;
    container: Phaser.GameObjects.Container;
    sprite: Phaser.GameObjects.Sprite;
    nameText: Phaser.GameObjects.Text;
    characterKey: string;
    displayName: string;
    betAmount: number;
    eliminated: boolean;
    targetX: number;
    targetY: number;
}

export class PlayerManager {
    private scene: Scene;
    private players: Map<string, Player> = new Map();
    private playerCharacters: Map<string, string> = new Map();
    private usedAngles: number[] = [];
    private centerX: number;
    private centerY: number;

    constructor(scene: Scene, centerX: number, centerY: number) {
        this.scene = scene;
        this.centerX = centerX;
        this.centerY = centerY;
    }

    getPlayers(): Map<string, Player> {
        return this.players;
    }

    getPlayer(id: string): Player | undefined {
        return this.players.get(id);
    }

    updatePlayersInWaiting(participants: any[]) {
        // Add new players or update existing ones
        participants.forEach((participant: any, index: number) => {
            if (!this.players.has(participant._id)) {
                this.addPlayer(participant, index);
            } else {
                this.updatePlayerScale(participant);
            }
        });

        // Remove players who left
        const currentIds = new Set(participants.map((p: any) => p._id));
        this.players.forEach((_player, id) => {
            if (!currentIds.has(id)) {
                this.removePlayer(id);
            }
        });
    }

    addPlayer(participant: any, _index: number) {
        // Use spawn position from database if available
        let targetX, targetY, spawnX, spawnY;
        
        if (participant.position) {
            // Use database position
            targetX = participant.position.x;
            targetY = participant.position.y;
            spawnX = targetX;  // Same X as final position
            spawnY = -50;      // Above the screen
        } else {
            // Fallback to old random logic
            const angle = this.getRandomAngleWithSpacing();
            const radiusVariation = (Math.random() - 0.5) * 40;
            const radius = 180 + radiusVariation;
            const angleOffset = (Math.random() - 0.5) * 0.2;
            const finalAngle = angle + angleOffset;
            targetX = this.centerX + Math.cos(finalAngle) * radius;
            targetY = this.centerY + Math.sin(finalAngle) * radius;
            spawnX = targetX;
            spawnY = -50;
        }

        // Get character from database or fallback to random
        let characterKey;
        if (participant.character && participant.character.spriteKey) {
            characterKey = participant.character.spriteKey;
        } else {
            // Fallback to old random character selection
            const character = getRandomCharacter();
            characterKey = character.key;
        }

        // Store character choice for this player
        this.playerCharacters.set(participant._id, characterKey);

        // Create a container to hold both sprite and name
        const container = this.scene.add.container(spawnX, spawnY);
        container.setDepth(100);

        // Create player sprite (position relative to container)
        const sprite = this.scene.add.sprite(0, 0, characterKey);
        sprite.play(`${characterKey}-idle`);

        // Calculate scale based on bet amount
        const scale = this.calculatePlayerScale(participant.betAmount);

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

        // Animate container dropping straight down (sprite and text move together)
        this.scene.tweens.add({
            targets: container,
            y: targetY,  // Only animate Y, X stays the same
            duration: 1000,
            ease: 'Bounce.easeOut'
        });

        // Store player data
        const player: Player = {
            id: participant._id,
            container,
            sprite,
            nameText,
            characterKey,
            displayName: participant.displayName,
            betAmount: participant.betAmount,
            eliminated: false,
            targetX,
            targetY
        };

        this.players.set(participant._id, player);
    }

    private calculatePlayerScale(betAmountInCoins: number): number {
        // Convert coins to SOL (1000 coins = 1 SOL)
        const betInSol = betAmountInCoins / 1000;

        // Base scale at 0.001 SOL (1 coin) = 1.0 (100%)
        // Max scale at 3 SOL (3000 coins) = 3.0 (300%)
        const minBet = 0.001;
        const maxBet = 3;
        const minScale = 1.0;
        const maxScale = 3.0;

        // Clamp bet amount
        const clampedBet = Math.max(minBet, Math.min(maxBet, betInSol));

        // Linear scaling
        const scale = minScale + ((clampedBet - minBet) / (maxBet - minBet)) * (maxScale - minScale);

        return scale;
    }

    updatePlayerScale(participant: any) {
        const player = this.players.get(participant._id);
        if (player) {
            const newScale = this.calculatePlayerScale(participant.betAmount);
            // Scale only the sprite, not the text
            this.scene.tweens.add({
                targets: player.sprite,
                scaleX: newScale,
                scaleY: newScale,
                duration: 300,
                ease: 'Power2'
            });
        }
    }

    removePlayer(playerId: string) {
        const player = this.players.get(playerId);
        if (player) {
            // Destroying the container automatically destroys all children
            player.container.destroy();
            this.players.delete(playerId);
            this.playerCharacters.delete(playerId);
        }
    }

    private getRandomAngleWithSpacing(): number {
        const minSpacing = 0.5; // Minimum radians between players (~28 degrees)
        let attempts = 0;
        let angle: number;

        do {
            angle = Math.random() * Math.PI * 2;
            attempts++;

            // If we've tried too many times, just use the random angle
            if (attempts > 20) break;

            // Check if angle is far enough from existing angles
            const isFarEnough = this.usedAngles.every(usedAngle => {
                const diff = Math.abs(angle - usedAngle);
                // Account for wrap-around (e.g., 0 and 2π are close)
                const minDiff = Math.min(diff, 2 * Math.PI - diff);
                return minDiff >= minSpacing;
            });

            if (isFarEnough) break;
        } while (attempts < 20);

        // Store this angle for future spacing checks
        this.usedAngles.push(angle);

        // Clean up old angles if we have too many (in case players left)
        if (this.usedAngles.length > this.players.size + 5) {
            this.usedAngles = this.usedAngles.slice(-10);
        }

        return angle;
    }

    movePlayersToCenter() {
        this.players.forEach((player) => {
            // Animate container moving towards center (sprite and text move together)
            this.scene.tweens.add({
                targets: player.container,
                x: this.centerX + (Math.random() - 0.5) * 100,
                y: this.centerY + (Math.random() - 0.5) * 100,
                duration: 2000 + Math.random() * 1000,
                ease: 'Power2.easeInOut'
            });

            // Change to walking animation
            player.sprite.play(`${player.characterKey}-walk`);
        });
    }

    showTop4Players(survivors: any[]) {
        // Highlight the top 4 finalists (only called when 8+ players)
        const finalists = survivors.slice(0, 4);

        this.players.forEach((player, id) => {
            const isFinalist = finalists.some((s: any) => s._id === id);

            if (isFinalist) {
                // Highlight finalists
                player.sprite.setTint(0xffd700); // Golden tint
                player.nameText.setColor('#ffd700'); // Golden name

                // Add glowing effect to container (affects both sprite and text)
                this.scene.tweens.add({
                    targets: player.container,
                    alpha: { from: 1, to: 0.7 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
            } else {
                // Fade out eliminated players
                player.sprite.setTint(0x666666);
                player.container.setAlpha(0.3);  // Fades both sprite and text
                player.eliminated = true;
            }
        });

        // Clear used angles when moving to betting phase
        this.usedAngles = [];
    }

    showBattlePhase() {
        // Animate battle between remaining players
        this.players.forEach((player) => {
            if (!player.eliminated) {
                // Battle animations - rapid movement of container
                this.scene.tweens.add({
                    targets: player.container,
                    x: this.centerX + (Math.random() - 0.5) * 200,
                    y: this.centerY + (Math.random() - 0.5) * 200,
                    duration: 300,
                    ease: 'Power2.easeInOut',
                    repeat: 5,
                    yoyo: true
                });
            }
        });
    }

    showResults(gameState: any) {
        // Find winner - check for winnerId in game state
        const winnerId = gameState.winnerId;
        const winner = gameState.participants?.find((p: any) => p._id === winnerId);

        if (winner) {
            // Hide all other players first
            this.players.forEach((player, id) => {
                if (id !== winner._id) {
                    // Fade out losers
                    this.scene.tweens.add({
                        targets: player.container,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            player.container.setVisible(false);
                        }
                    });
                }
            });

            const winnerPlayer = this.players.get(winner._id);
            if (winnerPlayer) {
                // Move winner to center of screen
                this.scene.tweens.add({
                    targets: winnerPlayer.container,
                    x: this.centerX,
                    y: this.centerY,
                    duration: 1000,
                    ease: 'Power2.easeInOut'
                });

                // Scale up the winner sprite
                this.scene.tweens.add({
                    targets: winnerPlayer.sprite,
                    scaleX: winnerPlayer.sprite.scaleX * 2,
                    scaleY: winnerPlayer.sprite.scaleY * 2,
                    duration: 1000,
                    ease: 'Back.easeOut'
                });

                // Make winner golden
                winnerPlayer.sprite.setTint(0xffd700);
                winnerPlayer.nameText.setColor('#ffd700');
                winnerPlayer.nameText.setFontSize(20);
                winnerPlayer.nameText.setStroke('#000000', 4);

                return winnerPlayer;
            }
        }
        return null;
    }

    spawnPlayerImmediately(participant: any) {
        // Check if player already exists
        if (this.players.has(participant._id)) {
            // Update existing player's bet amount/scale
            this.updatePlayerScale(participant);
            return;
        }

        // Add new player with special effects
        const index = this.players.size;
        this.addPlayerWithFanfare(participant, index);
    }

    private addPlayerWithFanfare(participant: any, _index: number) {
        // Generate a random angle with some spacing from other players
        const angle = this.getRandomAngleWithSpacing();

        // Add some radius variation for more natural placement
        const radiusVariation = (Math.random() - 0.5) * 40; // ±20 pixels
        const radius = 180 + radiusVariation;

        // Calculate target position with some additional randomness
        const angleOffset = (Math.random() - 0.5) * 0.2; // Small angle variation
        const finalAngle = angle + angleOffset;
        const targetX = this.centerX + Math.cos(finalAngle) * radius;
        const targetY = this.centerY + Math.sin(finalAngle) * radius;

        // Spawn directly above the target position (same X)
        const spawnX = targetX;  // Same X as final position
        const spawnY = -50;      // Above the screen

        // Get random character for this player
        const character = getRandomCharacter();
        const characterKey = character.key;

        // Store character choice
        this.playerCharacters.set(participant._id, characterKey);

        // Create a container to hold both sprite and name
        const container = this.scene.add.container(spawnX, spawnY);
        container.setDepth(100);

        // Create player sprite (position relative to container)
        const sprite = this.scene.add.sprite(0, 0, characterKey);
        sprite.play(`${characterKey}-idle`);

        // Calculate scale
        const scale = this.calculatePlayerScale(participant.betAmount);

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

        // Flash effect for new arrival
        sprite.setTint(0xffd700);
        this.scene.time.delayedCall(200, () => sprite.clearTint());

        // Animate container straight down with special entrance
        this.scene.tweens.add({
            targets: container,
            y: targetY,  // Only animate Y, X stays the same
            duration: 1000,
            ease: 'Bounce.easeOut',
            onStart: () => {
                // Particle effect at spawn point
                this.scene.add.particles(spawnX, spawnY, 'star', {
                    lifespan: 600,
                    speed: { min: 100, max: 200 },
                    scale: { start: 0.5, end: 0 },
                    tint: 0xffd700,
                    blendMode: 'ADD'
                });
            }
        });

        // Add floating "NEW PLAYER!" text (at spawn position)
        const newPlayerText = this.scene.add.text(spawnX, spawnY - 30, 'NEW PLAYER!', {
            fontFamily: 'Arial Black',
            fontSize: 16,
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(200);

        // Animate and fade out the text
        this.scene.tweens.add({
            targets: newPlayerText,
            y: spawnY - 60,
            alpha: 0,
            duration: 1500,
            onComplete: () => newPlayerText.destroy()
        });

        // Store player data
        const player: Player = {
            id: participant._id,
            container,
            sprite,
            nameText,
            characterKey,
            displayName: participant.displayName,
            betAmount: participant.betAmount,
            eliminated: false,
            targetX,
            targetY
        };

        this.players.set(participant._id, player);
    }

    resetUsedAngles() {
        this.usedAngles = [];
    }
}