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
  const spawnTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const renderCountRef = useRef(0);
  const spawnCountRef = useRef(0);
  
  // Log render count
  useEffect(() => {
    renderCountRef.current++;
    console.log(`[DemoGameManager] Render #${renderCountRef.current}`, {
      isActive,
      phase,
      spawnedCount: spawnedParticipants.length,
      isSpawning: isSpawningRef.current,
      hasMap: !!demoMap,
      hasCharacters: !!charactersQuery
    });
  });

  // Get random map for demo mode (only fetch once per demo session)
  const randomMap = useQuery(api.maps.getRandomMap);
  // Get all characters from database
  const charactersQuery = useQuery(api.characters.getActiveCharacters);

  // Memoize characters to prevent reference changes from triggering re-spawns
  const characters = useMemo(() => charactersQuery, [charactersQuery?.length]);
  
  // Memoize map to prevent reference changes
  const stableMap = useMemo(() => demoMap, [demoMap?.name, demoMap?.spawnConfiguration?.spawnRadius]);

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
      spawnCountRef.current = 0;
      spawnTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      spawnTimeoutsRef.current = [];
      // Set random map when entering demo mode
      if (randomMap && !demoMap) {
        console.log('[DemoGameManager] Setting demo map:', randomMap?.name);
        setDemoMap(randomMap);
      }
    } else {
      // Clean up when deactivated
      console.log('[DemoGameManager] Deactivating demo mode');
      setDemoMap(null);
      setSpawnedParticipants([]);
      isSpawningRef.current = false;
      spawnCountRef.current = 0;
      spawnTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      spawnTimeoutsRef.current = [];
    }
  }, [isActive]);

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
    console.log('[DemoGameManager] Spawn effect triggered', {
      isActive,
      phase,
      hasDemoMap: !!demoMap,
      mapName: demoMap?.name,
      hasCharacters: !!characters,
      charLength: characters?.length,
      isSpawning: isSpawningRef.current,
      spawnedCount: spawnedParticipants.length,
      existingTimeouts: spawnTimeoutsRef.current.length
    });
    
    if (!isActive || phase !== "spawning" || !stableMap || !characters || characters.length === 0) {
      console.log('[DemoGameManager] Spawn effect early return - conditions not met');
      return;
    }

    // Check if already spawning to prevent double spawning
    if (isSpawningRef.current || spawnTimeoutsRef.current.length > 0) {
      console.log('[DemoGameManager] Already spawning or timeouts exist, skipping', {
        isSpawning: isSpawningRef.current,
        timeoutCount: spawnTimeoutsRef.current.length
      });
      return;
    }

    console.log('[DemoGameManager] Starting spawn sequence');
    isSpawningRef.current = true;
    spawnCountRef.current = 0; // Reset spawn count

    // Generate map config from the random map
    const mapConfig = stableMap?.spawnConfiguration
      ? {
          spawnRadius: stableMap.spawnConfiguration.spawnRadius,
          centerX: 512, // Standard canvas center
          centerY: 384,
        }
      : undefined;

    // Generate random spawn intervals for all bots
    const spawnIntervals = generateRandomSpawnIntervals(DEMO_PARTICIPANT_COUNT);

    // Clear any existing timeouts first
    spawnTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    spawnTimeoutsRef.current = [];

    // Schedule each bot spawn with its random interval
    let cumulativeTime = 0;
    spawnIntervals.forEach((interval, index) => {
      cumulativeTime += interval;

      const timeout = setTimeout(() => {
        // Use ref-based counting to avoid race conditions
        if (spawnCountRef.current >= DEMO_PARTICIPANT_COUNT) {
          console.log(`[DemoGameManager] Spawn ${index}: Max participants reached via ref`);
          return;
        }

        const currentSpawnIndex = spawnCountRef.current;
        spawnCountRef.current++;

        const newParticipant = generateDemoParticipant(
          currentSpawnIndex,
          DEMO_PARTICIPANT_COUNT,
          characters,
          mapConfig
        );

        console.log(`[DemoGameManager] Spawn ${index}: Creating participant`, {
          id: newParticipant._id,
          spawnIndex: currentSpawnIndex,
          totalSpawned: spawnCountRef.current,
          sceneKey: phaserRef.current?.scene?.scene.key
        });

        // Spawn in Phaser scene first
        if (phaserRef.current?.scene?.scene.key === "DemoScene") {
          console.log(`[DemoGameManager] Calling spawnDemoParticipant for ${newParticipant._id}`);
          (phaserRef.current.scene as any).spawnDemoParticipant?.(newParticipant);
        }

        // Then update state
        setSpawnedParticipants((prev) => {
          console.log(`[DemoGameManager] Updating state: prev.length=${prev.length}, adding ${newParticipant._id}`);
          return [...prev, newParticipant];
        });
      }, cumulativeTime);

      spawnTimeoutsRef.current.push(timeout);
    });

    // Cleanup all timeouts on unmount or phase change
    return () => {
      console.log('[DemoGameManager] Spawn effect cleanup, clearing timeouts');
      spawnTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      spawnTimeoutsRef.current = [];
      // Don't reset isSpawningRef here - only reset when phase changes to spawning
    };
  }, [isActive, phase, stableMap, characters]);

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
        spawnCountRef.current = 0;
        spawnTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        spawnTimeoutsRef.current = [];
        setPhase("spawning");
      }, 5000);
    }, battleDuration);

    return () => clearTimeout(arenaTimer);
  }, [isActive, phase, spawnedParticipants]);

  // Set demo map when it's loaded
  useEffect(() => {
    console.log('[DemoGameManager] Set map effect', {
      isActive,
      hasDemoMap: !!demoMap,
      mapName: demoMap?.name,
      sceneKey: phaserRef.current?.scene?.scene.key
    });
    
    if (!isActive || !phaserRef.current?.scene || !stableMap) return;

    const scene = phaserRef.current.scene;
    if (scene.scene.key === "DemoScene") {
      console.log('[DemoGameManager] Setting demo map in scene:', stableMap.name);
      (scene as any).setDemoMap?.(stableMap);
    }
  }, [isActive, stableMap]);

  // This component doesn't render anything, it just manages state
  return null;
}
