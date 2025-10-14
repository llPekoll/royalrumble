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
import { useWallets } from "@privy-io/react-auth/solana";
import {
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  createSolanaRpc,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getTransactionEncoder,
  address,
  pipe,
} from "@solana/kit";

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

const CharacterSelection = memo(function CharacterSelection({
  onParticipantAdded,
}: CharacterSelectionProps) {
  const { connected, publicKey, solBalance, isLoadingBalance } = usePrivyWallet();
  const { wallets } = useWallets();
  const placeEntryBet = useMutation(api.bets.placeEntryBet);

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

  // Add missing variables for the updated handlePlaceBet function
  const selectedWallet = wallets.length > 0 ? wallets[0] : null;
  const gameState: any = null; // TODO: Replace with actual game state from Solana
  const canPlaceBet = true; // TODO: Replace with actual game state logic
  const isPlayerInGame = false; // TODO: Replace with actual check
  const solBalanceIn10K = solBalance * 10000; // Convert SOL to lamports (assuming 1 SOL = 10000 lamports)

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
    if (!connected || !publicKey || !selectedWallet || !playerData || !currentCharacter) {
      toast.error("Please wait for data to load");
      return;
    }

    // Check if player can place bet based on game state
    if (!canPlaceBet) {
      const status = gameState?.gameState?.status;
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
    if (isNaN(amount) || amount < 0.1 || amount > 10) {
      toast.error("Bet amount must be between 0.1 and 10 SOL");
      return;
    }

    if (amount > solBalanceIn10K / 10000) {
      toast.error(`Insufficient SOL. You have ${solBalanceIn10K / 10000} SOL`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate bet amount using Solana program constraints
      const validation = validateBetAmount(amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Create the deposit bet instruction manually
      const programId = new PublicKey('35ooYhrDLzTz3U7BH9bYivSsLJYm4vtwzoPNFfsQhcof');
      
      // Derive PDAs for game_round and vault (matching Rust constants)
      const [gameRoundPDA] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('game_round')],
        programId
      );
      
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('vault')],
        programId
      );

      // Convert SOL to lamports
      const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

      // Configure RPC connection to point to devnet
      const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
      const rpcUrl = network === "mainnet" 
        ? "https://api.mainnet-beta.solana.com"
        : "https://api.devnet.solana.com";

      // Create instruction data: [discriminator (8 bytes), amount (8 bytes)]
      const instructionData = new Uint8Array(16);
      
      // Use actual discriminator from built program IDL
      const discriminator = new Uint8Array([82, 23, 26, 58, 40, 4, 106, 159]);
      instructionData.set(discriminator, 0);
      
      // Write amount as little-endian u64
      const view = new DataView(instructionData.buffer);
      view.setBigUint64(8, BigInt(amountLamports), true);

      // First, let's try creating the vault account explicitly if it doesn't exist
      const { getAccountInfo } = createSolanaRpc(rpcUrl);
      let vaultExists = false;
      try {
        const vaultInfo = await getAccountInfo(address(vaultPDA.toString())).send();
        vaultExists = vaultInfo.value !== null;
      } catch (error) {
        vaultExists = false;
      }

      console.log("Vault exists:", vaultExists);
      console.log("Vault PDA:", vaultPDA.toString());
      console.log("Game Round PDA:", gameRoundPDA.toString());

      // Create deposit_bet instruction in @solana/kit format
      const depositBetInstruction = {
        programAddress: address(programId.toString()),
        accounts: [
          { address: address(gameRoundPDA.toString()), role: 1 }, // writable 
          { address: address(vaultPDA.toString()), role: 1 }, // writable  
          { address: address(selectedWallet.address), role: 3 }, // signer + writable 
          { address: address(SystemProgram.programId.toString()), role: 0 } // readonly 
        ],
        data: instructionData
      };

      console.log("Created deposit bet instruction:", depositBetInstruction);
      console.log("Using wallet:", selectedWallet);

      const { getLatestBlockhash } = createSolanaRpc(rpcUrl);
      const { value: latestBlockhash } = await getLatestBlockhash().send();

      // Create transaction using @solana/kit
      const transaction = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayer(address(selectedWallet.address), tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions([depositBetInstruction], tx),
        (tx) => compileTransaction(tx),
        (tx) => new Uint8Array(getTransactionEncoder().encode(tx))
      );

      // Send the transaction with explicit chain specification
      const chainId = `solana:${network}` as `${string}:${string}`;
      const receipts = await selectedWallet.signAndSendAllTransactions([
        {
          chain: chainId,
          transaction
        }
      ]);

      console.log("Transaction successful:", receipts);

      // Convert signature to hex string for display
      const signature = receipts[0].signature;
      const signatureHex = Array.from(signature as Uint8Array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log("[CharacterSelection] Registering bet in Convex...");

      // Register bet in Convex database after successful Solana transaction
      const gameInfo = await placeEntryBet({
        walletAddress: publicKey.toString(),
        characterId: currentCharacter._id,
        betAmount: amountLamports, // Already in lamports
        txSignature: signatureHex,
      });

      console.log("[CharacterSelection] Game joined:", gameInfo);

      toast.success(`Bet placed! 🎲 Game starting!`, {
        description: `Transaction: ${signatureHex.slice(0, 8)}...${signatureHex.slice(-8)}\nPlayers: ${gameInfo.playersCount}`,
        duration: 5000,
      });

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
    selectedWallet,
    playerData,
    currentCharacter,
    betAmount,
    solBalanceIn10K,
    canPlaceBet,
    isPlayerInGame,
    gameState,
    placeEntryBet,
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