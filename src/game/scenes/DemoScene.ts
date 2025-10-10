import { EventBus } from "../EventBus";
import { Scene } from "phaser";
import { PlayerManager } from "../managers/PlayerManager";
import { AnimationManager } from "../managers/AnimationManager";
import { BackgroundManager } from "../managers/BackgroundManager";
import { SoundManager } from "../managers/SoundManager";
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

    // Initialize SoundManager
    SoundManager.initialize();

    // Set up audio unlock on first user interaction
    this.setupAudioUnlock();
  }

  private setupAudioUnlock() {
    console.log("[DemoScene] Setting up audio unlock handler");

    // Apply mute state from SoundManager
    SoundManager.applyMuteToScene(this);

    // Set up click handler to unlock audio on first interaction
    const unlockHandler = () => {
      if (!this.audioUnlocked) {
        console.log("[DemoScene] User interaction detected, unlocking audio...");
        this.audioUnlocked = true;

        SoundManager.unlockAudio(this).then(() => {
          // Try to start music after unlocking
          this.tryStartMusic();
        });

        // Remove the handler after first interaction
        this.input.off("pointerdown", unlockHandler);
      }
    };

    // Listen for any pointer/touch interaction
    this.input.on("pointerdown", unlockHandler);

    // Also try to start music immediately (will work if already unlocked)
    this.tryStartMusic();
  }

  private tryStartMusic() {
    console.log("[DemoScene] Attempting to start battle music");
    console.log("[DemoScene] Current state:", {
      battleMusicExists: !!this.battleMusic,
      audioUnlocked: this.audioUnlocked,
      soundMuted: SoundManager.isSoundMuted(),
      audioContextState: this.sound.context?.state,
      battleThemeExists: this.cache.audio.exists("battle-theme"),
    });

    if (!this.battleMusic) {
      try {
        // Check if audio file is loaded
        if (!this.cache.audio.exists("battle-theme")) {
          console.error("[DemoScene] ❌ battle-theme audio not loaded!");
          return;
        }

        console.log("[DemoScene] Creating battle music with SoundManager...");

        // Use SoundManager to play battle music (respects mute and volume)
        this.battleMusic = SoundManager.play(this, "battle-theme", 0.2, {
          loop: true,
        });

        // Register with SoundManager for centralized control
        SoundManager.setBattleMusic(this.battleMusic);

        if (this.battleMusic) {
          console.log("[DemoScene] ✅ Battle music object created:", {
            isPlaying: this.battleMusic.isPlaying,
            isPaused: this.battleMusic.isPaused,
            volume: this.battleMusic.volume,
            loop: this.battleMusic.loop,
          });
        } else {
          console.log("[DemoScene] ⏸️ Battle music object is null");
        }
      } catch (e) {
        console.error("[DemoScene] ❌ Failed to start battle music:", e);
      }
    } else {
      console.log("[DemoScene] Battle music already exists, state:", {
        isPlaying: this.battleMusic.isPlaying,
        isPaused: this.battleMusic.isPaused,
      });
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
      SoundManager.setBattleMusic(null); // Unregister from SoundManager
    }
  }

  update() {}
}
