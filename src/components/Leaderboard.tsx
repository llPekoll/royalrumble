import { useQuery } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { useState } from "react";

export function Leaderboard() {
  const { connected, publicKey } = useWallet();
  const [sortBy, setSortBy] = useState<"earnings" | "wins" | "winRate">("earnings");
  const [showMore, setShowMore] = useState(false);

  // Get leaderboard data
  const leaderboard = useQuery(api.leaderboard.getLeaderboard, {
    limit: showMore ? 50 : 10,
    sortBy,
  });

  // Get player's rank
  const playerRank = useQuery(
    api.leaderboard.getPlayerRank,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip"
  );

  // Get game statistics
  const gameStats = useQuery(api.leaderboard.getGameStats);

  const formatWinRate = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const formatCoins = (amount: number) => {
    return amount.toLocaleString();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `#${rank}`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Game Statistics */}
      {gameStats && (
        <Card className="p-6 bg-gradient-to-br from-amber-900/30 to-yellow-900/30 border border-amber-600/50 backdrop-blur-sm shadow-lg shadow-amber-500/20">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent mb-4 uppercase tracking-wide">Game Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-300">
                {gameStats.totalGames.toLocaleString()}
              </div>
              <div className="text-sm text-amber-400/60">Total Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-300">
                {gameStats.totalPlayers.toLocaleString()}
              </div>
              <div className="text-sm text-amber-400/60">Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-300">
                {formatCoins(gameStats.totalPot)}
              </div>
              <div className="text-sm text-amber-400/60">Total Pot</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-300">
                {formatCoins(gameStats.averagePot)}
              </div>
              <div className="text-sm text-amber-400/60">Avg Pot</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-300">
                {gameStats.activeGames}
              </div>
              <div className="text-sm text-amber-400/60">Active Games</div>
            </div>
          </div>
        </Card>
      )}

      {/* Player's Rank */}
      {playerRank && (
        <Card className="p-6 bg-gradient-to-br from-amber-900/30 to-yellow-900/30 border border-amber-600/50 backdrop-blur-sm shadow-lg shadow-amber-500/20">
          <h3 className="text-xl font-bold text-amber-300 mb-4 uppercase tracking-wide">Your Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">
                {getRankIcon(playerRank.rank)}
              </div>
              <div className="text-sm text-gray-400">Rank</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                {playerRank.wins}
              </div>
              <div className="text-sm text-gray-400">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                {playerRank.gamesPlayed}
              </div>
              <div className="text-sm text-gray-400">Games</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">
                {formatWinRate(playerRank.winRate)}
              </div>
              <div className="text-sm text-gray-400">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">
                {formatCoins(playerRank.totalEarnings)}
              </div>
              <div className="text-sm text-gray-400">Earnings</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-400">
                {formatCoins(playerRank.highestPayout)}
              </div>
              <div className="text-sm text-gray-400">Best Win</div>
            </div>
          </div>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">🏆 Leaderboard</h2>

          {/* Sort Options */}
          <div className="flex space-x-2">
            <Button
              onClick={() => setSortBy("earnings")}
              variant={sortBy === "earnings" ? "default" : "outline"}
              className="text-sm px-3 py-1 h-auto"
            >
              💰 Earnings
            </Button>
            <Button
              onClick={() => setSortBy("wins")}
              variant={sortBy === "wins" ? "default" : "outline"}
              className="text-sm px-3 py-1 h-auto"
            >
              🏆 Wins
            </Button>
            <Button
              onClick={() => setSortBy("winRate")}
              variant={sortBy === "winRate" ? "default" : "outline"}
              className="text-sm px-3 py-1 h-auto"
            >
              📈 Win Rate
            </Button>
          </div>
        </div>

        {/* Leaderboard List */}
        <div className="space-y-2">
          {leaderboard?.map((entry, index) => {
            const isCurrentPlayer = connected && entry.walletAddress === publicKey?.toString();

            return (
              <div
                key={entry._id}
                className={`p-4 rounded-lg border ${
                  isCurrentPlayer
                    ? "bg-green-900/30 border-green-500/50 ring-1 ring-green-500"
                    : "bg-gray-800/50 border-gray-600"
                }`}
              >
                <div className="flex items-center space-x-4">
                  {/* Rank */}
                  <div className="text-2xl font-bold w-16 text-center">
                    {getRankIcon(entry.rank || index + 1)}
                  </div>

                  {/* Player Name */}
                  <div className="flex-1">
                    <div className="font-bold text-white">
                      {entry.displayName}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-green-400 text-sm">(You)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {entry.walletAddress.slice(0, 4)}...{entry.walletAddress.slice(-4)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-6 text-right">
                    <div>
                      <div className="font-bold text-white">{entry.wins}</div>
                      <div className="text-xs text-gray-400">Wins</div>
                    </div>
                    <div>
                      <div className="font-bold text-white">{entry.gamesPlayed}</div>
                      <div className="text-xs text-gray-400">Games</div>
                    </div>
                    <div>
                      <div className="font-bold text-white">
                        {formatWinRate(entry.winRate)}
                      </div>
                      <div className="text-xs text-gray-400">Rate</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-400">
                        {formatCoins(entry.totalEarnings)}
                      </div>
                      <div className="text-xs text-gray-400">Earnings</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show More Button */}
        {leaderboard && leaderboard.length >= 10 && (
          <div className="text-center mt-6">
            <Button
              onClick={() => setShowMore(!showMore)}
              variant="outline"
              className="px-6"
            >
              {showMore ? "Show Less" : "Show More"}
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!leaderboard || leaderboard.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-4">🎮</div>
            <div>No players on the leaderboard yet.</div>
            <div className="text-sm mt-2">Be the first to play and earn your spot!</div>
          </div>
        )}
      </Card>

      {/* Data Retention Notice */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="text-blue-400 mt-0.5">ℹ️</div>
          <div className="flex-1">
            <h3 className="text-blue-300 font-medium mb-2">Data Retention Policy</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <div>• <strong>Game History:</strong> Individual games are kept for 3 days</div>
              <div>• <strong>Player Stats:</strong> Your balance and leaderboard position are permanent</div>
              <div>• <strong>Transaction History:</strong> Solana deposits/withdrawals kept for 7 days</div>
              <div>• <strong>NFTs:</strong> Your minted NFT records are permanent</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}