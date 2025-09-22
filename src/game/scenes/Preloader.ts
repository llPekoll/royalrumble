import { Scene } from 'phaser';
import { currentMapData, charactersData } from '../main';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    // Create a gradient background instead of using an image
    // Create vertical gradient from dark purple to dark blue

    //  A simple progress bar. This is the outline of the bar.
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

    //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
    const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

    //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
    this.load.on('progress', (progress: number) => {
      //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
      bar.width = 4 + (460 * progress);
    });
  }

  preload() {
    //  Load the assets for the game
    this.load.setPath('assets');
    // Load all character sprites dynamically from database
    charactersData.forEach(character => {
      const key = character.name.toLowerCase().replace(/\s+/g, '-');
      const jsonPath = character.assetPath.replace('.png', '.json');
      this.load.atlas(key, character.assetPath, jsonPath);
    });

    this.load.image(currentMapData.background, currentMapData.assetPath);

    // Load particle effects
    this.load.image('star', 'star.png');

    // Load explosion sprite sheet
    this.load.atlas('explosion', 'misc/Explosion.png', 'misc/Explosion.json');
    this.load.image('logo', 'logo.webp');
  }

  create() {
    // Create animations for all characters dynamically from database
    charactersData.forEach(character => {
      const key = character.name.toLowerCase().replace(/\s+/g, '-');

      // Determine prefix and suffix from the character name
      const prefix = character.name + ' ';
      const suffix = '.aseprite';

      // Create idle animation
      if (character.animations.idle) {
        this.anims.create({
          key: `${key}-idle`,
          frames: this.anims.generateFrameNames(key, {
            prefix: prefix,
            suffix: suffix,
            start: character.animations.idle.start,
            end: character.animations.idle.end
          }),
          frameRate: 10,
          repeat: -1
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
            end: character.animations.walk.end
          }),
          frameRate: 10,
          repeat: -1
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
            end: character.animations.attack.end
          }),
          frameRate: 10,
          repeat: 0
        });
      }
    });

    // Create explosion animation
    this.anims.create({
      key: 'explosion',
      frames: this.anims.generateFrameNames('explosion', {
        prefix: 'Explosion 2 SpriteSheet ',
        suffix: '.png',
        start: 0,
        end: 17
      }),
      frameRate: 18,
      repeat: 0
    });

    // Debug: Scene name at bottom
    this.add.text(512, 750, 'Scene: Preloader', {
      fontFamily: 'Arial', fontSize: 16, color: '#ffff00',
      stroke: '#000000', strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5).setDepth(1000);

    // Start with RoyalRumble scene directly for the game view
    this.scene.start('RoyalRumble');
  }
}
