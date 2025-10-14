import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePrivyWallet } from "../hooks/usePrivyWallet";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { CharacterPreviewScene } from "./CharacterPreviewScene";
import styles from "./ButtonShine.module.css";
import { validateBetAmount } from "../lib/solana-deposit-bet";
import { getSolanaRpcUrl } from "../lib/utils";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Buffer } from "buffer";

// Make Buffer available globally for Privy
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

interface Character {
  _id: Id<"characters">;
  name: string;
  description?: string;
}

interface CharacterSelectionProps {
  onParticipantAdded?: () => void;
}

// Utility function to create SOL transfer transaction
const createSOLTransferTransaction = async (
  fromAddress: string,
  toAddress: string,
  amount: number // Amount in SOL
) => {
  // Set up connection to Solana network using environment-based RPC URL
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");

  // Create public key objects
  const fromPubkey = new PublicKey(fromAddress);
  const toPubkey = new PublicKey(toAddress);

  // Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
  const lamports = amount * LAMPORTS_PER_SOL;

  // Create transfer instruction
  const transferInstruction = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports,
  });

  // Create transaction and add instruction
  const transaction = new Transaction().add(transferInstruction);

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  return { transaction, connection };
};

const CharacterSelection = memo(function CharacterSelection({
  onParticipantAdded,
}: CharacterSelectionProps) {
  const { connected, publicKey, solBalance, isLoadingBalance, refreshBalance } = usePrivyWallet();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const placeEntryBet = useMutation(api.bets.placeEntryBet);

  // Debug: Log what we got from the hooks
  console.log("[CharacterSelection] Debug info:");
  console.log("[CharacterSelection]- wallets:", wallets);
  console.log("[CharacterSelection]- signAndSendTransaction:", signAndSendTransaction);
  console.log(
    "[CharacterSelection]- typeof signAndSendTransaction:",
    typeof signAndSendTransaction
  );
  if (wallets.length > 0) {
    console.log("[CharacterSelection]- wallet[0]:", wallets[0]);
    console.log("[CharacterSelection]- wallet[0] methods:", Object.keys(wallets[0] || {}));
  }

  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [betAmount, setBetAmount] = useState<string>("0.1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize wallet address to prevent unnecessary re-queries
  const walletAddress = useMemo(
    () => (connected && publicKey ? publicKey.toString() : null),
    [connected, publicKey]
  );

  // Get player data - only fetch once
  const playerData = useQuery(api.players.getPlayer, walletAddress ? { walletAddress } : "skip");

  // Get all available characters - only fetch once
  const allCharacters = useQuery(api.characters.getActiveCharacters);

  // TODO: Fetch game state from Solana blockchain
  // For now, always in demo mode (no game status checks)

  // Check how many participants this player already has
  const playerParticipantCount = 0; // Disabled until Solana integration

  // solBalance is now fetched from the Privy wallet via usePrivyWallet hook

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
    if (!connected || !publicKey || !playerData || !currentCharacter) {
      toast.error("Please wait for data to load");
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 0.1 || amount > 10) {
      toast.error("Bet amount must be between 0.1 and 10 SOL");
      return;
    }

    // Check if player has sufficient SOL balance
    if (amount > solBalance) {
      toast.error(`Insufficient SOL. You have ${solBalance.toFixed(4)} SOL`);
      return;
    }

    // TODO: Add game status check once Solana game state is integrated
    // For now in demo mode, always allow betting

    setIsSubmitting(true);

    try {
      // Validate bet amount using Solana program constraints
      const validation = validateBetAmount(amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Find the Privy embedded wallet
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === publicKey.toString().toLowerCase()
      );
      if (!wallet) {
        throw new Error("Wallet not found");
      }

      // TODO: Replace with actual game escrow address from smart contract
      const gameEscrowAddress =
        import.meta.env.VITE_GAME_ESCROW_ADDRESS || "PLACEHOLDER_ESCROW_ADDRESS";

      // Create SOL transfer transaction
      const { transaction } = await createSOLTransferTransaction(
        publicKey.toString(),
        gameEscrowAddress,
        amount
      );

      // Sign and send transaction using Privy's method
      // Note: signAndSendTransaction expects serialized transaction bytes
      console.log("[CharacterSelection] Signing and sending transaction...");
      console.log({ transaction, wallet });

      // Serialize the transaction to bytes
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      console.log("[CharacterSelection] Serialized transaction:", serializedTransaction);

      // Get Solana network from environment
      const solanaNetwork = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
      const chain = `solana:${solanaNetwork}` as const;

      const result = await signAndSendTransaction({
        transaction: serializedTransaction,
        wallet,
        chain,
      });

      console.log("Transaction successful:", result);

      // Extract transaction signature
      const txSignature = typeof result === "string" ? result : result?.signature || "Unknown";

      // Register bet in Convex and join/create game
      console.log("[CharacterSelection] Registering bet in Convex...");
      const gameInfo = await placeEntryBet({
        walletAddress: publicKey.toString(),
        characterId: currentCharacter._id,
        betAmount: Math.floor(amount * LAMPORTS_PER_SOL), // Convert to lamports
        txSignature: txSignature.toString(),
      });

      console.log("[CharacterSelection] Game joined:", gameInfo);

      // Show success toast with truncated transaction signature
      toast.success(`Bet placed! 🎲 Game starting!`, {
        description: `Transaction: ${txSignature.toString().slice(0, 8)}...${txSignature.toString().slice(-8)}\nPlayers: ${gameInfo.playersCount}`,
        duration: 5000,
      });

      // Refresh balance after successful bet
      await refreshBalance();

      setBetAmount("0.1");

      // Auto-reroll to a new character for the next participant
      if (allCharacters && allCharacters.length > 0) {
        const availableCharacters = allCharacters.filter(
          (c: any) => c._id !== currentCharacter._id
        );
        if (availableCharacters.length > 0) {
          const randomChar =
            availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
          setCurrentCharacter(randomChar);
        }
      }

      onParticipantAdded?.();
    } catch (error) {
      console.error("Failed to place bet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to place bet");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    connected,
    publicKey,
    playerData,
    currentCharacter,
    betAmount,
    solBalance,
    wallets,
    signAndSendTransaction,
    placeEntryBet,
    refreshBalance,
    onParticipantAdded,
    allCharacters,
  ]);

  // Don't render if not connected or no character
  // In demo mode (currentGame is null), always show the component
  if (!connected || !currentCharacter) {
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
                You have {playerParticipantCount} participant{playerParticipantCount > 1 ? "s" : ""}{" "}
                in this game
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
            <span className="text-amber-400">Your Balance</span>
            <span className="text-amber-300">
              {isLoadingBalance ? "Loading..." : `${solBalance.toFixed(4)} SOL`}
            </span>
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
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm font-bold">
              Sol
            </span>
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
            disabled={isSubmitting || isLoadingBalance}
            className={`flex justify-center items-center w-full  bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-gray-600 disabled:to-gray-700 rounded-lg font-bold text-white uppercase tracking-wider text-lg transition-all shadow-lg shadow-amber-900/50 disabled:opacity-50 ${styles.shineButton}`}
          >
            <img src="/assets/insert-coin.png" alt="Coin" className="h-8" />
            {isSubmitting ? "Inserting..." : isLoadingBalance ? "Loading..." : "Insert coin"}
          </button>
        </div>
      </div>
    </div>
  );
});

export { CharacterSelection };
