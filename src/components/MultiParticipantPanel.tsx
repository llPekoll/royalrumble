import { useQuery } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { Users } from "lucide-react";
import { useMemo } from "react";

export function MultiParticipantPanel() {
  const { connected, publicKey } = useWallet();

  // Memoize wallet address to prevent unnecessary re-queries
  const walletAddress = useMemo(() => connected && publicKey ? publicKey.toString() : null, [connected, publicKey]);

  // Get current game
  const currentGame = useQuery(api.games.getCurrentGame);

  // Get player data
  const playerData = useQuery(
    api.players.getPlayer,
    walletAddress ? { walletAddress } : "skip"
  );

  // Get player's current participants in the game - memoize the condition
  const participantsQueryArgs = useMemo(() => {
    if (walletAddress && currentGame && playerData) {
      return { gameId: currentGame._id, playerId: playerData._id };
    }
    return "skip";
  }, [walletAddress, currentGame, playerData]);

  const playerParticipants = useQuery(
    api.gameParticipants.getPlayerParticipants,
    participantsQueryArgs
  );

  const maxParticipants = currentGame?.map?.spawnConfiguration?.maxPlayers || 20;
  const currentParticipantCount = currentGame?.participantCount || 0;

  if (!connected) {
    return (
      <div className="p-4 bg-gradient-to-b from-amber-900/80 to-amber-950/80 backdrop-blur-sm rounded-lg border-2 border-amber-600/40">
        <p className="text-center text-amber-400">Connect your wallet to participate</p>
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div className="p-4 bg-gradient-to-b from-amber-900/80 to-amber-950/80 backdrop-blur-sm rounded-lg border-2 border-amber-600/40">
        <p className="text-center text-amber-400">Loading game...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-b from-amber-900/30 to-amber-950/30 backdrop-blur-sm rounded-lg border-2 border-amber-600/40">
      {/* Game Info Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-amber-300 uppercase tracking-wide">
          <Users className="w-5 h-5 text-amber-400" />
          Your Combatants
        </h3>
        <div className="text-sm text-amber-400">
          Arena: {currentParticipantCount}/{maxParticipants}
        </div>
      </div>

      {/* Current Participants in Game */}
      {playerParticipants && playerParticipants.length > 0 ? (
        <div>
          <div className="space-y-2">
            {playerParticipants.map((participant: any) => (
              <div key={participant._id} className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-600/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg flex items-center justify-center text-xl font-bold text-amber-100">
                      {participant.displayName?.charAt(0) || "?"}
                    </div>
                    <div>
                      <span className="font-bold text-amber-100">{participant.displayName}</span>
                      <span className="text-amber-400 text-sm block">
                        {participant.character?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-300 font-bold">
                      {participant.betAmount}
                    </div>
                    <div className="text-amber-500 text-xs uppercase">SOL</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-amber-300 font-bold">No combatants yet</p>
          <p className="text-sm mt-2 text-amber-400">Use the card below to enter the arena</p>
        </div>
      )}
    </div>
  );
}