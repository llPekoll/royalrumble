import { Scene } from "phaser";

/**
 * SoundManager - Centralized sound management
 *
 * Features:
 * - Global volume control (0.0 to 1.0)
 * - Mute toggle
 * - Persistent preferences (localStorage)
 * - Browser autoplay handling
 */
export class SoundManager {
  private static globalVolume: number = 1.0;
  private static isMuted: boolean = false;
  private static isAudioUnlocked: boolean = false;
  private static initialized: boolean = false;

  // Store active music reference for global control
  private static battleMusic: Phaser.Sound.BaseSound | null = null;

  /**
   * Initialize sound manager - load preferences from localStorage
   */
  static initialize() {
    if (this.initialized) return;

    // Load volume preference (default: 1.0 = 100%)
    const savedVolume = localStorage.getItem("sound-volume");
    if (savedVolume !== null) {
      this.globalVolume = parseFloat(savedVolume);
    }

    // Load mute preference (default: false)
    const savedMute = localStorage.getItem("sound-muted");
    if (savedMute !== null) {
      this.isMuted = savedMute === "true";
    }

    this.initialized = true;
    console.log("[SoundManager] Initialized", {
      volume: this.globalVolume,
      muted: this.isMuted,
    });
  }

  /**
   * Play a sound with global volume applied
   * @param scene - Phaser scene
   * @param key - Sound key
   * @param baseVolume - Base volume (0.0 to 1.0), will be multiplied by globalVolume
   * @param config - Additional sound config (loop, etc.)
   */
  static play(
    scene: Scene,
    key: string,
    baseVolume: number = 1.0,
    config?: Phaser.Types.Sound.SoundConfig
  ): Phaser.Sound.BaseSound | null {
    if (!this.initialized) {
      this.initialize();
    }

    // Calculate final volume
    const finalVolume = baseVolume * this.globalVolume;

    try {
      console.log(`[SoundManager] Creating sound "${key}"`, {
        baseVolume,
        globalVolume: this.globalVolume,
        finalVolume,
        isMuted: this.isMuted,
        config,
      });

      // Create the sound object (even if muted, so we can control it later)
      const sound = scene.sound.add(key, {
        ...config,
        volume: finalVolume,
      });

      console.log(`[SoundManager] Sound object created for "${key}"`, {
        soundExists: !!sound,
        soundType: sound?.constructor.name,
      });

      // Only play if not muted
      if (!this.isMuted) {
        console.log(`[SoundManager] Calling play() on "${key}"...`);
        const playResult = sound.play();
        console.log(`[SoundManager] play() result:`, {
          playResult,
          isPlaying: sound.isPlaying,
          isPaused: sound.isPaused,
        });
      } else {
        console.log(`[SoundManager] Sound "${key}" created but not played (muted)`);
      }

      return sound;
    } catch (error) {
      console.error(`[SoundManager] Failed to create sound "${key}":`, error);
      return null;
    }
  }

  /**
   * Play a one-shot sound effect
   */
  static playSound(scene: Scene, key: string, baseVolume: number = 1.0) {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.isMuted) {
      return;
    }

    const finalVolume = baseVolume * this.globalVolume;

    try {
      scene.sound.play(key, { volume: finalVolume });
      console.log(`[SoundManager] Playing sound "${key}" at volume ${finalVolume.toFixed(2)}`);
    } catch (error) {
      console.error(`[SoundManager] Failed to play sound "${key}":`, error);
    }
  }

  /**
   * Set global volume (0.0 to 1.0)
   */
  static setGlobalVolume(volume: number) {
    this.globalVolume = Math.max(0, Math.min(1, volume)); // Clamp to 0-1
    localStorage.setItem("sound-volume", this.globalVolume.toString());
    console.log(`[SoundManager] Global volume set to ${this.globalVolume}`);
  }

  /**
   * Get current global volume
   */
  static getGlobalVolume(): number {
    if (!this.initialized) {
      this.initialize();
    }
    return this.globalVolume;
  }

  /**
   * Set mute state
   */
  static setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem("sound-muted", muted.toString());
    console.log(`[SoundManager] Muted: ${muted}`);

    // Control battle music directly
    if (this.battleMusic) {
      if (muted) {
        this.battleMusic.pause();
        console.log("[SoundManager] Battle music paused via SoundManager");
      } else {
        this.battleMusic.resume();
        console.log("[SoundManager] Battle music resumed via SoundManager");
      }
    }
  }

  /**
   * Get current mute state
   */
  static isSoundMuted(): boolean {
    if (!this.initialized) {
      this.initialize();
    }
    return this.isMuted;
  }

  /**
   * Toggle mute
   */
  static toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Unlock audio context (call on first user interaction)
   */
  static unlockAudio(scene: Scene): Promise<void> {
    return new Promise((resolve) => {
      if (this.isAudioUnlocked) {
        resolve();
        return;
      }

      console.log("[SoundManager] Attempting to unlock audio context...");

      // Try to resume audio context
      if (scene.game.sound.context) {
        const context = scene.game.sound.context;

        if (context.state === "suspended") {
          context
            .resume()
            .then(() => {
              this.isAudioUnlocked = true;
              console.log("[SoundManager] ✅ Audio context unlocked successfully");
              resolve();
            })
            .catch((error) => {
              console.error("[SoundManager] ❌ Failed to unlock audio context:", error);
              resolve(); // Resolve anyway to not block execution
            });
        } else {
          this.isAudioUnlocked = true;
          console.log("[SoundManager] ✅ Audio context already running");
          resolve();
        }
      } else {
        console.warn("[SoundManager] No audio context available");
        resolve();
      }
    });
  }

  /**
   * Check if audio is unlocked
   */
  static isUnlocked(): boolean {
    return this.isAudioUnlocked;
  }

  /**
   * Apply mute state to Phaser's global sound manager
   */
  static applyMuteToScene(scene: Scene) {
    if (!this.initialized) {
      this.initialize();
    }
    scene.sound.mute = this.isMuted;
    console.log(`[SoundManager] Applied mute state to scene: ${this.isMuted}`);
  }

  /**
   * Update all playing sounds with new volume
   */
  static updateAllSoundsVolume(scene: Scene) {
    if (!this.initialized) {
      this.initialize();
    }

    // Phaser's global volume control
    scene.sound.volume = this.globalVolume;
    console.log(`[SoundManager] Updated scene volume to ${this.globalVolume}`);
  }

  /**
   * Register battle music for global control
   */
  static setBattleMusic(music: Phaser.Sound.BaseSound | null) {
    this.battleMusic = music;
    console.log("[SoundManager] Battle music registered:", !!music);

    // Apply current mute state immediately
    if (music && this.isMuted) {
      music.pause();
      console.log("[SoundManager] Applied mute to newly registered music");
    }
  }

  /**
   * Get battle music reference
   */
  static getBattleMusic(): Phaser.Sound.BaseSound | null {
    return this.battleMusic;
  }
}
