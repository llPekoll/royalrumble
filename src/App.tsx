import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { BlockchainRandomnessDialog } from "./components/BlockchainRandomnessDialog";
import { DemoModeIndicator } from "./components/DemoModeIndicator";
import { DemoGameManager } from "./components/DemoGameManager";
import { api } from "../convex/_generated/api";

export default function App() {
  const [previousParticipants, setPreviousParticipants] = useState<any[]>([]);
  const [showBlockchainDialog, setShowBlockchainDialog] = useState(false);

  // References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  // Get current game state
  const currentGame = useQuery(api.games.getCurrentGame);

  // Demo mode is active when no real game exists
  const isDemoMode = currentGame === null;

  // State to track demo info for UI (passed from DemoGameManager via ref or context if needed)
  const [demoState, setDemoState] = useState({
    phase: 'spawning' as 'spawning' | 'arena' | 'results',
    countdown: 30,
    participantCount: 0
  });

  // Mutation to trigger blockchain call
  const triggerBlockchainCall = useMutation(api.games.triggerBlockchainCall);

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    // Handle scene based on whether we're in demo or real game
    if (scene.scene.key === 'RoyalRumble' && currentGame) {
      // Real game scene - update with game state
      (scene as any).updateGameState?.(currentGame);

      // Set up blockchain call event listener
      scene.events.off('triggerBlockchainCall');
      scene.events.on('triggerBlockchainCall', () => {
        if (currentGame && currentGame._id) {
          console.log('Triggering blockchain call from frontend');
          triggerBlockchainCall({ gameId: currentGame._id });
        }
      });
    } else if (scene.scene.key === 'DemoScene') {
      // Demo scene is ready - DemoGameManager will handle it
      console.log('DemoScene is ready');
    }
  };

  // Switch scenes when transitioning between demo and real game
  useEffect(() => {
    if (!phaserRef.current?.scene) return;

    const scene = phaserRef.current.scene;

    // If real game starts and we're in demo scene, switch to game scene
    if (currentGame && scene.scene.key === 'DemoScene') {
      console.log('Switching from DemoScene to RoyalRumble');
      scene.scene.start('RoyalRumble');
    }

    // If no game and we're in game scene, switch back to demo
    if (!currentGame && scene.scene.key === 'RoyalRumble') {
      console.log('Switching from RoyalRumble to DemoScene');
      scene.scene.start('DemoScene');
    }

    // Update game scene with real game state
    if (currentGame && scene.scene.key === 'RoyalRumble') {
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
  }, [currentGame, previousParticipants]);

  // Show blockchain dialog when blockchain call is pending
  useEffect(() => {
    if (currentGame) {
      const isSmallGame = currentGame.isSmallGame || (currentGame.participants?.length < 8);
      const isArenaPhase = currentGame.status === 'arena';
      const isBlockchainCallPending = currentGame.blockchainCallStatus === 'pending';

      // Show dialog for small games in arena phase while blockchain call is pending
      setShowBlockchainDialog(isSmallGame && isArenaPhase && isBlockchainCallPending);
    } else {
      setShowBlockchainDialog(false);
    }
  }, [currentGame]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Demo Game Manager - handles all demo logic */}
      <DemoGameManager
        isActive={isDemoMode}
        phaserRef={phaserRef}
        onStateChange={setDemoState}
      />

      {/* Full Background Phaser Game */}
      <div className="fixed inset-0 w-full h-full">
        <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
      </div>

      {/* Overlay UI Elements */}
      <div className="relative z-10">
        <Header />

        {/* Demo Mode Indicator */}
        {isDemoMode && (
          <DemoModeIndicator
            countdown={demoState.countdown}
            phase={demoState.phase}
            participantCount={demoState.participantCount}
          />
        )}

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
