import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerManager } from "../managers/PlayerManager";
import { AnimationManager } from "../managers/AnimationManager";

/**
 * DemoScene - Pure client-side demo mode
 *
 * Features:
 * - 20 bots spawning with random timing
 * - Random map selection
 * - 3 phases: spawning (30s) → arena (5-8s) → results (5s)
 * - Auto-restart loop
 * - No database calls, no blockchain
 */
export class DemoScene extends Scene {
  camera!: Phaser.Cameras.Scene2D.Camera;
  background!: Phaser.GameObjects.Image;
  centerX: number = 0;
  centerY: number = 0;

  // Managers
  private playerManager!: PlayerManager;
  private animationManager!: AnimationManager;

  // Demo state
  private demoMap: any = null;
  private participants: any[] = [];

  constructor() {
    super("DemoScene");
  }

  create() {
    this.camera = this.cameras.main;

    // Calculate proper center coordinates based on actual camera dimensions
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;

    // Create a placeholder background (will be replaced when map is loaded from Convex)
    // Using a simple colored rectangle as placeholder
    const placeholder = this.add.graphics();
    placeholder.fillStyle(0x1a1a2e, 1);
    placeholder.fillRect(0, 0, this.camera.width, this.camera.height);

    // Background will be set by setDemoMap() when DemoGameManager loads a map from Convex
    // Initialize as undefined - will be created when map data arrives
    this.background = placeholder as any;

    // Initialize managers
    this.playerManager = new PlayerManager(this, this.centerX, this.centerY);
    this.animationManager = new AnimationManager(this, this.centerX, this.centerY);

    // Handle resize events to keep background centered
    this.scale.on("resize", () => this.handleResize(), this);

    EventBus.emit("current-scene-ready", this);
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
  }

  // Called by DemoGameManager to set the map (loaded from Convex)
  public setDemoMap(mapData: any) {
    this.demoMap = mapData;

    if (mapData && mapData.background) {
      console.log("Setting demo map background:", mapData.background);

      // Destroy placeholder if it exists
      if (this.background) {
        this.background.destroy();
      }

      // Check if texture exists (should be loaded by Preloader)
      if (this.textures.exists(mapData.background)) {
        this.background = this.add.image(this.centerX, this.centerY, mapData.background);
        this.background.setOrigin(0.5, 0.5);
        this.background.setAlpha(1);
        this.background.setDepth(0); // Background layer
      } else {
        console.warn(`Texture '${mapData.background}' not found, keeping placeholder`);
        // Recreate placeholder
        const placeholder = this.add.graphics();
        placeholder.fillStyle(0x1a1a2e, 1);
        placeholder.fillRect(0, 0, this.camera.width, this.camera.height);
        this.background = placeholder as any;
      }
    }
  }

  // Spawn a single demo participant
  public spawnDemoParticipant(participant: any) {
    // Check if participant already exists to prevent duplicates
    if (this.playerManager.getParticipant(participant._id || participant.id)) {
      console.warn("Demo participant already exists, skipping:", participant.displayName);
      return;
    }

    // Add the participant
    this.playerManager.addParticipant(participant);
    this.participants.push(participant);
  }

  // Move all participants to center for arena phase
  public moveParticipantsToCenter() {
    this.playerManager.moveParticipantsToCenter();
  }

  // Show winner and handle results phase
  public showDemoWinner(winner: any) {
    const demoGameState = {
      status: "results",
      winnerId: winner._id || winner.id,
      participants: Array.from(this.playerManager.getParticipants().values()),
      isDemo: true,
    };

    this.playerManager.showResults(demoGameState);
  }

  // Clear all participants and reset for new demo cycle
  public clearDemoParticipants() {
    this.playerManager.clearParticipants();
    this.participants = [];
  }

  // Transition to real game scene
  public transitionToRealGame() {
    console.log("Transitioning from Demo to Real Game");
    this.clearDemoParticipants();
    this.scene.start("RoyalRumble"); // Start the real game scene
  }

  update() {
    // Demo scene update loop (currently minimal)
  }
}
