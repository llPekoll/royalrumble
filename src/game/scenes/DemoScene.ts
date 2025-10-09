import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerManager } from "../managers/PlayerManager";
import { AnimationManager } from "../managers/AnimationManager";
import { BackgroundManager } from "../managers/BackgroundManager";
import { demoMapData } from "../main";

/**
 * DemoScene - Pure client-side demo mode
 *
 * Features:
 * - 20 bots spawning with random timing
 * - Random map selection
 * - 3 phases: spawning (30s) → arena (3s) → results (5s)
 * - Auto-restart loop
 * - No database calls, no blockchain
 */
export class DemoScene extends Scene {
  camera!: Phaser.Cameras.Scene2D.Camera;
  centerX: number = 0;
  centerY: number = 0;

  // Managers
  private playerManager!: PlayerManager;
  private animationManager!: AnimationManager;
  private backgroundManager!: BackgroundManager;

  // Demo state
  private demoMap: any = null;
  private participants: any[] = [];

  private battleMusic: Phaser.Sound.BaseSound | null = null;
  private audioUnlocked: boolean = false;

  constructor() {
    super("DemoScene");
  }

  create() {
    this.camera = this.cameras.main;
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;

    this.playerManager = new PlayerManager(this, this.centerX, this.centerY);
    this.animationManager = new AnimationManager(this, this.centerX, this.centerY);
    this.backgroundManager = new BackgroundManager(this, this.centerX, this.centerY);

    // Initialize background immediately with preloaded demo map
    if (demoMapData?.background) {
      console.log("[DemoScene] Initializing background with:", demoMapData.background);
      this.backgroundManager.setTexture(demoMapData.background);
      this.demoMap = demoMapData;
    } else {
      console.warn("[DemoScene] No demo map data available!");
    }

    this.scale.on("resize", () => this.handleResize(), this);
    EventBus.emit("current-scene-ready", this);

    // Set up audio unlock on first user interaction
    this.setupAudioUnlock();
  }

  private setupAudioUnlock() {
    // Check if sound should be muted from localStorage
    const shouldMute = localStorage.getItem("sound-muted") === "true";
    if (shouldMute) {
      this.sound.mute = true;
      console.log("[DemoScene] Sound is muted from user preference");
    }

    this.tryStartMusic();
  }

  private tryStartMusic() {
    console.log("[DemoScene] Attempting to start battle music, muted:", this.sound.mute);
    if (!this.battleMusic) {
      try {
        this.battleMusic = this.sound.add("battle-theme", {
          volume: 0.2,
          loop: true,
        });
        this.battleMusic.play();
        console.log("[DemoScene] ✅ Battle music started successfully");
      } catch (e) {
        console.error("[DemoScene] ❌ Failed to start battle music:", e);
      }
    }
  }

  handleResize() {
    this.centerX = this.camera.centerX;
    this.centerY = this.camera.centerY;
    this.backgroundManager.updateCenter(this.centerX, this.centerY);
    this.playerManager.updateCenter(this.centerX, this.centerY);
    this.animationManager.updateCenter(this.centerX, this.centerY);
  }

  public setDemoMap(mapData: any) {
    console.log("[DemoScene] setDemoMap called:", mapData?.name);
    this.demoMap = mapData;

    if (mapData?.background) {
      this.backgroundManager.setTexture(mapData.background);
    }
  }

  public spawnDemoParticipant(participant: any) {
    const participantId = participant._id || participant.id;

    console.log("[DemoScene] spawnDemoParticipant called", {
      id: participantId,
      currentParticipantsCount: this.participants.length,
      playerManagerCount: this.playerManager.getParticipants().size,
    });

    // Check if participant already exists to prevent double spawning
    if (this.playerManager.getParticipant(participantId)) {
      console.warn(
        `[DemoScene] Participant ${participantId} already exists in PlayerManager, skipping duplicate spawn`
      );
      return;
    }

    // Also check in our local participants array
    if (this.participants.find((p) => (p._id || p.id) === participantId)) {
      console.warn(
        `[DemoScene] Participant ${participantId} found in local array, skipping duplicate spawn`
      );
      return;
    }

    console.log(`[DemoScene] Adding participant ${participantId} to scene`);
    this.playerManager.addParticipant(participant);
    this.participants.push(participant);
    console.log(`[DemoScene] Participant ${participantId} added successfully`);
  }

  public moveParticipantsToCenter() {
    this.playerManager.moveParticipantsToCenter();

    // After 2 seconds of running, start continuous explosions
    this.time.delayedCall(1000, () => {
      console.log("[DemoScene] 💥 Starting continuous explosions after 2 seconds of running");
      this.animationManager.createContinuousExplosions();
    });
  }

  public showDemoWinner(winner: any) {
    // Mark all non-winners as eliminated
    const participants = this.playerManager.getParticipants();
    participants.forEach((participant) => {
      if (participant.id !== winner._id && participant.id !== winner.id) {
        participant.eliminated = true;
      } else {
        participant.eliminated = false; // Winner stays
      }
    });

    // Explode losers outward with physics (includes explosions, blood, shake)
    this.animationManager.explodeParticipantsOutward(participants);

    // After 3 seconds: Show winner celebration
    this.time.delayedCall(3000, () => {
      console.log("[DemoScene] 🎉 Starting winner celebration for:", winner);

      const demoGameState = {
        status: "results",
        winnerId: winner._id || winner.id,
        participants: Array.from(participants.values()),
        isDemo: true,
      };

      // Show winner with PlayerManager (scales up, golden tint, etc.)
      const winnerParticipant = this.playerManager.showResults(demoGameState);

      console.log("[DemoScene] Winner participant from showResults:", winnerParticipant);

      // Add celebration animations (confetti, text, bounce)
      if (winnerParticipant) {
        console.log("[DemoScene] 🏆 Calling addWinnerCelebration");
        this.animationManager.addWinnerCelebration(winnerParticipant, winner);
      } else {
        console.error("[DemoScene] ❌ No winner participant returned!");
      }
    });
  }

  public clearDemoParticipants() {
    console.log("[DemoScene] Clearing demo participants", {
      count: this.participants.length,
    });
    this.playerManager.clearParticipants();
    this.animationManager.clearCelebration();
    this.participants = [];
  }

  public transitionToRealGame() {
    this.clearDemoParticipants();
    // Stop battle music when transitioning to real game
    if (this.battleMusic) {
      this.battleMusic.stop();
      this.battleMusic = null;
    }
    this.scene.start("RoyalRumble");
  }

  shutdown() {
    // Clean up music when scene is shut down
    if (this.battleMusic) {
      this.battleMusic.stop();
      this.battleMusic = null;
    }
  }

  update() {}
}
