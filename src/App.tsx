import { useRef, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { api } from "../convex/_generated/api";

export default function App() {
  const [previousParticipants, setPreviousParticipants] = useState<any[]>([]);

  //  References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  // Get current game state
  const currentGame = useQuery(api.games.getCurrentGame);

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    // Update Phaser scene with game state when it's ready
    if (scene && scene.scene.key === 'RoyalRumble' && currentGame) {
      (scene as any).updateGameState?.(currentGame);
    }
  };

  // Update Phaser scene when game state changes
  useEffect(() => {
    if (phaserRef.current?.scene && currentGame) {
      const scene = phaserRef.current.scene;
      if (scene.scene.key === 'RoyalRumble') {
        (scene as any).updateGameState?.(currentGame);

        // Detect new players joining in real-time
        if (currentGame.status === 'waiting' && currentGame.participants) {
          const newPlayers = currentGame.participants.filter((p: any) =>
            !previousParticipants.some(prev => prev._id === p._id)
          );

          // Spawn each new player with special effects
          newPlayers.forEach((player: any) => {
            console.log('New player joined:', player.displayName);
            (scene as any).spawnPlayerImmediately?.(player);
          });

          // Update previous participants list
          setPreviousParticipants(currentGame.participants);
        }
      }
    }
  }, [currentGame, previousParticipants]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Full Background Phaser Game */}
      <div className="fixed inset-0 w-full h-full">
        <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
      </div>

      {/* Overlay UI Elements */}
      <div className="relative z-10">
        <Header />
        <div className="min-h-screen pt-16 pb-24">
          <div className="absolute left-4 top-20 lg:w-80 xl:w-96 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <GameLobby />
          </div>
        </div>
      </div>
    </div>
  );
}
