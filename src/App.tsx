import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import { Header } from "./components/Header";
import { GameLobby } from "./components/GameLobby";
import { BlockchainRandomnessDialog } from "./components/BlockchainRandomnessDialog";
import { DemoModeIndicator } from "./components/DemoModeIndicator";
import { api } from "../convex/_generated/api";
import { DemoParticipant, generateDemoParticipant, generateDemoWinner } from "./lib/demoGenerator";

export default function App() {
  const [previousParticipants, setPreviousParticipants] = useState<any[]>([]);
  const [showBlockchainDialog, setShowBlockchainDialog] = useState(false);
  
  // Demo mode state (client-side only)
  const [demoMode, setDemoMode] = useState(false);
  const [demoCountdown, setDemoCountdown] = useState(30);
  const [demoParticipants, setDemoParticipants] = useState<DemoParticipant[]>([]);
  const [demoPhase, setDemoPhase] = useState<'waiting' | 'arena' | 'results'>('waiting');

  //  References to the PhaserGame component (game and scene are exposed)
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  // Get current game state
  const currentGame = useQuery(api.games.getCurrentGame);
  
  // Start demo mode when no real game exists
  useEffect(() => {
    if (currentGame === null) {
      setDemoMode(true);
      setDemoCountdown(30);
      setDemoParticipants([]);
      setDemoPhase('waiting');
    } else {
      setDemoMode(false);
    }
  }, [currentGame]);
  
  // Demo countdown timer
  useEffect(() => {
    if (!demoMode) return;
    
    const timer = setInterval(() => {
      setDemoCountdown((prev) => {
        if (prev <= 1) {
          setDemoPhase('arena');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [demoMode]);
  
  // Spawn demo participants randomly
  useEffect(() => {
    if (!demoMode || demoPhase !== 'waiting') return;
    
    const spawnInterval = setInterval(() => {
      setDemoParticipants((prev) => {
        if (prev.length >= 8) return prev; // Max 8 demo participants
        
        const newParticipant = generateDemoParticipant(prev.length, 8);
        
        // Notify Phaser scene about new demo participant
        if (phaserRef.current?.scene) {
          const scene = phaserRef.current.scene;
          if (scene.scene.key === 'RoyalRumble') {
            (scene as any).spawnDemoParticipant?.(newParticipant);
          }
        }
        
        return [...prev, newParticipant];
      });
    }, 3000); // Spawn a new bot every 3 seconds
    
    return () => clearInterval(spawnInterval);
  }, [demoMode, demoPhase]);
  
  // Handle demo phase transitions
  useEffect(() => {
    if (!demoMode || demoPhase !== 'arena') return;
    
    // After 10 seconds in arena, determine winner and show results
    const arenaTimer = setTimeout(() => {
      const winner = generateDemoWinner(demoParticipants);
      
      // Notify Phaser about demo winner
      if (phaserRef.current?.scene) {
        const scene = phaserRef.current.scene;
        if (scene.scene.key === 'RoyalRumble') {
          (scene as any).showDemoWinner?.(winner);
        }
      }
      
      setDemoPhase('results');
      
      // After 5 seconds, restart demo
      setTimeout(() => {
        setDemoCountdown(30);
        setDemoParticipants([]);
        setDemoPhase('waiting');
      }, 5000);
    }, 10000);
    
    return () => clearTimeout(arenaTimer);
  }, [demoMode, demoPhase, demoParticipants]);

  // Mutation to trigger blockchain call
  const triggerBlockchainCall = useMutation(api.games.triggerBlockchainCall);

  // Event emitted from the PhaserGame component
  const currentScene = (scene: Phaser.Scene) => {
    // Update Phaser scene with game state when it's ready
    if (scene && scene.scene.key === 'RoyalRumble') {
      if (currentGame) {
        (scene as any).updateGameState?.(currentGame);
      } else if (demoMode) {
        // Pass demo state to scene
        (scene as any).updateDemoState?.({
          isDemo: true,
          countdown: demoCountdown,
          phase: demoPhase,
          participants: demoParticipants
        });
      }
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

  // Update Phaser scene when game state or demo state changes
  useEffect(() => {
    if (phaserRef.current?.scene) {
      const scene = phaserRef.current.scene;
      if (scene.scene.key === 'RoyalRumble') {
        if (currentGame) {
          (scene as any).updateGameState?.(currentGame);
        } else if (demoMode) {
          (scene as any).updateDemoState?.({
            isDemo: true,
            countdown: demoCountdown,
            phase: demoPhase,
            participants: demoParticipants
          });
        }

        // Detect new players joining in real-time
        if (currentGame && currentGame.status === 'waiting' && currentGame.participants) {
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
  }, [currentGame, previousParticipants, demoMode, demoCountdown, demoPhase, demoParticipants]);

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
        
        {/* Demo Mode Indicator */}
        {demoMode && (
          <DemoModeIndicator 
            countdown={demoCountdown}
            phase={demoPhase}
            participantCount={demoParticipants.length}
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
