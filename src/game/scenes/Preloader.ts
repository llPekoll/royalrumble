import { Scene } from 'phaser';

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
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');
        this.load.atlas('orc', 'spriteSheets/orc.png', 'spriteSheets/orc.json');
        this.load.atlas('soldier', 'spriteSheets/Soldier.png', 'spriteSheets/Soldier.json');

        // Load arena backgrounds
        this.load.image('arena', 'arena.png');
        this.load.image('arena2', 'arena2.png');

        this.load.image('logo', 'logo.png');
    }

    create ()
    {
        // Create walk animation using frames 6-13
        this.anims.create({
            key: 'orc-walk',
            frames: this.anims.generateFrameNames('orc', {
                prefix: 'Orc ',
                suffix: '.aseprite',
                start: 6,
                end: 13
            }),
            frameRate: 10,
            repeat: -1
        });

        // Create idle animation using frames 0-5
        this.anims.create({
            key: 'orc-idle',
            frames: this.anims.generateFrameNames('orc', {
                prefix: 'Orc ',
                suffix: '.aseprite',
                start: 0,
                end: 5
            }),
            frameRate: 10,
            repeat: -1
        });

        // Create walk animation using frames 6-13
        this.anims.create({
            key: 'soldier-walk',
            frames: this.anims.generateFrameNames('soldier', {
                prefix: 'Soldier ',
                suffix: '.aseprite',
                start: 6,
                end: 13
            }),
            frameRate: 10,
            repeat: -1
        });

        // Create idle animation using frames 0-5
        this.anims.create({
            key: 'soldier-idle',
            frames: this.anims.generateFrameNames('soldier', {
                prefix: 'Soldier ',
                suffix: '.aseprite',
                start: 0,
                end: 5
            }),
            frameRate: 10,
            repeat: -1
        });

        this.scene.start('MainMenu');
    }
}
