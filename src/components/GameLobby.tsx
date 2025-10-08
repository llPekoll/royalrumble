import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePrivyWallet } from "../hooks/usePrivyWallet";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { MultiParticipantPanel } from "./MultiParticipantPanel";
import { CharacterSelection } from "./CharacterSelection";
import { generateRandomName } from "../lib/nameGenerator";
import {
  Users,
  Trophy,
  Target,
  Gamepad2
} from "lucide-react";

export function GameLobby() {
  const { connected, publicKey } = usePrivyWallet();
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



  const handleCreatePlayer = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const randomName = generateRandomName();
      console.log("Manual player creation for wallet:", publicKey.toString(), "with name:", randomName);

      await createPlayer({
        walletAddress: publicKey.toString(),
        displayName: randomName
      });
      toast.success(`Player created! Your display name is: ${randomName}. You've been given a random character and 1000 starting coins.`);
    } catch (error) {
      console.error("Failed to create player:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create player");
    }
  };

  // Stable callback for CharacterSelection
  const handleParticipantAdded = useCallback(() => {
    // No need to force re-render, queries will update automatically
  }, []);

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
      <Card className="p-4 text-center">
        <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <h2 className="text-lg font-bold mb-1">Royal Rumble</h2>
        <p className="text-sm text-gray-400 mb-2">
          Connect wallet to join
        </p>
        <p className="text-xs text-gray-500">
          Control characters & win rewards!
        </p>
      </Card>
    );
  }

  // Show create player UI only when:
  // - Wallet is connected
  // - Query has completed (playerData is not undefined)
  // - Player doesn't exist (playerData is null)
  if (connected && playerData === null) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-blue-400" />
          <h2 className="text-xl font-bold mb-2">Welcome to Royal Rumble!</h2>
          <p className="text-gray-400 mb-4">
            Create your player profile to start battling
          </p>
          <Button onClick={() => void handleCreatePlayer()} size="lg">
            Create Player Profile
          </Button>
        </Card>
      </div>
    );
  }

  // If wallet is connected but playerData is undefined, query is still loading
  if (connected && playerData === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // If not connected or no player data, show connect wallet message
  if (!connected || !playerData) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400">
            Please connect your wallet to start playing
          </p>
        </Card>
      </div>
    );
  }


  // Show "Waiting for players" when no game exists
  if (!currentGame) {
    return (
      <div className="space-y-4">
        {/*<Card className="p-6 text-center bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700">
          <Gamepad2 className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-pulse" />
          <h2 className="text-xl font-bold mb-2">Waiting for Players</h2>
          <p className="text-gray-400 mb-4">
            Be the first to join and start a new game!
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Game will begin when you place your first bet
          </p>
        </Card>*/}

        {/* Character Selection - allows first player to start the game */}
        <CharacterSelection
          onParticipantAdded={handleParticipantAdded}
        />

        {/* Multi-Participant Control */}
        <MultiParticipantPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Multi-Participant Panel - only show during waiting phase */}
      {currentGame?.status === "waiting" && (
        <>
          <MultiParticipantPanel />
          <CharacterSelection
            onParticipantAdded={handleParticipantAdded}
          />
        </>
      )}

      {/* Spectator Betting - only show during betting phase */}
      {canPlaceSpectatorBets && (
        <div className="p-6 bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-600/40 rounded-lg backdrop-blur-sm shadow-xl shadow-amber-500/10">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-amber-300 uppercase tracking-wide">
            <Target className="w-5 h-5 text-amber-400" />
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
                    className={`p-3 rounded border cursor-pointer transition-all ${selectedParticipantId === participant._id
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
                          <div className="font-bold text-amber-200">{participant.displayName}</div>
                          <div className="text-sm text-amber-400/70">
                            {participant.character?.name} • {participant.betAmount} entry bet
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {stats && (
                          <div className="text-sm">
                            <div className="text-amber-300">{stats.totalBetAmount} coins bet</div>
                            <div className="text-amber-400/60">{stats.betCount} bets</div>
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
                onClick={() => void handleSpectatorBet()}
                disabled={!selectedParticipantId || spectatorBetAmount < 10 || gameCoins < spectatorBetAmount}
              >
                Place Bet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game Results */}
      {currentGame?.status === "results" && currentGame.winnerId && (
        <div className="p-6 bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-600/40 rounded-lg backdrop-blur-sm shadow-xl shadow-amber-500/10">
          <div className="text-center">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-amber-400" />
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
        </div>
      )}
    </div>
  );
}
