import { useRef, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { BlockchainRandomnessDialog } from "./components/BlockchainRandomnessDialog";
import { DemoGameManager } from "./components/DemoGameManager";
import { api } from "../convex/_generated/api";

export default function App() {
  const [showBlockchainDialog, setShowBlockchainDialog] = useState(false);

  // References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  // Get current game state from new Solana-based system
  const gameData = useQuery(api.gameManagerDb.getGameState);

  // Demo mode is active when no real game exists or game is in "idle" state
  // Handle undefined (loading state), null, or idle status
  console.log({ gameData });
  const isDemoMode =
    !gameData ||
    !gameData.game ||
    gameData.game.status === "idle";

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    // Handle scene based on whether we're in demo or real game
    if (scene.scene.key === "RoyalRumble" && gameData?.game) {
      // Real game scene - update with blockchain game state
      (scene as any).updateGameState?.(gameData.game);

      // Blockchain calls now handled by Solana crank system (no frontend trigger needed)
      console.log("Real game active - Solana crank managing blockchain calls");
    } else if (scene.scene.key === "DemoScene") {
      // Demo scene is ready - DemoGameManager will handle it
      console.log("DemoScene is ready");
    }
  };

  // Switch scenes when transitioning between demo and real game
  useEffect(() => {
    if (!phaserRef.current?.scene) return;

    const scene = phaserRef.current.scene;
    const hasRealGame =
      gameData?.game &&
      gameData.game.status !== "idle";

    // If real game starts and we're in demo scene, switch to game scene
    if (hasRealGame && scene.scene.key === "DemoScene") {
      console.log("Switching from DemoScene to RoyalRumble - Real game started");
      console.log("Game state:", gameData.game);
      scene.scene.start("RoyalRumble");
    }

    // If no game (or idle game) and we're in game scene, switch back to demo
    if (!hasRealGame && scene.scene.key === "RoyalRumble") {
      console.log("Switching from RoyalRumble to DemoScene - Game ended or idle");
      scene.scene.start("DemoScene");
    }

    // Update game scene with real blockchain game state
    if (hasRealGame && scene.scene.key === "RoyalRumble") {
      (scene as any).updateGameState?.(gameData.game);

      // TODO: Fetch and display participants from Solana blockchain
      // For now, game state only has minimal tracking data
      console.log("Game status:", gameData.game.status);
      console.log("Players count:", gameData.game.playersCount);
    }
  }, [gameData]);

  // Show blockchain dialog during VRF randomness
  useEffect(() => {
    if (gameData?.game) {
      const isAwaitingRandomness = gameData.game.status === "awaitingWinnerRandomness";

      // Show dialog while waiting for Solana VRF
      setShowBlockchainDialog(isAwaitingRandomness);
    } else {
      setShowBlockchainDialog(false);
    }
  }, [gameData]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Demo Game Manager - handles all demo logic */}
      <DemoGameManager isActive={isDemoMode} phaserRef={phaserRef} />

      {/* Full Background Phaser Game */}
      <div className="fixed inset-0 w-full h-full">
        <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
      </div>

      {/* Overlay UI Elements */}
      <div className="relative z-10">
        <Header />
        <div className="min-h-screen pt-16 pb-24">
          <div className="absolute right-4 top-20 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            <GameLobby />
          </div>
        </div>
      </div>

      {/* Blockchain Randomness Dialog */}
      <BlockchainRandomnessDialog open={showBlockchainDialog} />
    </div>
  );
}
