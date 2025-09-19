import { GameObjects, Scene } from 'phaser';

import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{
    background!: GameObjects.Image;
    orc!: GameObjects.Sprite;
    soldier!: GameObjects.Sprite;
    logo!: GameObjects.Image;
    title!: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null = null;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        // Randomly select between 'arena' and 'arena2'
        const arenaKey = Math.random() < 0.5 ? 'arena' : 'arena2';
        this.background = this.add.image(512, 384, arenaKey);
        this.orc = this.add.sprite(100, 100, 'orc');
        this.soldier = this.add.sprite(140, 100, 'soldier');
        this.orc.play({ key: 'orc-walk', repeat: -1 });
        this.soldier.play({ key: 'soldier-walk', repeat: -1 });
        this.logo = this.add.image(512, 300, 'logo').setDepth(100);
        this.title = this.add.text(512, 460, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        // Debug: Scene name at bottom
        this.add.text(512, 750, 'Scene: MainMenu', {
            fontFamily: 'Arial', fontSize: 16, color: '#ffff00',
            stroke: '#000000', strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5).setDepth(1000);

        EventBus.emit('current-scene-ready', this);
    }

    changeScene ()
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }

        this.scene.start('RoyalRumble');
    }

    moveLogo (vueCallback: ({ x, y }: { x: number, y: number }) => void)
    {
        if (this.logoTween)
        {
            if (this.logoTween.isPlaying())
            {
                this.logoTween.pause();
            }
            else
            {
                this.logoTween.play();
            }
        }
        else
        {
            this.logoTween = this.tweens.add({
                targets: this.logo,
                x: { value: 750, duration: 3000, ease: 'Back.easeInOut' },
                y: { value: 80, duration: 1500, ease: 'Sine.easeOut' },
                yoyo: true,
                repeat: -1,
                onUpdate: () => {
                    if (vueCallback)
                    {
                        vueCallback({
                            x: Math.floor(this.logo.x),
                            y: Math.floor(this.logo.y)
                        });
                    }
                }
            });
        }
    }
}
