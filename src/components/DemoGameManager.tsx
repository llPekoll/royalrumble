import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  DemoParticipant,
  generateDemoParticipant,
  generateDemoWinner,
  generateRandomSpawnIntervals,
  DEMO_PARTICIPANT_COUNT,
} from "../lib/demoGenerator";
import { IRefPhaserGame } from "../PhaserGame";

export type DemoPhase = "spawning" | "arena" | "results";

interface DemoGameManagerProps {
  isActive: boolean; // True when no real game exists
  phaserRef: React.RefObject<IRefPhaserGame | null>;
  onStateChange?: (state: DemoStateForUI) => void; // Callback to send state to parent
}

export interface DemoState {
  isActive: boolean;
  phase: DemoPhase;
  countdown: number;
  participants: DemoParticipant[];
  map: any;
}

export interface DemoStateForUI {
  phase: DemoPhase;
  countdown: number;
  participantCount: number;
}

export function DemoGameManager({ isActive, phaserRef, onStateChange }: DemoGameManagerProps) {
  const [countdown, setCountdown] = useState(30);
  const [spawnedParticipants, setSpawnedParticipants] = useState<DemoParticipant[]>([]);
  const [phase, setPhase] = useState<DemoPhase>("spawning");
  const [demoMap, setDemoMap] = useState<any>(null);
  const isSpawningRef = useRef(false);

  // Get random map for demo mode (only fetch once per demo session)
  const randomMap = useQuery(api.maps.getRandomMap);
  // Get all characters from database
  const charactersQuery = useQuery(api.characters.getActiveCharacters);

  // Memoize characters to prevent reference changes from triggering re-spawns
  const characters = useMemo(() => charactersQuery, [charactersQuery?.length]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        phase,
        countdown,
        participantCount: spawnedParticipants.length,
      });
    }
  }, [phase, countdown, spawnedParticipants.length, onStateChange]);

  // Initialize demo mode when activated
  useEffect(() => {
    if (isActive) {
      setCountdown(30);
      setSpawnedParticipants([]);
      setPhase("spawning");
      isSpawningRef.current = false;
      // Set random map when entering demo mode
      if (randomMap && !demoMap) {
        setDemoMap(randomMap);
      }
    } else {
      // Clean up when deactivated
      setDemoMap(null);
      setSpawnedParticipants([]);
      isSpawningRef.current = false;
    }
  }, [isActive, randomMap, demoMap]);

  // Demo countdown timer (30s spawning phase)
  useEffect(() => {
    if (!isActive || phase !== "spawning") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Transition to arena phase after 30 seconds
          setPhase("arena");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, phase]);

  // Gradually spawn demo bots with random intervals during the 30-second spawning phase
  useEffect(() => {
    if (!isActive || phase !== "spawning" || !demoMap || !characters || characters.length === 0 || isSpawningRef.current) {
      return;
    }

    isSpawningRef.current = true;

    // Generate map config from the random map
    const mapConfig = demoMap?.spawnConfiguration
      ? {
          spawnRadius: demoMap.spawnConfiguration.spawnRadius,
          centerX: 512, // Standard canvas center
          centerY: 384,
        }
      : undefined;

    // Generate random spawn intervals for all bots
    const spawnIntervals = generateRandomSpawnIntervals(DEMO_PARTICIPANT_COUNT);
    const timeouts: NodeJS.Timeout[] = [];

    // Schedule each bot spawn with its random interval
    let cumulativeTime = 0;
    spawnIntervals.forEach((interval, index) => {
      cumulativeTime += interval;

      const timeout = setTimeout(() => {
        setSpawnedParticipants((prev) => {
          if (prev.length >= DEMO_PARTICIPANT_COUNT) {
            return prev;
          }

          const newParticipant = generateDemoParticipant(
            prev.length,
            DEMO_PARTICIPANT_COUNT,
            characters,
            mapConfig
          );

          // Spawn in Phaser scene
          if (phaserRef.current?.scene?.scene.key === "DemoScene") {
            (phaserRef.current.scene as any).spawnDemoParticipant?.(newParticipant);
          }

          return [...prev, newParticipant];
        });
      }, cumulativeTime);

      timeouts.push(timeout);
    });

    // Cleanup all timeouts on unmount or phase change
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [isActive, phase, demoMap?.name, characters?.length]);

  // Handle arena phase: move bots to center and determine winner
  useEffect(() => {
    if (!isActive || phase !== "arena" || spawnedParticipants.length === 0) return;

    // Immediately move all participants to center when arena starts
    if (phaserRef.current?.scene) {
      const scene = phaserRef.current.scene;
      if (scene.scene.key === "DemoScene") {
        (scene as any).moveParticipantsToCenter?.();
      }
    }

    // After 5-8 seconds of battle animation, determine winner
    const battleDuration = 5000 + Math.random() * 3000;
    const arenaTimer = setTimeout(() => {
      const winner = generateDemoWinner(spawnedParticipants);

      // Notify DemoScene about winner
      if (phaserRef.current?.scene) {
        const scene = phaserRef.current.scene;
        if (scene.scene.key === "DemoScene") {
          (scene as any).showDemoWinner?.(winner);
        }
      }

      setPhase("results");

      // After 5 seconds, restart demo
      setTimeout(() => {
        // Clear participants in DemoScene
        if (phaserRef.current?.scene) {
          const scene = phaserRef.current.scene;
          if (scene.scene.key === "DemoScene") {
            (scene as any).clearDemoParticipants?.();
          }
        }

        // Reset demo state
        setCountdown(30);
        setSpawnedParticipants([]);
        isSpawningRef.current = false;
        setPhase("spawning");
      }, 5000);
    }, battleDuration);

    return () => clearTimeout(arenaTimer);
  }, [isActive, phase, spawnedParticipants]);

  // Set demo map when it's loaded
  useEffect(() => {
    if (!isActive || !phaserRef.current?.scene || !demoMap) return;

    const scene = phaserRef.current.scene;
    if (scene.scene.key === "DemoScene") {
      (scene as any).setDemoMap?.(demoMap);
    }
  }, [isActive, demoMap]);

  // This component doesn't render anything, it just manages state
  return null;
}
