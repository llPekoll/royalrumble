import { useRef, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { Leaderboard } from "./components/Leaderboard";
import { Navigation } from "./components/Navigation";
import { api } from "../convex/_generated/api";

export default function App() {
  const [currentView, setCurrentView] = useState<"game" | "leaderboard">("game");
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
    <>
      <Header currentView={currentView} onViewChange={setCurrentView} />

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 pt-16 pb-24">
        {currentView === "game" && (
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Compact Game Lobby - Left Side */}
              <div className="lg:w-80 xl:w-96">
                <GameLobby />
              </div>

              {/* Main Phaser Game Arena - Center/Right */}
              <div className="flex-1 flex justify-center items-start">
                <div className="bg-black/50 rounded-lg overflow-hidden border border-purple-500/30 max-w-4xl w-full">
                  <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === "leaderboard" && (
          <div className="container mx-auto">
            <Leaderboard />
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
    </>
  );
}
