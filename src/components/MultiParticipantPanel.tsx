import { useQuery } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Users, Trophy, Swords } from "lucide-react";
import { useMemo } from "react";

export function MultiParticipantPanel() {
  const { connected, publicKey } = useWallet();

  // Memoize wallet address to prevent unnecessary re-queries
  const walletAddress = useMemo(() => connected && publicKey ? publicKey.toString() : null, [connected, publicKey]);

  // Get current game
  const currentGame = useQuery(api.games.getCurrentGame);

  // Get ALL participants in the game
  const allParticipants = useQuery(
    api.gameParticipants.getGameParticipants,
    currentGame ? { gameId: currentGame._id } : "skip"
  );

  const maxParticipants = currentGame?.map?.spawnConfiguration?.maxPlayers || 20;
  const currentParticipantCount = allParticipants?.length || 0;
  const totalBetAmount = allParticipants?.reduce((sum: number, p: any) => sum + (p.betAmount || 0), 0) || 0;

  if (!currentGame) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 z-50">
      <div className="bg-gradient-to-b from-amber-900/95 to-amber-950/95 backdrop-blur-sm rounded-lg border-2 border-amber-600/60 shadow-2xl shadow-amber-900/50">
        {/* Header */}
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
              <div className="text-xs text-amber-300 font-bold">
                <Trophy className="w-3 h-3 inline mr-1" />
                {totalBetAmount} SOL
              </div>
            </div>
          </div>
        </div>

        {/* Participants List with Scroll */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {allParticipants && allParticipants.length > 0 ? (
            <div className="p-3 space-y-2">
              {allParticipants.map((participant: any) => {
                const isOwn = participant.walletAddress === walletAddress;
                const isEliminated = participant.eliminated;

                return (
                  <div
                    key={participant._id}
                    className={`
                      ${isOwn
                        ? 'bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-600/60'
                        : isEliminated
                        ? 'bg-gradient-to-r from-red-900/20 to-red-950/20 border-red-600/30 opacity-60'
                        : 'bg-gradient-to-r from-amber-900/20 to-amber-950/20 border-amber-600/30'
                      }
                      border rounded-lg p-2.5 transition-all hover:border-amber-500/50
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {/* Rank/Avatar */}
                        <div className={`
                          w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                          ${isOwn
                            ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-green-100'
                            : isEliminated
                            ? 'bg-gradient-to-br from-red-800 to-red-900 text-red-200'
                            : 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100'
                          }
                        `}>
                          {isEliminated && participant.finalPosition ?
                            `#${participant.finalPosition}` :
                            participant.displayName?.charAt(0) || "?"
                          }
                        </div>

                        {/* Name and Character */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`
                              font-semibold text-xs truncate
                              ${isOwn ? 'text-green-100' : isEliminated ? 'text-red-200' : 'text-amber-100'}
                            `}>
                              {participant.displayName}
                            </span>
                            {isOwn && (
                              <span className="text-green-400 text-xs">(You)</span>
                            )}
                          </div>
                          <span className={`
                            text-xs block truncate
                            ${isOwn ? 'text-green-400' : isEliminated ? 'text-red-400' : 'text-amber-500'}
                          `}>
                            {participant.character?.name || "Unknown"}
                          </span>
                        </div>
                      </div>

                      {/* Bet Amount */}
                      <div className="text-right">
                        <div className={`
                          font-bold text-xs
                          ${isOwn ? 'text-green-300' : isEliminated ? 'text-red-300' : 'text-amber-300'}
                        `}>
                          {participant.betAmount}
                        </div>
                        <div className="text-amber-600 text-xs">SOL</div>
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

        {/* Footer with total pot */}
        {allParticipants && allParticipants.length > 0 && (
          <div className="p-3 border-t border-amber-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-400 uppercase tracking-wide">Total Pot</span>
              <span className="text-amber-300 font-bold">
                {allParticipants.reduce((sum: number, p: any) => sum + (p.betAmount || 0), 0)} SOL
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
