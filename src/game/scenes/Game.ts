import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { PlayerManager } from '../managers/PlayerManager';
import { AnimationManager } from '../managers/AnimationManager';
import { GamePhaseManager } from '../managers/GamePhaseManager';
import { UIManager } from '../managers/UIManager';

export class Game extends Scene
{
    camera!: Phaser.Cameras.Scene2D.Camera;
    background!: Phaser.GameObjects.Image;
    gameState: any = null;
    centerX: number = 512;
    centerY: number = 384;

    // Managers
    private playerManager!: PlayerManager;
    private animationManager!: AnimationManager;
    private gamePhaseManager!: GamePhaseManager;
    private uiManager!: UIManager;

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

        // Initialize managers
        this.playerManager = new PlayerManager(this, this.centerX, this.centerY);
        this.animationManager = new AnimationManager(this, this.centerX, this.centerY);
        this.gamePhaseManager = new GamePhaseManager(this, this.playerManager, this.animationManager);
        this.uiManager = new UIManager(this, this.centerX, this.centerY);

        // Create UI elements
        this.uiManager.create();

        EventBus.emit('current-scene-ready', this);
    }

    // Update game state from Convex
    updateGameState(gameState: any) {
        this.gameState = gameState;

        if (!gameState) return;

        // Update UI
        this.uiManager.updateGameState(gameState);

        // Handle game phases
        this.gamePhaseManager.handleGamePhase(gameState);
    }

    // Public method for real-time player spawning
    public spawnPlayerImmediately(participant: any) {
        this.playerManager.spawnPlayerImmediately(participant);
    }

    // Add update method to continuously update the timer
    update() {
        this.uiManager.updateTimer();
    }

    changeScene ()
    {
        this.scene.start('GameOver');
    }
}
