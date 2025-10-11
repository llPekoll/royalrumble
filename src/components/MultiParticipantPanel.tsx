import { useQuery } from "convex/react";
import { usePrivyWallet } from "../hooks/usePrivyWallet";
import { api } from "../../convex/_generated/api";
import { Users, Swords } from "lucide-react";
import { useMemo } from "react";

export function MultiParticipantPanel() {
  const { walletAddress } = usePrivyWallet();
  
  // Get current game state
  const gameState = useQuery(api.gameManagerDb.getGameState);
  
  // Only show panel if there's an active game with players
  const hasActiveGame = gameState?.gameState && 
    gameState.gameState.status !== "idle" && 
    gameState.gameState.players && 
    gameState.gameState.players.length > 0;

  if (!hasActiveGame) {
    return null;
  }

  const currentGame = gameState.gameState;
  const participants = currentGame.players || [];
  const maxParticipants = 64; // From Anchor program max
  const currentParticipantCount = participants.length;

  const totalPot = useMemo(() => {
    return currentGame.initialPot || 0;
  }, [currentGame.initialPot]);

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <div className="bg-gradient-to-b from-amber-900/95 to-amber-950/95 backdrop-blur-sm rounded-lg border-2 border-amber-600/60 shadow-2xl shadow-amber-900/50">
        <div className="p-3 border-b border-amber-700/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-amber-300 uppercase tracking-wide">
              <Swords className="w-4 h-4 text-amber-400" />
              Arena Combatants
            </h3>
            <div className="flex items-center gap-3">
              <div className="text-xs text-amber-400">
                <Users className="w-3 h-3 inline mr-1" />
                {currentParticipantCount}/{maxParticipants}
              </div>
              <div className="text-xs text-amber-400">
                Status: {currentGame.status}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {participants.length > 0 ? (
            <div className="p-3 space-y-2">
              {participants.map((participant, index) => {
                const isOwn = participant.wallet === walletAddress;
                const isWinner = currentGame.winner === participant.wallet;
                
                // Calculate win percentage based on bet amount
                const winPercentage = totalPot > 0 ? 
                  ((participant.totalBet / totalPot) * 100).toFixed(1) : "0.0";

                return (
                  <div
                    key={`${participant.wallet}-${index}`}
                    className={`
                      ${
                        isOwn
                          ? "bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-600/60"
                          : isWinner
                            ? "bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border-yellow-600/60"
                            : "bg-gradient-to-r from-amber-900/20 to-amber-950/20 border-amber-600/30"
                      }
                      border rounded-lg p-2.5 transition-all hover:border-amber-500/50
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`
                          w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                          ${
                            isOwn
                              ? "bg-gradient-to-br from-green-600 to-emerald-700 text-green-100"
                              : isWinner
                                ? "bg-gradient-to-br from-yellow-600 to-amber-700 text-yellow-100"
                                : "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100"
                          }
                        `}
                        >
                          {isWinner ? "👑" : (index + 1)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span
                              className={`
                              font-semibold text-xs truncate
                              ${isOwn ? "text-green-100" : isWinner ? "text-yellow-100" : "text-amber-100"}
                            `}
                            >
                              {participant.wallet.slice(0, 8)}...{participant.wallet.slice(-4)}
                            </span>
                            {isOwn && <span className="text-green-400 text-xs">(You)</span>}
                            {isWinner && <span className="text-yellow-400 text-xs">(Winner)</span>}
                          </div>
                          <span
                            className={`
                            text-xs block truncate
                            ${isOwn ? "text-green-400" : isWinner ? "text-yellow-400" : "text-amber-500"}
                          `}
                          >
                            Joined: {new Date(participant.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`
                          font-bold text-sm
                          ${isOwn ? "text-green-300" : isWinner ? "text-yellow-300" : "text-amber-300"}
                        `}
                        >
                          {(participant.totalBet / 1000000000).toFixed(3)} SOL
                        </div>
                        <div
                          className={`text-xs ${isWinner ? "text-yellow-500" : "text-amber-500"}`}
                        >
                          {currentGame.status === "finished" && isWinner ? "Won!" : `${winPercentage}% chance`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-amber-400 text-sm">No combatants yet</p>
              <p className="text-xs mt-1 text-amber-500">Waiting for players to join...</p>
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div className="p-3 border-t border-amber-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 uppercase tracking-wide">Total Pot</span>
              <span className="text-amber-300 font-bold text-sm">
                {(totalPot / 1000000000).toFixed(3)} SOL
              </span>
            </div>
            {currentGame.status === "awaitingWinnerRandomness" && (
              <div className="mt-2 text-center">
                <span className="text-yellow-400 text-xs animate-pulse">
                  🎲 Determining winner via blockchain randomness...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // The following code will be enabled once Solana game state is integrated:
  /*
  const currentGame = null; // Will be replaced with Solana query

  const allParticipants = useQuery(
    api.gameParticipants.getGameParticipants,
    currentGame ? { gameId: currentGame._id } : "skip"
  );

  const maxParticipants = currentGame?.map?.spawnConfiguration?.maxPlayers || 20;
  const currentParticipantCount = allParticipants?.length || 0;

  const totalPot = useMemo(() => {
    if (!allParticipants) return 0;
    return allParticipants.reduce((sum: number, p: any) => sum + (p.betAmount || 0), 0);
  }, [allParticipants]);

  if (!currentGame) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <div className="bg-gradient-to-b from-amber-900/95 to-amber-950/95 backdrop-blur-sm rounded-lg border-2 border-amber-600/60 shadow-2xl shadow-amber-900/50">
        <div className="p-3 border-b border-amber-700/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-amber-300 uppercase tracking-wide">
              <Swords className="w-4 h-4 text-amber-400" />
              Arena Combatants
            </h3>
            <div className="flex items-center gap-3">
              <div className="text-xs text-amber-400">
                <Users className="w-3 h-3 inline mr-1" />
                {currentParticipantCount}/{maxParticipants}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {allParticipants && allParticipants.length > 0 ? (
            <div className="p-3 space-y-2">
              {allParticipants.map((participant: any) => {
                const isOwn = participant.walletAddress === walletAddress;
                const isEliminated = participant.eliminated;
                // Calculate win percentage based on bet amount
                const winPercentage =
                  totalPot > 0 ? ((participant.betAmount / totalPot) * 100).toFixed(1) : "0.0";

                return (
                  <div
                    key={participant._id}
                    className={`
                      ${
                        isOwn
                          ? "bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-600/60"
                          : isEliminated
                            ? "bg-gradient-to-r from-red-900/20 to-red-950/20 border-red-600/30 opacity-60"
                            : "bg-gradient-to-r from-amber-900/20 to-amber-950/20 border-amber-600/30"
                      }
                      border rounded-lg p-2.5 transition-all hover:border-amber-500/50
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`
                          w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                          ${
                            isOwn
                              ? "bg-gradient-to-br from-green-600 to-emerald-700 text-green-100"
                              : isEliminated
                                ? "bg-gradient-to-br from-red-800 to-red-900 text-red-200"
                                : "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100"
                          }
                        `}
                        >
                          {isEliminated && participant.finalPosition
                            ? `#${participant.finalPosition}`
                            : participant.displayName?.charAt(0) || "?"}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span
                              className={`
                              font-semibold text-xs truncate
                              ${isOwn ? "text-green-100" : isEliminated ? "text-red-200" : "text-amber-100"}
                            `}
                            >
                              {participant.displayName}
                            </span>
                            {isOwn && <span className="text-green-400 text-xs">(You)</span>}
                          </div>
                          <span
                            className={`
                            text-xs block truncate
                            ${isOwn ? "text-green-400" : isEliminated ? "text-red-400" : "text-amber-500"}
                          `}
                          >
                            {participant.character?.name || "Unknown"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`
                          font-bold text-sm
                          ${isOwn ? "text-green-300" : isEliminated ? "text-red-300" : "text-amber-300"}
                        `}
                        >
                          {(participant.betAmount / 100000).toFixed(2)} SOL
                        </div>
                        <div
                          className={`text-xs ${isEliminated ? "text-red-500" : "text-amber-500"}`}
                        >
                          {!isEliminated ? `${winPercentage}% win` : "Eliminated"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-amber-400 text-sm">No combatants yet</p>
              <p className="text-xs mt-1 text-amber-500">Waiting for players to join...</p>
            </div>
          )}
        </div>

        {allParticipants && allParticipants.length > 0 && (
          <div className="p-3 border-t border-amber-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 uppercase tracking-wide">Total Pot</span>
              <span className="text-amber-300 font-bold text-sm">
                {(totalPot / 100000).toFixed(2)} SOL
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  */
}
