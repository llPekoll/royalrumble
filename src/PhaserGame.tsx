import { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import StartGame, { setCurrentMapData, setCharactersData, setDemoMapData } from "./game/main";
import { EventBus } from "./game/EventBus";

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface IProps {
  currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(function PhaserGame(
  { currentActiveScene },
  ref
) {
  const game = useRef<Phaser.Game | null>(null);

  // Get game state from Solana-based system
  const gameState = useQuery(api.gameManager.getGameState);
  const currentGame = null; // Disabled until Solana integration

  const characters = useQuery(api.characters.getActiveCharacters);
  const demoMap = useQuery(api.maps.getRandomMap); // Fetch single random map for demo mode

  // Check if all required data is loaded
  const isDataReady = characters && characters.length > 0 && demoMap;

  useLayoutEffect(() => {
    if (game.current === null && isDataReady) {
      // Pass current game's map data to Phaser before starting the game (if exists)
      if (currentGame?.map) {
        setCurrentMapData(currentGame.map);
      }

      // Pass characters data to Phaser
      setCharactersData(characters);

      // Pass single demo map for demo mode
      setDemoMapData(demoMap);

      game.current = StartGame("game-container");

      if (typeof ref === "function") {
        ref({ game: game.current, scene: null });
      } else if (ref) {
        ref.current = { game: game.current, scene: null };
      }
    }

    return () => {
      if (game.current) {
        game.current.destroy(true);
        if (game.current !== null) {
          game.current = null;
        }
      }
    };
  }, [ref, isDataReady, characters, demoMap, currentGame]);

  useEffect(() => {
    EventBus.on("current-scene-ready", (scene_instance: Phaser.Scene) => {
      if (currentActiveScene && typeof currentActiveScene === "function") {
        currentActiveScene(scene_instance);
      }

      if (typeof ref === "function") {
        ref({ game: game.current, scene: scene_instance });
      } else if (ref) {
        ref.current = { game: game.current, scene: scene_instance };
      }
    });
    return () => {
      EventBus.removeListener("current-scene-ready");
    };
  }, [currentActiveScene, ref]);

  return <div id="game-container" className="w-full h-full"></div>;
});
