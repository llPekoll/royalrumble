import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { toast } from "sonner";
import { Dice6 } from "lucide-react";

interface Character {
  _id: string;
  name: string;
  spriteKey: string;
  description?: string;
  baseStats?: {
    power: number;
    speed: number;
    luck: number;
  };
  rarity?: string;
}

interface CharacterSelectionProps {
  onCharacterSelect: (character: Character) => void;
  selectedCharacter?: Character | null;
  gameParticipants?: { current: number; max: number };
}

export function CharacterSelection({ onCharacterSelect, selectedCharacter, gameParticipants }: CharacterSelectionProps) {
  const { connected } = useWallet();
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(selectedCharacter || null);

  // Get all available characters
  const allCharacters = useQuery(api.characters.getActiveCharacters);

  // Initialize with random character when characters load
  useEffect(() => {
    if (allCharacters && allCharacters.length > 0 && !currentCharacter) {
      const randomChar = allCharacters[Math.floor(Math.random() * allCharacters.length)];
      setCurrentCharacter(randomChar);
      onCharacterSelect(randomChar);
    }
  }, [allCharacters, currentCharacter, onCharacterSelect]);

  // Update when selectedCharacter prop changes
  useEffect(() => {
    if (selectedCharacter) {
      setCurrentCharacter(selectedCharacter);
    }
  }, [selectedCharacter]);

  const handleReroll = () => {
    if (!allCharacters || allCharacters.length === 0) {
      toast.error("No characters available");
      return;
    }

    // Get a random character different from current
    const availableCharacters = allCharacters.filter(c => c._id !== currentCharacter?._id);
    if (availableCharacters.length === 0) {
      toast.error("No other characters available");
      return;
    }

    const randomChar = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
    setCurrentCharacter(randomChar);
    onCharacterSelect(randomChar);
    toast.success(`New character: ${randomChar.name}!`);
  };


  if (!connected) {
    return (
      <Card className="p-4 bg-gray-900/80 backdrop-blur-sm">
        <p className="text-center text-gray-500">Connect your wallet to see your character</p>
      </Card>
    );
  }

  if (!currentCharacter) {
    return (
      <Card className="p-4 bg-gray-900/80 backdrop-blur-sm">
        <p className="text-center text-gray-500">Loading character...</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gray-900/80 backdrop-blur-sm">
      <div className="flex items-center justify-between ">
        <h3 className="text-lg font-bold">Your Current Character</h3>
        {gameParticipants && (
          <div className="text-sm text-gray-400">
            Game: {gameParticipants.current}/{gameParticipants.max} participants
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xl font-bold">{currentCharacter.name}</h4>
      </div>

      {currentCharacter.description && (
        <p className="text-gray-300 text-sm mb-3">{currentCharacter.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          <div>Free rerolls before joining game</div>
        </div>

        <Button
          onClick={handleReroll}
          disabled={!allCharacters || allCharacters.length <= 1}
          className="flex items-center gap-2"
        >
          <Dice6 className="w-4 h-4" />
          Reroll Character
        </Button>
      </div>
    </Card>
  );
}
