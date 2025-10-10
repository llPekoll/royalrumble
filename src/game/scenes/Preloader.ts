import { Scene } from "phaser";
import { currentMapData, charactersData, demoMapData } from "../main";

export class Preloader extends Scene {
  constructor() {
    super("Preloader");
  }

  init() {
    //  A simple progress bar. This is the outline of the bar.
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

    //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
    const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

    //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
    this.load.on("progress", (progress: number) => {
      //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
    this.load.setPath("assets");

    // Check if data is available (should always be true due to PhaserGame.tsx guard)
    if (!charactersData || charactersData.length === 0) {
      console.error("[Preloader] No characters data available! This should not happen.");
      return;
    }
    if (!demoMapData) {
      console.error("[Preloader] No demo map data available!");
      return;
    }

    console.log("[Preloader] Data check passed:", {
      charactersCount: charactersData.length,
      demoMap: demoMapData?.name,
      currentMap: currentMapData?.name || "none",
    });

    // Load all character sprites dynamically from database
    charactersData.forEach((character) => {
      const key = character.name.toLowerCase().replace(/\s+/g, "-");
      const jsonPath = character.assetPath.replace(".png", ".json");
      console.log("[Preloader] Loading character atlas:", key, character.assetPath);
      this.load.atlas(key, character.assetPath, jsonPath);
    });

    // Load demo map (single random map for demo mode)
    console.log("[Preloader] Loading demo map:", demoMapData.background, demoMapData.assetPath);
    this.load.image(demoMapData.background, demoMapData.assetPath);

    // Load current game map if available (for real games)
    if (currentMapData && currentMapData.background && currentMapData.assetPath) {
      console.log("[Preloader] Loading current game map:", currentMapData.background);
      this.load.image(currentMapData.background, currentMapData.assetPath);
    }

    // Load VFX assets
    this.load.atlas("explosion", "vfx/Explosion.png", "vfx/Explosion.json");
    this.load.atlas("blood", "vfx/blood_spritesheet.png", "vfx/blood_spritesheet.json");
    this.load.atlas("dust", "dust_char.png", "dust_char.json");
    this.load.image("logo", "logo.webp");

    // Load winner throne
    this.load.image("throne", "misc/throne.png");

    // Load sound effects
    this.load.audio("sand-step", "sounds/sand-step-1.mp3");
    this.load.audio("battle-theme", "sounds/battleThemeA.mp3");

    // Debug: Log when audio files finish loading
    this.load.on("filecomplete-audio-sand-step", () => {
      console.log("[Preloader] ✅ sand-step audio loaded successfully");
    });

    this.load.on("filecomplete-audio-battle-theme", () => {
      console.log("[Preloader] ✅ battle-theme audio loaded successfully");
    });

    this.load.on("loaderror", (file: any) => {
      console.error("[Preloader] ❌ Failed to load file:", file.key, file.src);
    });
  }

  create() {
    // Safety check before creating animations
    if (!charactersData || charactersData.length === 0) {
      console.error("[Preloader] No characters data for animations, starting DemoScene anyway");
      this.scene.start("DemoScene");
      return;
    }

    // Create animations for all characters dynamically from database
    console.log("[Preloader] Creating animations for", charactersData.length, "characters");
    charactersData.forEach((character) => {
      const key = character.name.toLowerCase().replace(/\s+/g, "-");

      // Determine prefix and suffix from the character name
      const prefix = character.name + " ";
      const suffix = ".aseprite";

      // Create idle animation
      if (character.animations.idle) {
        this.anims.create({
          key: `${key}-idle`,
          frames: this.anims.generateFrameNames(key, {
            prefix: prefix,
            suffix: suffix,
            start: character.animations.idle.start,
            end: character.animations.idle.end,
          }),
          frameRate: 10,
          repeat: -1,
        });
      }

      // Create walk animation
      if (character.animations.walk) {
        this.anims.create({
          key: `${key}-walk`,
          frames: this.anims.generateFrameNames(key, {
            prefix: prefix,
            suffix: suffix,
            start: character.animations.walk.start,
            end: character.animations.walk.end,
          }),
          frameRate: 10,
          repeat: -1,
        });
      }

      // Create attack animation if it exists
      if (character.animations.attack) {
        this.anims.create({
          key: `${key}-attack`,
          frames: this.anims.generateFrameNames(key, {
            prefix: prefix,
            suffix: suffix,
            start: character.animations.attack.start,
            end: character.animations.attack.end,
          }),
          frameRate: 10,
          repeat: 0,
        });
      }
    });

    // Create explosion animation
    this.anims.create({
      key: "explosion",
      frames: this.anims.generateFrameNames("explosion", {
        prefix: "Explosion 2 SpriteSheet ",
        suffix: ".png",
        start: 0,
        end: 17,
      }),
      frameRate: 18,
      repeat: 0,
    });

    // Create blood animations
    const bloodAnimations = [
      { key: "blood-ground-middle", start: 0, end: 10, frameRate: 15 },
      { key: "blood-from-left", start: 12, end: 23, frameRate: 15 },
      { key: "blood-from-left2", start: 25, end: 32, frameRate: 15 },
      { key: "blood-from-left3", start: 34, end: 44, frameRate: 15 },
      { key: "blood-from-left4", start: 46, end: 54, frameRate: 15 },
      { key: "blood-from-left5", start: 56, end: 67, frameRate: 15 },
      { key: "blood-from-left6-big", start: 69, end: 82, frameRate: 18 },
      { key: "blood-ground-middle2", start: 84, end: 93, frameRate: 15 },
      { key: "blood-from-left7", start: 95, end: 106, frameRate: 15 },
    ];

    bloodAnimations.forEach((anim) => {
      this.anims.create({
        key: anim.key,
        frames: this.anims.generateFrameNames("blood", {
          prefix: "blood_spritesheet ",
          suffix: ".ase",
          start: anim.start,
          end: anim.end,
        }),
        frameRate: anim.frameRate,
        repeat: 0,
      });
    });

    // Create dust impact animation
    this.anims.create({
      key: "dust-impact",
      frames: this.anims.generateFrameNames("dust", {
        prefix: "dust_char ",
        suffix: ".aseprite",
        start: 0,
        end: 19,
      }),
      frameRate: 24,
      repeat: 0,
    });

    // Start with DemoScene by default
    this.scene.start("DemoScene");
  }
}
