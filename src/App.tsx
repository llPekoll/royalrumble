import { useRef, useState } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { Leaderboard } from "./components/Leaderboard";
import { Navigation } from "./components/Navigation";

export default function App() {
  const [currentView, setCurrentView] = useState<"game" | "leaderboard">("game");

  //  References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    // Handle scene changes if needed
  };

  return (
    <>
      <Header />

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
