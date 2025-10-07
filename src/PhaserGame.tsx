import { forwardRef, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import StartGame, { setCurrentMapData, setCharactersData, setAllMapsData } from './game/main';
import { EventBus } from './game/EventBus';

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface IProps {
  currentActiveScene?: (scene_instance: Phaser.Scene) => void
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(function PhaserGame({ currentActiveScene }, ref) {
  const game = useRef<Phaser.Game | null>(null);
  const currentGame = useQuery(api.games.getCurrentGame);
  const defaultMap = useQuery(api.maps.getDefaultMap);
  const characters = useQuery(api.characters.getActiveCharacters);
  const allMaps = useQuery(api.maps.getAllActiveMaps); // Fetch all maps for demo mode

  // Memoize map data to prevent unnecessary re-renders when other game properties change
  // Use game map if available, otherwise use default map for display
  const mapData = useMemo(() => {
    return currentGame?.map || defaultMap;
  }, [
    currentGame?.map?._id,
    currentGame?.map?.name,
    currentGame?.map?.background,
    currentGame?.map?.assetPath,
    defaultMap?._id,
    defaultMap?.name,
    defaultMap?.background,
    defaultMap?.assetPath
  ]);

  useLayoutEffect(() => {
    if (game.current === null && mapData && characters && allMaps) {
      console.log('🎮 Starting Phaser with:', {
        mapData: mapData?.name,
        characters: characters.length,
        allMaps: allMaps.length
      });

      // Pass current game's map data to Phaser before starting the game
      setCurrentMapData(mapData);
      // Pass characters data to Phaser
      setCharactersData(characters);
      // Pass all maps data for demo mode
      setAllMapsData(allMaps);

      game.current = StartGame("game-container");

      if (typeof ref === 'function') {
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
    }
  }, [ref, mapData, characters, allMaps]);

  useEffect(() => {
    EventBus.on('current-scene-ready', (scene_instance: Phaser.Scene) => {
      if (currentActiveScene && typeof currentActiveScene === 'function') {

        currentActiveScene(scene_instance);

      }

      if (typeof ref === 'function') {
        ref({ game: game.current, scene: scene_instance });
      } else if (ref) {
        ref.current = { game: game.current, scene: scene_instance };
      }

    });
    return () => {
      EventBus.removeListener('current-scene-ready');
    }
  }, [currentActiveScene, ref]);

  return (
    <div id="game-container" className="w-full h-full"></div>
  );
});
