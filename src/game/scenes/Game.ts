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
  centerX: number = 0;
  centerY: number = 0;

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

    // Calculate proper center coordinates based on actual camera dimensions
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;

    // Background will be set when gameState is first updated
    // Use first available map texture as default, will be updated from game state
    const defaultTexture = 'arena_classic'; // This will be loaded from database
    this.background = this.add.image(this.centerX, this.centerY, defaultTexture);
    this.background.setOrigin(0.5, 0.5);
    this.background.setAlpha(1);

    // Initialize managers
    this.playerManager = new PlayerManager(this, this.centerX, this.centerY);
    this.animationManager = new AnimationManager(this, this.centerX, this.centerY);
    this.gamePhaseManager = new GamePhaseManager(this, this.playerManager, this.animationManager);
    this.uiManager = new UIManager(this, this.centerX);

    // Create UI elements
    this.uiManager.create();

    // Handle resize events to keep background centered
    this.scale.on('resize', this.handleResize, this);

    EventBus.emit('current-scene-ready', this);
  }

  handleResize() {
    // Update center coordinates when window is resized
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;

    // Reposition background
    this.background.setPosition(this.centerX, this.centerY);

    // Update managers with new center coordinates
    this.playerManager.updateCenter(this.centerX, this.centerY);
    this.animationManager.updateCenter(this.centerX, this.centerY);
    this.uiManager.updateCenter(this.centerX);
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
