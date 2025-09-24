import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { BlockchainRandomnessDialog } from "./components/BlockchainRandomnessDialog";
import { api } from "../convex/_generated/api";

export default function App() {
  const [previousParticipants, setPreviousParticipants] = useState<any[]>([]);
  const [showBlockchainDialog, setShowBlockchainDialog] = useState(false);

  //  References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  // Get current game state
  const currentGame = useQuery(api.games.getCurrentGame);

  // Mutation to trigger blockchain call
  const triggerBlockchainCall = useMutation(api.games.triggerBlockchainCall);

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    // Update Phaser scene with game state when it's ready
    if (scene && scene.scene.key === 'RoyalRumble' && currentGame) {
      (scene as any).updateGameState?.(currentGame);
    }

    // Set up blockchain call event listener
    if (scene && scene.scene.key === 'RoyalRumble') {
      // Remove existing listener to prevent duplicates
      scene.events.off('triggerBlockchainCall');

      // Add event listener for blockchain call trigger
      scene.events.on('triggerBlockchainCall', () => {
        if (currentGame && currentGame._id) {
          console.log('Triggering blockchain call from frontend');
          triggerBlockchainCall({ gameId: currentGame._id });
        }
      });
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

      {/* Blockchain Randomness Dialog */}
      <BlockchainRandomnessDialog open={showBlockchainDialog} />
    </div>
  );
}
