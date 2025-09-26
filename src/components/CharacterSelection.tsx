import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

interface Character {
  _id: string;
  name: string;
  description?: string;
}

interface CharacterSelectionProps {
  onParticipantAdded?: () => void;
}

const CharacterSelection = memo(function CharacterSelection({ onParticipantAdded }: CharacterSelectionProps) {
  const { connected, publicKey } = useWallet();
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [betAmount, setBetAmount] = useState<string>("100");
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

  // Mutation to add participant
  const addParticipant = useMutation(api.gameParticipants.addParticipant);

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
    toast.success(`New character: ${randomChar.name}!`);
  };

  const handleQuickBet = (amount: number) => {
    setBetAmount(amount.toString());
  };

  const handlePlaceBet = useCallback(async () => {
    if (!connected || !publicKey || !currentGame || !playerData || !currentCharacter) {
      toast.error("Please wait for game data to load");
      return;
    }

    const amount = parseInt(betAmount);
    if (isNaN(amount) || amount < 10 || amount > 10000) {
      toast.error("Bet amount must be between 10 and 10,000 coins");
      return;
    }

    if (amount > gameCoins) {
      toast.error(`Insufficient coins. You have ${gameCoins} coins`);
      return;
    }

    if (currentGame.status !== "waiting") {
      toast.error("Can only join during waiting phase");
      return;
    }

    setIsSubmitting(true);

    try {
      await addParticipant({
        gameId: currentGame._id,
        playerId: playerData._id,
        walletAddress: publicKey.toString(),
        characterId: currentCharacter._id as Id<"characters">,
        betAmount: amount,
        displayName: `${playerData.displayName || "Player"}`,
        colorHue: Math.random() * 360,
      });
      setBetAmount("100");

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
  }, [connected, publicKey, currentGame, playerData, currentCharacter, betAmount, gameCoins, addParticipant, onParticipantAdded]);

  // Don't render if not connected, no character, or game is not in waiting phase
  if (!connected || !currentCharacter || currentGame?.status !== 'waiting') {
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
              <span className="text-xs text-amber-400 uppercase tracking-wide">
                You have {playerParticipantCount} participant{playerParticipantCount > 1 ? 's' : ''} in this game
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg flex items-center justify-center text-2xl font-bold text-amber-100">
                {currentCharacter.name.charAt(0)}
              </div>
              <div>
                <p className="text-amber-100 font-bold text-sm uppercase tracking-wide">
                  {currentCharacter.name}
                </p>
                <p className="text-amber-400 text-xs">Ready for battle</p>
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
          <div className="flex items-center justify-between text-xs uppercase tracking-wide">
            <span className="text-amber-400">Your Bet</span>
            <span className="text-amber-300">{gameCoins} coins</span>
          </div>

          <div className="relative">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="Amount"
              min={10}
              max={10000}
              className="w-full px-3 py-2 bg-black/30 border border-amber-700/50 rounded-lg text-amber-900 placeholder-amber-600 text-center text-lg font-bold focus:outline-none focus:border-amber-900"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm font-bold">coins</span>
          </div>

          {/* Quick bet buttons */}
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => handleQuickBet(100)}
              className="py-1.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 text-xs font-bold transition-colors"
            >
              100 coins
            </button>
            <button
              onClick={() => handleQuickBet(500)}
              className="py-1.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 text-xs font-bold transition-colors"
            >
              500 coins
            </button>
            <button
              onClick={() => handleQuickBet(1000)}
              className="py-1.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 text-xs font-bold transition-colors"
            >
              1000 coins
            </button>
          </div>

          {/* Place bet button */}
          <button
            onClick={() => void handlePlaceBet()}
            disabled={isSubmitting || !currentGame || currentGame.status !== "waiting"}
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-gray-600 disabled:to-gray-700 rounded-lg font-bold text-amber-950 uppercase tracking-wider text-sm transition-all shadow-lg shadow-amber-900/50 disabled:opacity-50"
          >
            {isSubmitting ? "Placing..." : "Place Bet"}
          </button>
        </div>
      </div>
    </div>
  );
});

export { CharacterSelection };
