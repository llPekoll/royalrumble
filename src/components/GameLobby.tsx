import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { CharacterSelection } from "./CharacterSelection";
import { MultiParticipantPanel } from "./MultiParticipantPanel";
import { 
  Clock, 
  Users, 
  Coins, 
  Trophy, 
  Target,
  Map,
  Gamepad2
} from "lucide-react";

export function GameLobby() {
  const { connected, publicKey } = useWallet();
  const [spectatorBetAmount, setSpectatorBetAmount] = useState(100);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");

  // Get current game
  const currentGame = useQuery(api.games.getCurrentGame);

  // Get player data  
  const playerData = useQuery(
    api.players.getPlayerWithCharacter,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip"
  );

  // Get betting statistics
  const bettingStats = useQuery(
    api.bets.getBettingStats,
    currentGame ? { gameId: currentGame._id } : "skip"
  );

  // Mutations
  const createPlayer = useMutation(api.players.createPlayer);
  const placeBet = useMutation(api.bets.placeBet);

  const gameCoins = playerData?.gameCoins || 0;

  // Check if player has participants in current game
  const playerParticipants = currentGame?.participants?.filter(
    (p: any) => p.walletAddress === publicKey?.toString()
  ) || [];

  // Get survivors for betting (only in large games during betting phase)
  const survivors = currentGame?.participants?.filter((p: any) => !p.eliminated) || [];
  const canPlaceSpectatorBets = currentGame?.status === "betting" && survivors.length > 0;

  // Get phase information
  const getPhaseInfo = () => {
    if (!currentGame) return { name: "Loading...", description: "" };

    const isSmallGame = currentGame.isSmallGame || currentGame.participantCount < 8;
    
    switch (currentGame.status) {
      case "waiting":
        return {
          name: "Waiting Phase",
          description: "Players joining and placing entry bets"
        };
      case "selection":
        return {
          name: "Selection Phase", 
          description: "Final character selection and preparation"
        };
      case "arena":
        return {
          name: "Arena Phase",
          description: "Characters moving to center for battle"
        };
      case "elimination":
        return {
          name: "Elimination Phase",
          description: isSmallGame ? "Small game - skipping elimination" : "Reducing to top 4 survivors"
        };
      case "betting":
        return {
          name: "Betting Phase",
          description: isSmallGame ? "Small game - skipping betting" : "Spectator betting on top 4 survivors"
        };
      case "battle":
        return {
          name: "Battle Phase", 
          description: "Final showdown between survivors"
        };
      case "results":
        return {
          name: "Results Phase",
          description: "Winner announced and rewards distributed"
        };
      default:
        return {
          name: "Unknown Phase",
          description: ""
        };
    }
  };

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const handleCreatePlayer = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      await createPlayer({ 
        walletAddress: publicKey.toString(),
        displayName: `Player ${Math.floor(Math.random() * 1000)}`
      });
      toast.success("Player created! You've been given a random character and 1000 starting coins.");
    } catch (error) {
      console.error("Failed to create player:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create player");
    }
  };

  const handleSpectatorBet = async () => {
    if (!connected || !publicKey || !currentGame || !playerData) {
      toast.error("Please connect your wallet and ensure game data is loaded");
      return;
    }

    if (!selectedParticipantId) {
      toast.error("Please select a participant to bet on");
      return;
    }

    if (spectatorBetAmount < 10 || spectatorBetAmount > 10000) {
      toast.error("Bet amount must be between 10 and 10,000 coins");
      return;
    }

    if (gameCoins < spectatorBetAmount) {
      toast.error("Insufficient game coins");
      return;
    }

    try {
      await placeBet({
        gameId: currentGame._id,
        playerId: playerData._id,
        walletAddress: publicKey.toString(),
        betType: "spectator",
        targetParticipantId: selectedParticipantId as Id<"gameParticipants">,
        amount: spectatorBetAmount,
      });

      toast.success("Spectator bet placed successfully!");
      setSelectedParticipantId("");
      setSpectatorBetAmount(100);
    } catch (error) {
      console.error("Failed to place spectator bet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to place bet");
    }
  };

  if (!connected) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Royal Rumble</h2>
          <p className="text-gray-400 mb-4">
            Connect your wallet to join the battle royale
          </p>
          <p className="text-sm text-gray-500">
            Control multiple characters, place strategic bets, and win rewards!
          </p>
        </Card>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h2 className="text-xl font-bold mb-2">Welcome to Royal Rumble!</h2>
          <p className="text-gray-400 mb-4">
            Create your player profile to start battling
          </p>
          <Button onClick={handleCreatePlayer} size="lg">
            Create Player Profile
          </Button>
        </Card>
      </div>
    );
  }

  const phaseInfo = getPhaseInfo();

  return (
    <div className="space-y-4">
      {/* Game Status Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold">{phaseInfo.name}</h3>
              <p className="text-sm text-gray-400">{phaseInfo.description}</p>
            </div>
          </div>
          
          {currentGame?.timeRemaining && (
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-400">
                {formatTimeRemaining(currentGame.timeRemaining)}
              </div>
              <div className="text-xs text-gray-400">remaining</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-gray-400" />
            <div className="text-sm text-gray-400">Participants</div>
            <div className="font-bold">{currentGame?.participantCount || 0}</div>
          </div>
          
          <div className="text-center">
            <Coins className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
            <div className="text-sm text-gray-400">Total Pool</div>
            <div className="font-bold text-yellow-400">{currentGame?.totalPot || 0}</div>
          </div>
          
          <div className="text-center">
            <Map className="w-5 h-5 mx-auto mb-1 text-green-400" />
            <div className="text-sm text-gray-400">Map</div>
            <div className="font-bold text-green-400">{currentGame?.map?.name || "Loading"}</div>
          </div>
          
          <div className="text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-purple-400" />
            <div className="text-sm text-gray-400">Your Coins</div>
            <div className="font-bold text-purple-400">{gameCoins}</div>
          </div>
        </div>

        {currentGame?.isSmallGame && (
          <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500 rounded text-center">
            <p className="text-blue-400 text-sm">
              ⚡ Quick Game Mode: 3 phases (45 seconds total)
            </p>
          </div>
        )}
      </Card>

      {/* Character Selection */}
      <CharacterSelection />

      {/* Multi-Participant Panel - only show during waiting phase */}
      {currentGame?.status === "waiting" && <MultiParticipantPanel />}

      {/* Current Participants */}
      {playerParticipants.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Your Participants ({playerParticipants.length})
          </h3>
          <div className="grid gap-3">
            {playerParticipants.map((participant: any) => (
              <div 
                key={participant._id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded border"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ 
                      backgroundColor: participant.colorHue !== undefined 
                        ? `hsl(${participant.colorHue}, 80%, 60%)` 
                        : '#666'
                    }}
                  />
                  <div>
                    <div className="font-medium">{participant.displayName}</div>
                    <div className="text-sm text-gray-400">
                      {participant.character?.name} • {participant.betAmount} coins
                    </div>
                  </div>
                </div>
                
                {participant.eliminated && (
                  <div className="text-red-400 text-sm font-semibold">ELIMINATED</div>
                )}
                
                {participant.finalPosition && (
                  <div className="text-yellow-400 text-sm font-semibold">
                    #{participant.finalPosition}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Spectator Betting - only show during betting phase */}
      {canPlaceSpectatorBets && (
        <Card className="p-4">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Spectator Betting
          </h3>
          
          <div className="space-y-4">
            <div className="grid gap-3">
              {survivors.map((participant: any) => {
                // Don't allow betting on own participants
                const isOwnParticipant = participant.walletAddress === publicKey?.toString();
                const stats = bettingStats?.participantStats?.find(
                  (s: any) => s.participantId === participant._id
                );
                
                return (
                  <div 
                    key={participant._id}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      selectedParticipantId === participant._id
                        ? 'border-blue-500 bg-blue-900/20'
                        : isOwnParticipant
                        ? 'border-gray-600 bg-gray-700/50 cursor-not-allowed opacity-50'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => !isOwnParticipant && setSelectedParticipantId(participant._id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ 
                            backgroundColor: participant.colorHue !== undefined 
                              ? `hsl(${participant.colorHue}, 80%, 60%)` 
                              : '#666'
                          }}
                        />
                        <div>
                          <div className="font-medium">{participant.displayName}</div>
                          <div className="text-sm text-gray-400">
                            {participant.character?.name} • {participant.betAmount} entry bet
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {stats && (
                          <div className="text-sm">
                            <div className="text-yellow-400">{stats.totalBetAmount} coins bet</div>
                            <div className="text-gray-400">{stats.betCount} bets</div>
                          </div>
                        )}
                        {isOwnParticipant && (
                          <div className="text-blue-400 text-xs">YOUR PARTICIPANT</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  value={spectatorBetAmount}
                  onChange={(e) => setSpectatorBetAmount(parseInt(e.target.value) || 0)}
                  placeholder="Bet amount"
                  min={10}
                  max={10000}
                />
              </div>
              <Button
                onClick={handleSpectatorBet}
                disabled={!selectedParticipantId || spectatorBetAmount < 10 || gameCoins < spectatorBetAmount}
              >
                Place Bet
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Game Results */}
      {currentGame?.status === "results" && currentGame.winnerId && (
        <Card className="p-4">
          <div className="text-center">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
            <h3 className="text-xl font-bold mb-2">Game Complete!</h3>
            
            {(() => {
              const winner = currentGame.participants?.find((p: any) => p._id === currentGame.winnerId);
              const isPlayerWinner = winner && playerParticipants.some((p: any) => p._id === winner._id);
              
              return (
                <div>
                  <p className="text-lg mb-2">
                    Winner: <span className="text-yellow-400 font-bold">{winner?.displayName}</span>
                  </p>
                  {isPlayerWinner && (
                    <p className="text-green-400 font-bold">🎉 Congratulations! You won! 🎉</p>
                  )}
                </div>
              );
            })()}
          </div>
        </Card>
      )}
    </div>
  );
}