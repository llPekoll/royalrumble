import { Scene } from 'phaser';
import { CHARACTERS } from '../config/characters';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game
        this.load.setPath('assets');

        // Load all character sprites dynamically
        CHARACTERS.forEach(character => {
            this.load.atlas(character.key, character.spriteSheet, character.jsonPath);
        });

        // Load arena backgrounds
        this.load.image('arena', 'arena.png');
        this.load.image('arena2', 'arena2.png');

        // Load particle effects
        this.load.image('star', 'star.png');

        this.load.image('logo', 'logo.png');
    }

    create ()
    {
        // Create animations for all characters dynamically
        CHARACTERS.forEach(character => {
            // Create idle animation
            this.anims.create({
                key: `${character.key}-idle`,
                frames: this.anims.generateFrameNames(character.key, {
                    prefix: character.prefix,
                    suffix: character.suffix,
                    start: character.animations.idle.start,
                    end: character.animations.idle.end
                }),
                frameRate: 10,
                repeat: -1
            });

            // Create walk animation
            this.anims.create({
                key: `${character.key}-walk`,
                frames: this.anims.generateFrameNames(character.key, {
                    prefix: character.prefix,
                    suffix: character.suffix,
                    start: character.animations.walk.start,
                    end: character.animations.walk.end
                }),
                frameRate: 10,
                repeat: -1
            });
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
