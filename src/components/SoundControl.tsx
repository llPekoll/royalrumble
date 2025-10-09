import { Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { EventBus } from "../game/EventBus";

export function SoundControl() {
  const [isMuted, setIsMuted] = useState(false);
  const [currentScene, setCurrentScene] = useState<any>(null);

  // Listen for scene changes
  useEffect(() => {
    const handleSceneReady = (scene: any) => {
      setCurrentScene(scene);
      // Restore mute state when scene changes
      if (scene?.sound) {
        scene.sound.mute = isMuted;
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

    // Apply mute to current scene's sound manager
    if (currentScene?.sound) {
      currentScene.sound.mute = newMutedState;
      console.log(`[SoundControl] Sound ${newMutedState ? "muted" : "unmuted"}`);
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
