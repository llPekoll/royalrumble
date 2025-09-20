import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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

export function CharacterSelection() {
  const { connected, publicKey } = useWallet();
  const [isRerolling, setIsRerolling] = useState(false);

  // Get player with current character
  const playerData = useQuery(
    api.players.getPlayerWithCharacter,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip"
  );

  // Get all available characters for reference
  const allCharacters = useQuery(api.characters.getActiveCharacters);

  // Mutations
  const rerollCharacter = useMutation(api.players.rerollCharacter);

  const currentCharacter = playerData?.currentCharacter;
  const rerollsRemaining = playerData ? Math.max(0, 3 - (playerData.characterRerolls || 0)) : 0;
  const gameCoins = playerData?.gameCoins || 0;
  const rerollCost = 100;

  const handleReroll = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (rerollsRemaining <= 0) {
      toast.error("No rerolls remaining today");
      return;
    }

    if (gameCoins < rerollCost) {
      toast.error(`Insufficient coins. Need ${rerollCost} coins to reroll.`);
      return;
    }

    setIsRerolling(true);
    try {
      const result = await rerollCharacter({
        walletAddress: publicKey.toString(),
        cost: rerollCost,
      });

      toast.success(`New character: ${result.newCharacter.name}!`);
    } catch (error) {
      console.error("Failed to reroll character:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reroll character");
    } finally {
      setIsRerolling(false);
    }
  };

  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-400';
      case 'rare': return 'text-green-400';
      case 'epic': return 'text-purple-400';
      case 'legendary': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getRarityBorder = (rarity?: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-400';
      case 'rare': return 'border-green-400';
      case 'epic': return 'border-purple-400';
      case 'legendary': return 'border-yellow-400';
      default: return 'border-gray-400';
    }
  };

  if (!connected) {
    return (
      <Card className="p-4">
        <p className="text-center text-gray-500">Connect your wallet to see your character</p>
      </Card>
    );
  }

  if (!currentCharacter) {
    return (
      <Card className="p-4">
        <p className="text-center text-gray-500">Loading character...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-lg font-bold mb-4">Your Current Character</h3>
        
        <div className={`p-4 rounded-lg border-2 ${getRarityBorder(currentCharacter.rarity)} bg-gray-800`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xl font-bold">{currentCharacter.name}</h4>
            <span className={`text-sm font-semibold ${getRarityColor(currentCharacter.rarity)} capitalize`}>
              {currentCharacter.rarity || 'common'}
            </span>
          </div>
          
          {currentCharacter.description && (
            <p className="text-gray-300 text-sm mb-3">{currentCharacter.description}</p>
          )}
          
          {currentCharacter.baseStats && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-red-900/30 p-2 rounded text-center">
                <div className="text-xs text-gray-400">Power</div>
                <div className="font-bold text-red-400">{currentCharacter.baseStats.power.toFixed(1)}</div>
              </div>
              <div className="bg-blue-900/30 p-2 rounded text-center">
                <div className="text-xs text-gray-400">Speed</div>
                <div className="font-bold text-blue-400">{currentCharacter.baseStats.speed.toFixed(1)}</div>
              </div>
              <div className="bg-green-900/30 p-2 rounded text-center">
                <div className="text-xs text-gray-400">Luck</div>
                <div className="font-bold text-green-400">{currentCharacter.baseStats.luck.toFixed(1)}</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              <div>Rerolls remaining: <span className="text-white">{rerollsRemaining}/3</span></div>
              <div>Cost: <span className="text-yellow-400">{rerollCost} coins</span></div>
            </div>
            
            <Button
              onClick={handleReroll}
              disabled={isRerolling || rerollsRemaining <= 0 || gameCoins < rerollCost}
              className="flex items-center gap-2"
            >
              <Dice6 className={`w-4 h-4 ${isRerolling ? 'animate-spin' : ''}`} />
              {isRerolling ? 'Rolling...' : 'Reroll Character'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Character Gallery */}
      {allCharacters && allCharacters.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-4">All Available Characters</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {allCharacters.map((character: Character) => (
              <div
                key={character._id}
                className={`p-3 rounded-lg border ${
                  character._id === currentCharacter._id 
                    ? `${getRarityBorder(character.rarity)} bg-gray-700` 
                    : 'border-gray-600 bg-gray-800'
                } transition-all hover:border-gray-500`}
              >
                <div className="text-center">
                  <h4 className="font-semibold text-sm mb-1">{character.name}</h4>
                  <span className={`text-xs ${getRarityColor(character.rarity)} capitalize`}>
                    {character.rarity || 'common'}
                  </span>
                  
                  {character.baseStats && (
                    <div className="mt-2 text-xs">
                      <div className="flex justify-between">
                        <span>Power:</span>
                        <span className="text-red-400">{character.baseStats.power.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Speed:</span>
                        <span className="text-blue-400">{character.baseStats.speed.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Luck:</span>
                        <span className="text-green-400">{character.baseStats.luck.toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                  
                  {character._id === currentCharacter._id && (
                    <div className="mt-2 text-xs text-yellow-400 font-semibold">★ Current</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}