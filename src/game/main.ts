import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';

// Global storage for current game's map data
export let currentMapData: any = null;
// Global storage for characters data
export let charactersData: any[] = [];

export const setCurrentMapData = (map: any) => {
  currentMapData = map;
};

export const setCharactersData = (characters: any[]) => {
  charactersData = characters;
};

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
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
