import { useState, useEffect, useCallback, memo } from "react";
import { useQuery } from "convex/react";
import { usePrivyWallet } from "../hooks/usePrivyWallet";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { CharacterPreviewScene } from "./CharacterPreviewScene";
import styles from "./ButtonShine.module.css";
import { validateBetAmount, placeBetOnContract } from "../lib/evm-place-bet";

interface Character {
  _id: Id<"characters">;
  name: string;
  description?: string;
}

interface CharacterSelectionProps {
  onParticipantAdded?: () => void;
}

const CharacterSelection = memo(function CharacterSelection({
  onParticipantAdded,
}: CharacterSelectionProps) {
  const { connected, walletAddress, ethBalance, isLoadingBalance, wallet } = usePrivyWallet();

  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [betAmount, setBetAmount] = useState<string>("0.1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get player data - only fetch once
  const playerData = useQuery(api.evm.players.getPlayer, walletAddress ? { walletAddress } : "skip");

  // Get all available characters - only fetch once
  const allCharacters = useQuery(api.evm.characters.getActiveCharacters);

  // TODO: Fetch game state from EVM blockchain
  // For now, always in demo mode (no game status checks)

  // Add missing variables for the updated handlePlaceBet function
  const gameState: any = null; // TODO: Replace with actual game state from EVM
  const canPlaceBet = true; // TODO: Replace with actual game state logic
  const isPlayerInGame = false; // TODO: Replace with actual check

  // ethBalance is now fetched from the Privy wallet via usePrivyWallet hook

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

    const availableCharacters = allCharacters.filter((c) => c._id !== currentCharacter?._id);
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
    if (!connected || !walletAddress || !wallet || !playerData || !currentCharacter) {
      toast.error("Please wait for data to load");
      return;
    }

    // Check if player can place bet based on game state
    if (!canPlaceBet) {
      const status = gameState?.status;
      if (status === "awaitingWinnerRandomness") {
        toast.error("Game is determining winner, please wait...");
      } else if (status === "finished") {
        toast.error("Game has finished, new game will start soon");
      } else {
        toast.error("Cannot place bet at this time");
      }
      return;
    }

    // Check if player is already in the current game
    if (isPlayerInGame) {
      toast.error("You are already participating in the current game");
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 0.01 || amount > 10) {
      toast.error("Bet amount must be between 0.01 and 10 ETH");
      return;
    }

    if (amount > ethBalance) {
      toast.error(`Insufficient ETH. You have ${ethBalance} ETH`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate bet amount using EVM contract constraints
      const validation = validateBetAmount(amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Get contract address from environment
      const contractAddress = import.meta.env.VITE_DOMIN8_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error("Contract address not configured");
      }

      // Place bet on the EVM contract
      const result = await placeBetOnContract({
        wallet,
        betAmountEth: amount,
        contractAddress,
      });

      toast.success(`Bet placed successfully! Transaction: ${result.txHash}`);

      // Bet will be automatically synced to Convex by the event listener
      if (onParticipantAdded) {
        onParticipantAdded();
      }

    } catch (error) {
      console.error("Failed to place bet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to place bet");
    } finally {
      setIsSubmitting(false);
    }
  }, [connected, walletAddress, wallet, playerData, currentCharacter, betAmount, canPlaceBet, gameState, isPlayerInGame, ethBalance, onParticipantAdded]);

  // Don't render if not connected or no character
  if (!connected || !currentCharacter) {
    return null;
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-col items-center space-y-4">
        {/* Character Preview */}
        <CharacterPreviewScene characterId={currentCharacter._id} characterName={currentCharacter.name} />
        
        {/* Character Info */}
        <div className="text-center">
          <h3 className="text-2xl font-bold">{currentCharacter.name}</h3>
          {currentCharacter.description && (
            <p className="text-gray-400 mt-1">{currentCharacter.description}</p>
          )}
        </div>

        {/* Reroll Button */}
        <button
          onClick={handleReroll}
          disabled={!allCharacters || allCharacters.length <= 1}
          className={`${styles.buttonShine} px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
        >
          <Shuffle size={16} />
          Reroll Character
        </button>

        {/* Bet Amount Input */}
        <div className="w-full space-y-2">
          <label className="text-sm text-gray-400">Bet Amount (ETH)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="10"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
            placeholder="0.1"
          />
          <div className="flex gap-2">
            <button onClick={() => handleQuickBet(0.01)} className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              0.01 ETH
            </button>
            <button onClick={() => handleQuickBet(0.1)} className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              0.1 ETH
            </button>
            <button onClick={() => handleQuickBet(1)} className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              1 ETH
            </button>
          </div>
          <div className="text-xs text-gray-500">
            Balance: {ethBalance.toFixed(4)} ETH
          </div>
        </div>

        {/* Place Bet Button */}
        <button
          onClick={handlePlaceBet}
          disabled={isSubmitting || !wallet || isLoadingBalance}
          className={`${styles.buttonShine} w-full px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? "Placing Bet..." : "Place Bet & Enter Game"}
        </button>
      </div>
    </div>
  );
});

export default CharacterSelection;
