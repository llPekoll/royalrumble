import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { getRandomCharacter } from '../config/characters';

interface Player {
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

export class Game extends Scene
{
    camera!: Phaser.Cameras.Scene2D.Camera;
    background!: Phaser.GameObjects.Image;
    titleText!: Phaser.GameObjects.Text;
    phaseText!: Phaser.GameObjects.Text;
    timerText!: Phaser.GameObjects.Text;
    timerBackground!: Phaser.GameObjects.Rectangle;
    players: Map<string, Player> = new Map();
    gameState: any = null;
    titleTween?: Phaser.Tweens.Tween;
    centerX: number = 512;
    centerY: number = 384;

    // Map to store which character each player is using
    private playerCharacters: Map<string, string> = new Map();
    // Store used angles to avoid overlapping
    private usedAngles: number[] = [];

    constructor ()
    {
        super('RoyalRumble');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x1a1a2e);

        // Randomly select arena background
        const arenaKey = Math.random() < 0.5 ? 'arena' : 'arena2';
        this.background = this.add.image(this.centerX, this.centerY, arenaKey);
        this.background.setAlpha(0.8);

        // Show title for 2 seconds then disappear
        this.titleText = this.add.text(this.centerX, 150, '🏆 ROYAL RUMBLE 🏆', {
            fontFamily: 'Arial Black',
            fontSize: 48,
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(200);

        // Animate title appearance and disappearance
        this.titleText.setScale(0);
        this.titleTween = this.tweens.add({
            targets: this.titleText,
            scale: { from: 0, to: 1.2 },
            duration: 500,
            ease: 'Back.easeOut',
            yoyo: true,
            hold: 1500,
            onComplete: () => {
                this.titleText.setVisible(false);
            }
        });

        // Phase indicator (always visible after title)
        this.phaseText = this.add.text(this.centerX, 50, '', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setDepth(150);

        // Timer background
        this.timerBackground = this.add.rectangle(this.centerX, 100, 140, 50, 0x000000, 0.7);
        this.timerBackground.setStrokeStyle(3, 0xffd700);
        this.timerBackground.setDepth(149);

        // Timer display
        this.timerText = this.add.text(this.centerX, 100, '0:00', {
            fontFamily: 'Arial Black',
            fontSize: 32,
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(151);

        // Debug: Scene name at bottom
        this.add.text(this.centerX, 750, 'Scene: RoyalRumble', {
            fontFamily: 'Arial', fontSize: 16, color: '#ffff00',
            stroke: '#000000', strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5).setDepth(1000);

        EventBus.emit('current-scene-ready', this);
    }

    // Update game state from Convex
    updateGameState(gameState: any) {
        this.gameState = gameState;

        if (!gameState) return;

        // Update phase text and timer
        this.updatePhaseDisplay(gameState);
        this.updateTimer();

        // Reset used angles when starting a new game
        if (gameState.status === 'waiting' && this.players.size === 0) {
            this.usedAngles = [];
        }

        // Update players based on game phase
        if (gameState.status === 'waiting') {
            this.updatePlayersInWaiting(gameState.participants || []);
        } else if (gameState.status === 'arena') {
            this.movePlayersToCenter();
        } else if (gameState.status === 'betting') {
            this.showTop4Players(gameState.participants?.filter((p: any) => !p.eliminated) || []);
        } else if (gameState.status === 'battle') {
            this.showBattlePhase();
        } else if (gameState.status === 'results') {
            this.showResults(gameState);
        }
    }

    private updatePhaseDisplay(gameState: any) {
        const phaseNames: { [key: string]: string } = {
            'waiting': '⏳ Waiting for Players',
            'arena': '🏃‍♂️ Running to Center',
            'betting': '💰 Betting on Top 4',
            'battle': '⚔️ Final Battle',
            'results': '🏆 Results'
        };

        const phaseName = phaseNames[gameState.status] || 'Game Phase';
        this.phaseText.setText(`${phaseName} (${gameState.phase}/5)`);
    }

    private updatePlayersInWaiting(participants: any[]) {
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

    private addPlayer(participant: any, _index: number) {
        // Generate a random angle with some spacing from other players
        let angle = this.getRandomAngleWithSpacing();

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

        // Store character choice for this player
        this.playerCharacters.set(participant._id, characterKey);

        // Create a container to hold both sprite and name
        const container = this.add.container(spawnX, spawnY);
        container.setDepth(100);

        // Create player sprite (position relative to container)
        const sprite = this.add.sprite(0, 0, characterKey);
        sprite.play(`${characterKey}-idle`);

        // Calculate scale based on bet amount
        const scale = this.calculatePlayerScale(participant.betAmount);

        // Create name text (positioned below sprite, relative to container)
        const nameText = this.add.text(0, 40, participant.displayName, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);

        // Add both sprite and text to container
        container.add([sprite, nameText]);
        container.setScale(scale);

        // Animate container dropping straight down (sprite and text move together)
        this.tweens.add({
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

    private updatePlayerScale(participant: any) {
        const player = this.players.get(participant._id);
        if (player) {
            const newScale = this.calculatePlayerScale(participant.betAmount);
            // Scale the container, which scales both sprite and text
            this.tweens.add({
                targets: player.container,
                scaleX: newScale,
                scaleY: newScale,
                duration: 300,
                ease: 'Power2'
            });
        }
    }

    private removePlayer(playerId: string) {
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

    private movePlayersToCenter() {
        this.players.forEach((player) => {
            // Animate container moving towards center (sprite and text move together)
            this.tweens.add({
                targets: player.container,
                x: this.centerX + (Math.random() - 0.5) * 100,
                y: this.centerY + (Math.random() - 0.5) * 100,
                duration: 2000 + Math.random() * 1000,
                ease: 'Power2.easeInOut'
            });

            // Change to walking animation
            player.sprite.play(`${player.characterKey}-walk`);
        });

        // Schedule explosions 6 seconds before the arena phase ends
        // Arena phase is 10 seconds, so trigger at 4 seconds (4000ms)
        this.time.delayedCall(4000, () => {
            this.createExplosionsSequence();
        });
    }

    private createExplosionsSequence() {
        const createExplosion = (delay: number = 0) => {
            this.time.delayedCall(delay, () => {
                // Random position around center
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 150;
                
                const explosion = this.add.sprite(
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
                    this.cameras.main.shake(200, 0.01);
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

    private showTop4Players(survivors: any[]) {
        // Highlight the top 4 survivors
        const top4 = survivors.slice(0, 4);

        this.players.forEach((player, id) => {
            const isTop4 = top4.some((s: any) => s._id === id);

            if (isTop4) {
                // Highlight top 4
                player.sprite.setTint(0xffd700); // Golden tint
                player.nameText.setColor('#ffd700'); // Golden name

                // Add glowing effect to container (affects both sprite and text)
                this.tweens.add({
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

    private showBattlePhase() {
        // Animate battle between remaining players
        this.players.forEach((player) => {
            if (!player.eliminated) {
                // Battle animations - rapid movement of container
                this.tweens.add({
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

    private showResults(gameState: any) {
        // Find winner
        const winner = gameState.participants?.find((p: any) => p.winner);

        if (winner) {
            const winnerPlayer = this.players.get(winner._id);
            if (winnerPlayer) {
                // Winner celebration
                winnerPlayer.sprite.setTint(0xffd700);
                winnerPlayer.nameText.setColor('#ffd700');
                winnerPlayer.container.setScale(winnerPlayer.container.scale * 1.5);

                // Victory animation for container
                this.tweens.add({
                    targets: winnerPlayer.container,
                    y: winnerPlayer.container.y - 50,
                    duration: 1000,
                    ease: 'Bounce.easeOut'
                });

                // Victory text
                const victoryText = this.add.text(this.centerX, 200, `🏆 ${winner.displayName} WINS! 🏆`, {
                    fontFamily: 'Arial Black',
                    fontSize: 36,
                    color: '#ffd700',
                    stroke: '#000000',
                    strokeThickness: 4,
                    align: 'center'
                }).setOrigin(0.5).setDepth(200);

                // Animate victory text
                victoryText.setScale(0);
                this.tweens.add({
                    targets: victoryText,
                    scale: { from: 0, to: 1 },
                    duration: 500,
                    ease: 'Back.easeOut'
                });
            }
        }
    }

    // Public method for real-time player spawning
    public spawnPlayerImmediately(participant: any) {
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
        let angle = this.getRandomAngleWithSpacing();

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
        const container = this.add.container(spawnX, spawnY);
        container.setDepth(100);

        // Create player sprite (position relative to container)
        const sprite = this.add.sprite(0, 0, characterKey);
        sprite.play(`${characterKey}-idle`);

        // Calculate scale
        const scale = this.calculatePlayerScale(participant.betAmount);

        // Create name text (positioned below sprite, relative to container)
        const nameText = this.add.text(0, 40, participant.displayName, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5);

        // Add both sprite and text to container
        container.add([sprite, nameText]);
        container.setScale(scale);

        // Flash effect for new arrival
        sprite.setTint(0xffd700);
        this.time.delayedCall(200, () => sprite.clearTint());

        // Animate container straight down with special entrance
        this.tweens.add({
            targets: container,
            y: targetY,  // Only animate Y, X stays the same
            duration: 1000,
            ease: 'Bounce.easeOut',
            onStart: () => {
                // Particle effect at spawn point
                this.add.particles(spawnX, spawnY, 'star', {
                    lifespan: 600,
                    speed: { min: 100, max: 200 },
                    scale: { start: 0.5, end: 0 },
                    tint: 0xffd700,
                    blendMode: 'ADD'
                });
            }
        });

        // Add floating "NEW PLAYER!" text (at spawn position)
        const newPlayerText = this.add.text(spawnX, spawnY - 30, 'NEW PLAYER!', {
            fontFamily: 'Arial Black',
            fontSize: 16,
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(200);

        // Animate and fade out the text
        this.tweens.add({
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

    // Add update method to continuously update the timer
    update() {
        this.updateTimer();
    }

    private updateTimer() {
        if (!this.gameState || !this.gameState.nextPhaseTime) return;

        const currentTime = Date.now();
        const timeRemaining = Math.max(0, this.gameState.nextPhaseTime - currentTime);
        const seconds = Math.ceil(timeRemaining / 1000);
        
        // Format time as M:SS
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeText = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        this.timerText.setText(timeText);
        
        // Change color based on time remaining
        if (seconds <= 5) {
            this.timerText.setColor('#ff0000'); // Red for urgent
            this.timerBackground.setStrokeStyle(3, 0xff0000);
            // Pulse effect for last 5 seconds
            const scale = 1 + Math.sin(currentTime * 0.01) * 0.1;
            this.timerText.setScale(scale);
        } else if (seconds <= 10) {
            this.timerText.setColor('#ffff00'); // Yellow for warning
            this.timerBackground.setStrokeStyle(3, 0xffff00);
            this.timerText.setScale(1);
        } else {
            this.timerText.setColor('#00ff00'); // Green for normal
            this.timerBackground.setStrokeStyle(3, 0x00ff00);
            this.timerText.setScale(1);
        }
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
