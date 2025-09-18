import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { getRandomCharacter, CHARACTERS } from '../config/characters';

interface Player {
    id: string;
    sprite: Phaser.GameObjects.Sprite;
    characterKey: string;
    displayName: string;
    betAmount: number;
    eliminated: boolean;
    targetX: number;
    targetY: number;
}

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    titleText: Phaser.GameObjects.Text;
    phaseText: Phaser.GameObjects.Text;
    players: Map<string, Player> = new Map();
    gameState: any = null;
    titleTween?: Phaser.Tweens.Tween;
    centerX: number = 512;
    centerY: number = 384;

    // Map to store which character each player is using
    private playerCharacters: Map<string, string> = new Map();

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

        // Update phase text
        this.updatePhaseDisplay(gameState);

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
        this.players.forEach((player, id) => {
            if (!currentIds.has(id)) {
                this.removePlayer(id);
            }
        });
    }

    private addPlayer(participant: any, index: number) {
        // Calculate spawn position (top of screen)
        const spawnX = 200 + (index * 120) + (Math.random() - 0.5) * 100;
        const spawnY = -50;

        // Get random character for this player
        const character = getRandomCharacter();
        const characterKey = character.key;

        // Store character choice for this player
        this.playerCharacters.set(participant._id, characterKey);

        // Create player sprite
        const sprite = this.add.sprite(spawnX, spawnY, characterKey);
        sprite.setDepth(100);
        sprite.play(`${characterKey}-idle`);

        // Calculate scale based on bet amount (0.001 SOL = 100%, up to 3 SOL)
        const scale = this.calculatePlayerScale(participant.betAmount);
        sprite.setScale(scale);

        // Calculate target position in circle around center
        const angle = (index * (Math.PI * 2)) / Math.max(8, this.gameState?.participants?.length || 1);
        const radius = 180;
        const targetX = this.centerX + Math.cos(angle) * radius;
        const targetY = this.centerY + Math.sin(angle) * radius;

        // Animate player dropping from top
        this.tweens.add({
            targets: sprite,
            x: targetX,
            y: targetY,
            duration: 1000,
            ease: 'Bounce.easeOut'
        });

        // Add player name text
        const nameText = this.add.text(targetX, targetY + 40, participant.displayName, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5).setDepth(110);

        // Store player data
        const player: Player = {
            id: participant._id,
            sprite,
            characterKey,
            displayName: participant.displayName,
            betAmount: participant.betAmount,
            eliminated: false,
            targetX,
            targetY
        };

        this.players.set(participant._id, player);

        // Update name text position when sprite moves
        this.tweens.add({
            targets: nameText,
            x: targetX,
            y: targetY + 40,
            duration: 1000,
            ease: 'Bounce.easeOut'
        });
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
            this.tweens.add({
                targets: player.sprite,
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
            player.sprite.destroy();
            this.players.delete(playerId);
            this.playerCharacters.delete(playerId);
        }
    }

    private movePlayersToCenter() {
        this.players.forEach((player) => {
            // Animate all players moving towards center
            this.tweens.add({
                targets: player.sprite,
                x: this.centerX + (Math.random() - 0.5) * 100,
                y: this.centerY + (Math.random() - 0.5) * 100,
                duration: 2000 + Math.random() * 1000,
                ease: 'Power2.easeInOut'
            });

            // Change to walking animation
            player.sprite.play(`${player.characterKey}-walk`);
        });
    }

    private showTop4Players(survivors: any[]) {
        // Highlight the top 4 survivors
        const top4 = survivors.slice(0, 4);

        this.players.forEach((player, id) => {
            const isTop4 = top4.some((s: any) => s._id === id);

            if (isTop4) {
                // Highlight top 4
                player.sprite.setTint(0xffd700); // Golden tint

                // Add glowing effect
                this.tweens.add({
                    targets: player.sprite,
                    alpha: { from: 1, to: 0.7 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
            } else {
                // Fade out eliminated players
                player.sprite.setTint(0x666666);
                player.sprite.setAlpha(0.3);
                player.eliminated = true;
            }
        });
    }

    private showBattlePhase() {
        // Animate battle between remaining players
        this.players.forEach((player) => {
            if (!player.eliminated) {
                // Battle animations - rapid movement
                this.tweens.add({
                    targets: player.sprite,
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
                winnerPlayer.sprite.setScale(winnerPlayer.sprite.scale * 1.5);

                // Victory animation
                this.tweens.add({
                    targets: winnerPlayer.sprite,
                    y: winnerPlayer.sprite.y - 50,
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

    private addPlayerWithFanfare(participant: any, index: number) {
        // Calculate spawn position (top of screen)
        const spawnX = 200 + (index * 120) + (Math.random() - 0.5) * 100;
        const spawnY = -50;

        // Get random character for this player
        const character = getRandomCharacter();
        const characterKey = character.key;

        // Store character choice
        this.playerCharacters.set(participant._id, characterKey);

        // Create player sprite
        const sprite = this.add.sprite(spawnX, spawnY, characterKey);
        sprite.setDepth(100);
        sprite.play(`${characterKey}-idle`);

        // Calculate scale
        const scale = this.calculatePlayerScale(participant.betAmount);
        sprite.setScale(scale);

        // Flash effect for new arrival
        sprite.setTint(0xffd700);
        this.time.delayedCall(200, () => sprite.clearTint());

        // Calculate target position
        const angle = (index * (Math.PI * 2)) / Math.max(8, this.players.size + 1);
        const radius = 180;
        const targetX = this.centerX + Math.cos(angle) * radius;
        const targetY = this.centerY + Math.sin(angle) * radius;

        // Animate with special entrance
        this.tweens.add({
            targets: sprite,
            x: targetX,
            y: targetY,
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

        // Add floating "NEW PLAYER!" text
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

        // Add player name
        const nameText = this.add.text(targetX, targetY + 40, participant.displayName, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5).setDepth(110);

        // Store player data
        const player: Player = {
            id: participant._id,
            sprite,
            characterKey,
            displayName: participant.displayName,
            betAmount: participant.betAmount,
            eliminated: false,
            targetX,
            targetY
        };

        this.players.set(participant._id, player);

        // Update name position when sprite moves
        this.tweens.add({
            targets: nameText,
            x: targetX,
            y: targetY + 40,
            duration: 1000,
            ease: 'Bounce.easeOut'
        });
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
