import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';

// Global storage for current game's map data
export let currentMapData: any = null;

export const setCurrentMapData = (map: any) => {
  currentMapData = map;
};

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#028af8',
  scene: [
    Boot,
    Preloader,
    MainGame,
  ]
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
}

export default StartGame;
