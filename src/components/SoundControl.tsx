import { Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { EventBus } from "../game/EventBus";

export function SoundControl() {
  const [isMuted, setIsMuted] = useState(() => {
    // Load mute preference from localStorage
    const saved = localStorage.getItem("sound-muted");
    return saved === "true";
  });
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);

  // Listen for scene changes to get the game instance
  useEffect(() => {
    const handleSceneReady = (scene: Phaser.Scene) => {
      console.log("[SoundControl] Scene ready, applying mute state:", isMuted);
      // Get the game instance from the scene
      if (scene?.game) {
        setGameInstance(scene.game);

        // Apply mute state to the game's sound manager
        scene.game.sound.mute = isMuted;

        // Also try to resume the audio context if it's suspended
        if (scene.game.sound.context && scene.game.sound.context.state === 'suspended') {
          scene.game.sound.context.resume().then(() => {
            console.log("[SoundControl] Audio context resumed");
            // Reapply mute state after resuming
            scene.game.sound.mute = isMuted;
          });
        }
      }
    };

    EventBus.on("current-scene-ready", handleSceneReady);

    return () => {
      EventBus.off("current-scene-ready", handleSceneReady);
    };
  }, [isMuted]);

  const toggleSound = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Save preference to localStorage
    localStorage.setItem("sound-muted", String(newMutedState));

    // Apply mute to the game's global sound manager
    if (gameInstance?.sound) {
      gameInstance.sound.mute = newMutedState;
      console.log(`[SoundControl] Sound ${newMutedState ? "muted" : "unmuted"}`);

      // Emit event so scenes can react to mute changes
      EventBus.emit("sound-mute-changed", newMutedState);
    }
  };

  return (
    <Button
      onClick={toggleSound}
      variant="ghost"
      className="text-gray-300 hover:text-white hover:bg-gray-800"
      title={isMuted ? "Unmute sound" : "Mute sound"}
    >
      {isMuted ? (
        <VolumeX className="h-5 w-5" />
      ) : (
        <Volume2 className="h-5 w-5" />
      )}
      <span className="ml-2 hidden sm:inline text-lg">
        {isMuted ? "Sound Off" : "Sound On"}
      </span>
    </Button>
  );
}
