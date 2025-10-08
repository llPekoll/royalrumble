import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePrivyWallet } from "../hooks/usePrivyWallet";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import { CharacterPreviewScene } from "./CharacterPreviewScene";
import styles from "./ButtonShine.module.css";

interface Character {
  _id: string;
  name: string;
  description?: string;
}

interface CharacterSelectionProps {
  onParticipantAdded?: () => void;
}

const CharacterSelection = memo(function CharacterSelection({ onParticipantAdded }: CharacterSelectionProps) {
  const { connected, publicKey } = usePrivyWallet();
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [betAmount, setBetAmount] = useState<string>("0.1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize wallet address to prevent unnecessary re-queries
  const walletAddress = useMemo(() => connected && publicKey ? publicKey.toString() : null, [connected, publicKey]);

  // Get player data - only fetch once
  const playerData = useQuery(
    api.players.getPlayer,
    walletAddress ? { walletAddress } : "skip"
  );

  // Get all available characters - only fetch once
  const allCharacters = useQuery(api.characters.getActiveCharacters);

  // Get current game - only fetch once
  const currentGame = useQuery(api.games.getCurrentGame);

  // Check how many participants this player already has
  const playerParticipantCount = currentGame?.participants?.filter(
    (p: any) => p.walletAddress === walletAddress
  ).length || 0;

  // Mutation to join game (creates game if needed)
  const joinGame = useMutation(api.games.joinGame);

  const gameCoins = playerData?.gameCoins || 0;

  // Initialize with random character when characters load
  useEffect(() => {
    if (allCharacters && allCharacters.length > 0 && !currentCharacter) {
      const randomChar = allCharacters[Math.floor(Math.random() * allCharacters.length)];
      setCurrentCharacter(randomChar);
    }
  }, [allCharacters, currentCharacter]);

  const handleReroll = () => {
    if (!allCharacters || allCharacters.length === 0) {
      toast.error("No characters available");
      return;
    }

    const availableCharacters = allCharacters.filter(c => c._id !== currentCharacter?._id);
    if (availableCharacters.length === 0) {
      toast.error("No other characters available");
      return;
    }

    const randomChar = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
    setCurrentCharacter(randomChar);
  };

  const handleQuickBet = (amount: number) => {
    setBetAmount(amount.toString());
  };

  const handlePlaceBet = useCallback(async () => {
    if (!connected || !publicKey || !playerData || !currentCharacter) {
      toast.error("Please wait for data to load");
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 0.1 || amount > 10) {
      toast.error("Bet amount must be between 0.1 and 10 SOL");
      return;
    }

    if (amount > gameCoins / 100000) {
      toast.error(`Insufficient SOL. You have ${gameCoins / 100000} SOL`);
      return;
    }

    // Allow joining if no game exists (will create one) or game is in waiting phase
    if (currentGame && currentGame.status !== "waiting") {
      toast.error("Can only join during waiting phase");
      return;
    }

    setIsSubmitting(true);

    try {
      // Use joinGame which will create a game if none exists
      await joinGame({
        walletAddress: publicKey.toString(),
        betAmount: amount * 100, // Convert to game coins (0.1 SOL = 10 coins)
        characterId: currentCharacter._id as Id<"characters">,
      });
      setBetAmount("0.1");

      // Auto-reroll to a new character for the next participant
      if (allCharacters && allCharacters.length > 0) {
        const availableCharacters = allCharacters.filter(c => c._id !== currentCharacter._id);
        if (availableCharacters.length > 0) {
          const randomChar = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
          setCurrentCharacter(randomChar);
        }
      }

      onParticipantAdded?.();

    } catch (error) {
      console.error("Failed to add participant:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join game");
    } finally {
      setIsSubmitting(false);
    }
  }, [connected, publicKey, currentGame, playerData, currentCharacter, betAmount, gameCoins, joinGame, onParticipantAdded, allCharacters]);

  // Don't render if not connected or no character
  // Allow rendering when no game exists OR game is in waiting phase
  if (!connected || !currentCharacter || (currentGame && currentGame.status !== 'waiting')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 w-72 z-50">
      <div className="bg-gradient-to-b from-amber-900/95 to-amber-950/95 backdrop-blur-sm rounded-lg border-2 border-amber-600/60 shadow-2xl shadow-amber-900/50">
        {/* Character Section */}
        <div className="p-3 border-b border-amber-700/50">
          {/* Player participant count indicator */}
          {playerParticipantCount > 0 && (
            <div className="mb-2 text-center">
              <span className="text-sm text-amber-400 uppercase tracking-wide">
                You have {playerParticipantCount} participant{playerParticipantCount > 1 ? 's' : ''} in this game
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Phaser character preview */}
              <div className="w-16 h-16 flex-shrink-0">
                <CharacterPreviewScene
                  characterId={currentCharacter._id}
                  characterName={currentCharacter.name}
                  width={64}
                  height={64}
                />
              </div>
              <div>
                <p className="text-amber-100 font-bold text-xl uppercase tracking-wide">
                  {currentCharacter.name}
                </p>
                <p className="text-amber-400 text-base">Ready for battle</p>
              </div>
            </div>
            <button
              onClick={handleReroll}
              className="p-2 bg-amber-800/50 hover:bg-amber-700/50 rounded-lg border border-amber-600/50 transition-colors"
              disabled={!allCharacters || allCharacters.length <= 1}
            >
              <Shuffle className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Betting Section */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between text-lg uppercase tracking-wide">
            <span className="text-amber-400">Your Bet</span>
            <span className="text-amber-300">{gameCoins / 100000} Sol</span>
          </div>

          <div className="relative">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="Amount"
              min={0.1}
              max={10}
              className="w-full px-3 py-2 bg-black/30 border border-amber-700/50 rounded-lg text-amber-900 placeholder-amber-600 text-center text-lg font-bold focus:outline-none focus:border-amber-900"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm font-bold">Sol</span>
          </div>

          {/* Quick bet buttons */}
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => handleQuickBet(0.1)}
              className="py-1.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 text-lg font-bold transition-colors"
            >
              0.1 Sol
            </button>
            <button
              onClick={() => handleQuickBet(0.5)}
              className="py-1.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 text-lg font-bold transition-colors"
            >
              0.5 Sol
            </button>
            <button
              onClick={() => handleQuickBet(1)}
              className="py-1.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 text-lg font-bold transition-colors"
            >
              1 Sol
            </button>
          </div>

          {/* Place bet button */}
          <button
            onClick={() => void handlePlaceBet()}
            disabled={isSubmitting || !currentGame || currentGame.status !== "waiting"}
            className={`w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-gray-600 disabled:to-gray-700 rounded-lg font-bold text-white uppercase tracking-wider text-lg transition-all shadow-lg shadow-amber-900/50 disabled:opacity-50 ${styles.shineButton}`}
          >
            {isSubmitting ? "Inserting..." : "Insert coin"}
          </button>
        </div>
      </div>
    </div>
  );
});

export { CharacterSelection };
