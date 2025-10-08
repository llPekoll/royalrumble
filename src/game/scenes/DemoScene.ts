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
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;

    // Create placeholder background
    const placeholder = this.add.graphics();
    placeholder.fillStyle(0x1a1a2e, 1);
    placeholder.fillRect(0, 0, this.camera.width, this.camera.height);
    this.background = placeholder as any;

    this.playerManager = new PlayerManager(this, this.centerX, this.centerY);
    this.animationManager = new AnimationManager(this, this.centerX, this.centerY);

    this.scale.on("resize", () => this.handleResize(), this);
    EventBus.emit("current-scene-ready", this);
  }

  handleResize() {
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;
    this.background.setPosition(this.centerX, this.centerY);
    this.playerManager.updateCenter(this.centerX, this.centerY);
    this.animationManager.updateCenter(this.centerX, this.centerY);
  }

  public setDemoMap(mapData: any) {
    this.demoMap = mapData;

    if (mapData && mapData.background) {
      if (this.background) {
        this.background.destroy();
      }

      if (this.textures.exists(mapData.background)) {
        this.background = this.add.image(this.centerX, this.centerY, mapData.background);
        this.background.setOrigin(0.5, 0.5);
        this.background.setAlpha(1);
        this.background.setDepth(0);
      } else {
        const placeholder = this.add.graphics();
        placeholder.fillStyle(0x1a1a2e, 1);
        placeholder.fillRect(0, 0, this.camera.width, this.camera.height);
        this.background = placeholder as any;
      }
    }
  }

  public spawnDemoParticipant(participant: any) {
    const participantId = participant._id || participant.id;
    
    console.log('[DemoScene] spawnDemoParticipant called', {
      id: participantId,
      currentParticipantsCount: this.participants.length,
      playerManagerCount: this.playerManager.getParticipants().size
    });
    
    // Check if participant already exists to prevent double spawning
    if (this.playerManager.getParticipant(participantId)) {
      console.warn(`[DemoScene] Participant ${participantId} already exists in PlayerManager, skipping duplicate spawn`);
      return;
    }

    // Also check in our local participants array
    if (this.participants.find(p => (p._id || p.id) === participantId)) {
      console.warn(`[DemoScene] Participant ${participantId} found in local array, skipping duplicate spawn`);
      return;
    }

    console.log(`[DemoScene] Adding participant ${participantId} to scene`);
    this.playerManager.addParticipant(participant);
    this.participants.push(participant);
    console.log(`[DemoScene] Participant ${participantId} added successfully`);
  }

  public moveParticipantsToCenter() {
    this.playerManager.moveParticipantsToCenter();
  }

  public showDemoWinner(winner: any) {
    const demoGameState = {
      status: "results",
      winnerId: winner._id || winner.id,
      participants: Array.from(this.playerManager.getParticipants().values()),
      isDemo: true,
    };

    this.playerManager.showResults(demoGameState);
  }

  public clearDemoParticipants() {
    console.log('[DemoScene] Clearing demo participants', {
      count: this.participants.length
    });
    this.playerManager.clearParticipants();
    this.participants = [];
  }

  public transitionToRealGame() {
    this.clearDemoParticipants();
    this.scene.start("RoyalRumble");
  }

  update() {}
}
