import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

export function GameLobby() {
  const { connected, publicKey } = useWallet();
  const [betAmount, setBetAmount] = useState(100);

  // Get current game
  const currentGame = useQuery(api.games.getCurrentGame);

  // Get player data
  const playerData = useQuery(
    api.players.getPlayer,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip"
  );

  // Mutations
  const createPlayer = useMutation(api.players.createPlayer);
  const joinGame = useMutation(api.games.joinGame);
  const placeSpectatorBet = useMutation(api.games.placeSpectatorBet);

  const gameCoins = playerData?.gameCoins || 0;


  // Check if player is in current game
  const playerInGame = currentGame?.participants?.find(
    p => p.walletAddress === publicKey?.toString()
  );

  // Get top 4 for betting phase
  const top4 = currentGame?.participants?.filter(p => !p.eliminated) || [];

  const handleJoinGame = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (betAmount < 10 || betAmount > 10000) {
      toast.error("Bet amount must be between 10 and 10,000 coins");
      return;
    }

    if (gameCoins < betAmount) {
      toast.error("Insufficient game coins");
      return;
    }

    try {
      // Create player if doesn't exist
      if (!playerData) {
        await createPlayer({ walletAddress: publicKey.toString() });
      }

      await joinGame({
        walletAddress: publicKey.toString(),
        betAmount,
      });

      toast.success("Successfully joined the game!");
      setBetAmount(100); // Reset bet amount
    } catch (error) {
      console.error("Failed to join game:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join game");
    }
  };

  const handleSpectatorBet = async (targetId: Id<"gameParticipants">) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!currentGame) {
      toast.error("No active game");
      return;
    }

    if (betAmount < 10 || betAmount > 10000) {
      toast.error("Bet amount must be between 10 and 10,000 coins");
      return;
    }

    if (gameCoins < betAmount) {
      toast.error("Insufficient game coins");
      return;
    }

    try {
      await placeSpectatorBet({
        walletAddress: publicKey.toString(),
        gameId: currentGame._id,
        targetParticipantId: targetId,
        betAmount,
      });

      toast.success("Spectator bet placed!");
      setBetAmount(100); // Reset bet amount
    } catch (error) {
      console.error("Failed to place bet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to place bet");
    }
  };


  const getPhaseDescription = (game: any) => {
    switch (game.status) {
      case "waiting":
        return "⏳ Waiting for players to join";
      case "arena":
        return "🏃‍♂️ Players running to center";
      case "betting":
        return "💰 Betting on top 4 survivors";
      case "battle":
        return "⚔️ Final battle in progress";
      case "results":
        return "🏆 Showing results";
      default:
        return "🎮 Game in progress";
    }
  };

  const getPhaseName = (game: any) => {
    switch (game.status) {
      case "waiting":
        return "Join Phase";
      case "arena":
        return "Arena Phase";
      case "betting":
        return "Betting Phase";
      case "battle":
        return "Battle Phase";
      case "results":
        return "Results Phase";
      default:
        return "Game Phase";
    }
  };

  if (!currentGame) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">🎮 Royal Rumble</h2>
          <p className="text-gray-400 mb-4">Game Creation in progress...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Game Status Header */}
      <Card className="p-4 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">🏆 Royal Rumble</h1>
            <p className="text-sm text-purple-200">{getPhaseDescription(currentGame)}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-purple-400">
              Phase {currentGame.phase}/5
            </div>
            <div className="text-xs text-gray-400">{getPhaseName(currentGame)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">
              {currentGame.playerCount}
            </div>
            <div className="text-xs text-gray-400">Players</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {currentGame.totalPot.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">Total Pot</div>
          </div>
        </div>
      </Card>

      {/* Join Game or Spectator Betting */}
      {currentGame.status === "waiting" && !playerInGame && connected && (
        <Card className="p-4 border-green-500/30 bg-green-900/20">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-green-400">🎯 Join the Battle!</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Bet Amount (10-10,000 coins)
              </label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                min={10}
                max={10000}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded-md text-white"
              />
            </div>

            <Button
              onClick={handleJoinGame}
              disabled={!connected || gameCoins < betAmount}
              className="w-full bg-green-600 hover:bg-green-700 text-sm py-2"
            >
              Join Game ({betAmount.toLocaleString()} coins)
            </Button>
          </div>

          {!connected && (
            <p className="text-yellow-400 text-sm">
              💡 Connect your wallet to join the game
            </p>
          )}

          {connected && gameCoins < betAmount && (
            <p className="text-red-400 text-sm">
              ❌ Insufficient coins. You have {gameCoins.toLocaleString()} coins.
            </p>
          )}
        </Card>
      )}

      {/* Top 4 Betting Phase */}
      {currentGame.status === "betting" && top4.length > 0 && !playerInGame && connected && (
        <Card className="p-6 border-yellow-500/30 bg-yellow-900/20">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-yellow-400">🎲 Bet on the Winner!</h2>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bet Amount (10-10,000 coins)
            </label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min={10}
              max={10000}
              className="w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {top4.map((participant) => (
              <Card key={participant._id} className="p-4 bg-gray-800/50 border-gray-600">
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    🎮{participant.spriteIndex}
                  </div>
                  <div className="font-bold text-white mb-1">
                    {participant.displayName}
                  </div>
                  <div className="text-sm text-gray-400 mb-3">
                    Bet: {participant.betAmount.toLocaleString()} coins
                  </div>
                  <Button
                    onClick={() => handleSpectatorBet(participant._id)}
                    disabled={gameCoins < betAmount}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-sm"
                  >
                    Bet {betAmount.toLocaleString()}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Players List */}
      <Card className="p-4">
        <h2 className="text-lg font-bold text-white mb-3">
          👥 Players ({currentGame.participants?.length || 0})
        </h2>

        <div className="space-y-2">
          {currentGame.participants?.map((participant) => (
            <div
              key={participant._id}
              className={`p-2 rounded border ${
                participant.eliminated
                  ? "bg-red-900/20 border-red-500/30"
                  : "bg-blue-900/20 border-blue-500/30"
              } ${
                participant.walletAddress === publicKey?.toString()
                  ? "ring-1 ring-green-500"
                  : ""
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="text-lg">
                  {participant.eliminated ? "💀" : `🎮${participant.spriteIndex}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm truncate">
                    {participant.displayName}
                    {participant.isBot && " (Bot)"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {participant.betAmount.toLocaleString()} coins
                  </div>
                  {participant.eliminated && (
                    <div className="text-xs text-red-400">Eliminated</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(!currentGame.participants || currentGame.participants.length === 0) && (
          <div className="text-center text-gray-400 py-8">
            Be the first to join! and get more chance to win!
          </div>
        )}
      </Card>

      {/* Game Demo Mode Notice */}
      {currentGame.isDemo && (
        <Card className="p-4 bg-orange-900/20 border-orange-500/30">
          <div className="flex items-center space-x-2">
            <span className="text-orange-400">🤖</span>
            <span className="text-orange-300">
              Demo mode: This game is running with bots only
            </span>
          </div>
        </Card>
      )}

      {/* Single Player Mode Notice */}
      {currentGame.isSinglePlayer && (
        <Card className="p-4 bg-blue-900/20 border-blue-500/30">
          <div className="flex items-center space-x-2">
            <span className="text-blue-400">🎯</span>
            <span className="text-blue-300">
              Single player mode: You'll compete against bots and your bet will be refunded
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
