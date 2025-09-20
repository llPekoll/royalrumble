import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { Plus, Minus, Users, Coins } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

interface ParticipantForm {
  characterId: string;
  betAmount: number;
  displayName: string;
  colorHue: number;
}

export function MultiParticipantPanel() {
  const { connected, publicKey } = useWallet();
  const [participants, setParticipants] = useState<ParticipantForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current game
  const currentGame = useQuery(api.games.getCurrentGame);
  
  // Get player data
  const playerData = useQuery(
    api.players.getPlayerWithCharacter,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip"
  );

  // Get available characters
  const characters = useQuery(api.characters.getActiveCharacters);

  // Get player's current participants in the game
  const playerParticipants = useQuery(
    api.gameParticipants.getPlayerParticipants,
    connected && publicKey && currentGame && playerData
      ? { gameId: currentGame._id, playerId: playerData._id }
      : "skip"
  );

  // Mutations
  const addParticipant = useMutation(api.gameParticipants.addParticipant);

  const gameCoins = playerData?.gameCoins || 0;
  const currentCharacter = playerData?.currentCharacter;
  const canAddParticipants = currentGame?.status === "waiting";
  const maxParticipants = currentGame?.map?.spawnConfiguration?.maxPlayers || 20;
  const currentParticipantCount = currentGame?.participantCount || 0;

  // Initialize with one participant using current character
  useEffect(() => {
    if (currentCharacter && participants.length === 0) {
      setParticipants([{
        characterId: currentCharacter._id,
        betAmount: 100,
        displayName: playerData?.displayName || "Player",
        colorHue: Math.random() * 360,
      }]);
    }
  }, [currentCharacter, participants.length, playerData?.displayName]);

  const addNewParticipant = () => {
    if (!currentCharacter) return;
    
    setParticipants(prev => [...prev, {
      characterId: currentCharacter._id,
      betAmount: 100,
      displayName: `${playerData?.displayName || "Player"} #${prev.length + 1}`,
      colorHue: Math.random() * 360,
    }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof ParticipantForm, value: any) => {
    setParticipants(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const getTotalBetAmount = () => {
    return participants.reduce((sum, p) => sum + p.betAmount, 0);
  };

  const validateAndSubmit = async () => {
    if (!connected || !publicKey || !currentGame || !playerData) {
      toast.error("Please connect your wallet and wait for game data to load");
      return;
    }

    if (!canAddParticipants) {
      toast.error("Cannot add participants - game has already started");
      return;
    }

    // Validation
    const totalBet = getTotalBetAmount();
    if (totalBet > gameCoins) {
      toast.error(`Insufficient coins. Need ${totalBet} coins, have ${gameCoins}`);
      return;
    }

    if (currentParticipantCount + participants.length > maxParticipants) {
      toast.error(`Too many participants. Map limit: ${maxParticipants}`);
      return;
    }

    for (const participant of participants) {
      if (participant.betAmount < 10 || participant.betAmount > 10000) {
        toast.error("Bet amounts must be between 10 and 10,000 coins");
        return;
      }
      if (!participant.displayName.trim()) {
        toast.error("All participants must have names");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Add participants one by one
      for (const participant of participants) {
        await addParticipant({
          gameId: currentGame._id,
          playerId: playerData._id,
          walletAddress: publicKey.toString(),
          characterId: participant.characterId as Id<"characters">,
          betAmount: participant.betAmount,
          displayName: participant.displayName.trim(),
          colorHue: participant.colorHue,
        });
      }

      toast.success(`Added ${participants.length} participant(s) to the game!`);
      
      // Reset form
      setParticipants([]);
    } catch (error) {
      console.error("Failed to add participants:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add participants");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCharacterName = (characterId: string) => {
    return characters?.find(c => c._id === characterId)?.name || "Unknown";
  };

  const getColorPreview = (hue: number) => {
    return `hsl(${hue}, 80%, 60%)`;
  };

  if (!connected) {
    return (
      <Card className="p-4">
        <p className="text-center text-gray-500">Connect your wallet to participate</p>
      </Card>
    );
  }

  if (!currentGame) {
    return (
      <Card className="p-4">
        <p className="text-center text-gray-500">Loading game...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Add Participants
          </h3>
          <div className="text-sm text-gray-400">
            Game: {currentParticipantCount}/{maxParticipants} participants
          </div>
        </div>

        {!canAddParticipants && (
          <div className="bg-yellow-900/20 border border-yellow-500 rounded p-3 mb-4">
            <p className="text-yellow-400 text-sm">
              Game has started. Cannot add more participants.
            </p>
          </div>
        )}

        {/* Current Participants in Game */}
        {playerParticipants && playerParticipants.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Your Current Participants</h4>
            <div className="space-y-2">
              {playerParticipants.map((participant: any) => (
                <div key={participant._id} className="bg-green-900/20 border border-green-500 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{participant.displayName}</span>
                      <span className="text-gray-400 ml-2">
                        ({getCharacterName(participant.characterId)})
                      </span>
                    </div>
                    <div className="text-yellow-400">
                      {participant.betAmount} coins
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Participants Form */}
        {canAddParticipants && (
          <>
            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div key={index} className="border border-gray-600 rounded p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Participant #{index + 1}</h4>
                    {participants.length > 1 && (
                      <Button
                        onClick={() => removeParticipant(index)}
                        size="sm"
                        variant="outline"
                        className="text-red-400 border-red-400"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`name-${index}`}>Display Name</Label>
                      <Input
                        id={`name-${index}`}
                        value={participant.displayName}
                        onChange={(e) => updateParticipant(index, 'displayName', e.target.value)}
                        placeholder="Participant name"
                        maxLength={20}
                      />
                    </div>

                    <div>
                      <Label htmlFor={`bet-${index}`}>Bet Amount</Label>
                      <div className="relative">
                        <Input
                          id={`bet-${index}`}
                          type="number"
                          value={participant.betAmount}
                          onChange={(e) => updateParticipant(index, 'betAmount', parseInt(e.target.value) || 0)}
                          min={10}
                          max={10000}
                          className="pr-16"
                        />
                        <Coins className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-400" />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`character-${index}`}>Character</Label>
                      <select
                        id={`character-${index}`}
                        value={participant.characterId}
                        onChange={(e) => updateParticipant(index, 'characterId', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded"
                      >
                        {characters?.map((char: any) => (
                          <option key={char._id} value={char._id}>
                            {char.name} ({char.rarity})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor={`color-${index}`}>Color Variation</Label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`color-${index}`}
                          type="range"
                          min="0"
                          max="360"
                          value={participant.colorHue}
                          onChange={(e) => updateParticipant(index, 'colorHue', parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <div
                          className="w-8 h-8 rounded border border-gray-600"
                          style={{ backgroundColor: getColorPreview(participant.colorHue) }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-600">
              <div className="text-sm text-gray-400">
                <div>Total bet: <span className="text-yellow-400">{getTotalBetAmount()} coins</span></div>
                <div>Available: <span className="text-green-400">{gameCoins} coins</span></div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={addNewParticipant}
                  variant="outline"
                  disabled={participants.length >= 5} // Reasonable limit per player
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another
                </Button>

                <Button
                  onClick={validateAndSubmit}
                  disabled={isSubmitting || participants.length === 0 || getTotalBetAmount() > gameCoins}
                >
                  {isSubmitting ? 'Adding...' : `Join Game (${participants.length} participants)`}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}