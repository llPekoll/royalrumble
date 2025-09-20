import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { PlayerManager } from '../managers/PlayerManager';
import { AnimationManager } from '../managers/AnimationManager';
import { GamePhaseManager } from '../managers/GamePhaseManager';
import { UIManager } from '../managers/UIManager';

export class Game extends Scene {
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

  constructor() {
    super('RoyalRumble');
  }

  create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x1a1a2e);

    // Background will be set when gameState is first updated
    this.background = this.add.image(this.centerX, this.centerY, 'arena');
    this.background.setAlpha(0.8);

    // Initialize managers
    this.playerManager = new PlayerManager(this, this.centerX, this.centerY);
    this.animationManager = new AnimationManager(this, this.centerX, this.centerY);
    this.gamePhaseManager = new GamePhaseManager(this, this.playerManager, this.animationManager);
    this.uiManager = new UIManager(this, this.centerX);

    // Create UI elements
    this.uiManager.create();

    EventBus.emit('current-scene-ready', this);
  }

  // Update game state from Convex
  updateGameState(gameState: any) {
    this.gameState = gameState;

    if (!gameState) return;

    // Update map background based on game data
    if (gameState.map && gameState.map.background) {
      this.background.setTexture(gameState.map.background);
      
      // Update center position if map specifies it
      if (gameState.map.centerX && gameState.map.centerY) {
        this.centerX = gameState.map.centerX;
        this.centerY = gameState.map.centerY;
        this.background.setPosition(this.centerX, this.centerY);
      }
    }

    // Update UI
    this.uiManager.updateGameState(gameState);

    // Handle game phases
    this.gamePhaseManager.handleGamePhase(gameState);
  }

  // Public method for real-time participant spawning
  public spawnParticipantImmediately(participant: any) {
    this.playerManager.spawnParticipantImmediately(participant);
  }

  // Add update method to continuously update the timer
  update() {
    this.uiManager.updateTimer();
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
