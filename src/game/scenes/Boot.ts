import { Scene } from "phaser";

export class Boot extends Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
    //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

    // Maps are now loaded dynamically in Preloader based on database
  }

  create() {
    // Debug: Scene name at bottom
    this.add.text(512, 750, 'Scene: Boot', {
      fontFamily: 'Arial', fontSize: 16, color: '#ffff00',
      stroke: '#000000', strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5).setDepth(1000);

    this.scene.start("Preloader");
  }
}
