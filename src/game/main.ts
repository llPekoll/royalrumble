import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { DemoScene } from './scenes/DemoScene';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';

// Global storage for current game's map data
export let currentMapData: any = null;
// Global storage for characters data
export let charactersData: any[] = [];
// Global storage for demo mode map (single random map)
export let demoMapData: any = null;

export const setCurrentMapData = (map: any) => {
  currentMapData = map;
};

export const setCharactersData = (characters: any[]) => {
  charactersData = characters;
};

export const setDemoMapData = (map: any) => {
  demoMapData = map;
};

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true,
  parent: 'game-container',
  pixelArt: true, // Enable pixel-perfect rendering globally
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialiasGL: false, // Disable WebGL antialiasing for crisp pixels
    pixelArt: true, // Redundant but explicit - ensures crisp pixel art
  },
  audio: {
    disableWebAudio: false,  // Use Web Audio API (best quality)
    noAudio: false,           // Enable audio
  },
  scene: [
    Boot,
    Preloader,
    DemoScene,
    MainGame,
  ]
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
}

export default StartGame;
