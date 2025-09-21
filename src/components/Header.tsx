import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import { UnifiedWalletButton } from "@jup-ag/wallet-adapter";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { getSolanaRpcUrl } from "../lib/utils";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { DepositModal } from "./DepositModal";
import { ProfileDialog } from "./ProfileDialog";
import { toast } from "sonner";
import { User, Map } from "lucide-react";
import { generateRandomName } from "../lib/nameGenerator";

export function Header() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [hasAttemptedCreation, setHasAttemptedCreation] = useState(false);

  const initiateDeposit = useMutation(api.solana.initiateDeposit);
  const createPlayer = useMutation(api.players.createPlayer);

  const playerData = useQuery(
    api.players.getPlayer,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip",
  );

  const currentGame = useQuery(api.games.getCurrentGame);

  const houseWallet = useQuery(api.solana.getHouseWallet);

  const pendingTransactions = useQuery(
    api.transactions.getPendingTransactions,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip",
  );

  const gameCoins = playerData?.gameCoins || 0;
  const pendingCoins = playerData?.pendingCoins || 0;

  // Track previous transaction states to detect changes
  const prevTransactionsRef = useRef<typeof pendingTransactions>(undefined);
  const prevPlayerDataRef = useRef<typeof playerData>(undefined);

  useEffect(() => {
    if (!pendingTransactions || !prevTransactionsRef.current) {
      prevTransactionsRef.current = pendingTransactions;
      return;
    }

    const prev = prevTransactionsRef.current;
    const current = pendingTransactions;

    // Check for status changes
    prev.forEach((prevTx) => {
      const currentTx = current.find((tx) => tx._id === prevTx._id);

      if (currentTx && prevTx.status !== currentTx.status) {
        if (currentTx.status === "completed") {
          toast.success(
            `${currentTx.type === "deposit" ? "Deposit" : "Withdrawal"} completed successfully!`
          );
        } else if (currentTx.status === "failed") {
          toast.error(
            `${currentTx.type === "deposit" ? "Deposit" : "Withdrawal"} failed. Please try again.`
          );
        }
      }
    });

    prevTransactionsRef.current = pendingTransactions;
  }, [pendingTransactions]);

  // Monitor player data changes for pending coins being processed
  useEffect(() => {
    if (!playerData || !prevPlayerDataRef.current) {
      prevPlayerDataRef.current = playerData;
      return;
    }

    const prev = prevPlayerDataRef.current;
    const current = playerData;

    // Check if pending coins decreased and game coins increased (pending coins were processed)
    if (prev.pendingCoins > 0 && current.pendingCoins < prev.pendingCoins) {
      const processedAmount = prev.pendingCoins - current.pendingCoins;
      toast.success(`${processedAmount.toLocaleString()} coins have been added to your balance!`);
    }

    prevPlayerDataRef.current = playerData;
  }, [playerData]);

  // Create player with random name on first connect
  useEffect(() => {
    // Debug logging
    console.log("Player creation check:", {
      connected,
      publicKey: publicKey?.toString(),
      playerData,
      hasAttemptedCreation
    });

    // Only create player when:
    // 1. Wallet is connected
    // 2. We have a public key
    // 3. Player query has completed (playerData is not undefined)
    // 4. Player doesn't exist (playerData is null)
    // 5. We haven't already attempted creation
    if (connected && publicKey && playerData === null && !hasAttemptedCreation) {
      const randomName = generateRandomName();
      const walletAddr = publicKey.toString();

      console.log("Creating new player for wallet:", walletAddr, "with name:", randomName);
      setHasAttemptedCreation(true);

      createPlayer({
        walletAddress: walletAddr,
        displayName: randomName
      }).then((playerId) => {
        toast.success(`Welcome! Your display name is: ${randomName}`);
        console.log("Player created successfully with ID:", playerId);
      }).catch((error) => {
        console.error("Failed to create player:", error);
        toast.error("Failed to create player profile. Please refresh the page and try again.");
        // Reset the flag to allow retry on next wallet connect
        setHasAttemptedCreation(false);
      });
    }

    // Reset the flag when wallet disconnects
    if (!connected) {
      setHasAttemptedCreation(false);
    }
  }, [connected, publicKey, playerData, hasAttemptedCreation, createPlayer]);

  const handleDeposit = async (amount: number): Promise<void> => {
    if (publicKey && sendTransaction && houseWallet?.address) {
      try {
        // Create connection
        const connection = new Connection(
          import.meta.env.VITE_SOLANA_RPC_URL || getSolanaRpcUrl(),
          "confirmed",
        );

        // Create transaction
        const housePublicKey = new PublicKey(houseWallet.address);
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: housePublicKey,
            lamports: lamports,
          }),
        );

        // Send transaction via wallet
        const signature = await sendTransaction(
          transaction,
          connection,
        );

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed");

        // Queue deposit in our system
        await initiateDeposit({
          walletAddress: publicKey.toString(),
          solAmount: amount,
        });

        setShowDepositModal(false);
        toast.success(`Deposit successful! Transaction: ${signature}`);
      } catch (error) {
        console.error("Deposit failed:", error);
        let errorMessage = "Deposit failed. Please try again.";

        if (error instanceof WalletError) {
          errorMessage = error.message;
          if (error.message.includes("rejected") || error.message.includes("cancelled")) {
            toast.warning("Transaction was cancelled by user");
            return;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
          if (errorMessage.includes("rejected") || errorMessage.includes("cancelled")) {
            toast.warning("Transaction was cancelled by user");
            return;
          }
        }

        toast.error(errorMessage);
      }
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 ">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <img src="/assets/logo.webp" alt="Enrageded" className="h-22 w-auto" />
            </div>

            <div className="flex items-center space-x-4">
              {/* Game Mode Display */}
              {currentGame && (
                <div className="flex flex-col items-center text-amber-300">
                  <div className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-amber-400" />
                    <div className="font-bold text-amber-300 text-sm uppercase tracking-wide">
                      {currentGame.map?.name || "Loading"}
                    </div>
                  </div>
                  {currentGame.isSmallGame && (
                    <div className="text-amber-300 text-xs flex items-center gap-1 mt-1">
                      <span className="text-yellow-300">⚡</span>
                      Quick Game Mode: 3 phases (45 seconds total)
                    </div>
                  )}
                </div>
              )}

              {connected && (
                <>
                  <Button
                    onClick={() => setShowProfileDialog(true)}
                    variant="ghost"
                    className="text-gray-300 hover:text-white hover:bg-gray-800"
                    title={playerData?.displayName || "Profile"}
                  >
                    <User className="h-5 w-5" />
                    <span className="ml-2 hidden sm:inline">
                      {playerData?.displayName || "Profile"}
                    </span>
                  </Button>

                  <div className="bg-gradient-to-r from-amber-900/30 to-yellow-900/30 rounded-lg p-3 border border-amber-600/50 backdrop-blur-sm flex items-center space-x-3 shadow-lg shadow-amber-500/20">
                    <div className="text-right">
                      <div className="text-amber-300 font-bold text-lg flex items-center">
                        <span className="text-amber-400 mr-1">£</span> {gameCoins.toLocaleString()}
                      </div>
                      {pendingCoins > 0 && (
                        <div className="text-amber-200 font-semibold text-xs animate-pulse">
                          +{pendingCoins.toLocaleString()} pending
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => setShowDepositModal(true)}
                      className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-amber-950 font-bold text-xs px-3 py-1.5 h-auto shadow-md transition-all duration-200 hover:shadow-amber-400/30"
                    >
                      Deposit
                    </Button>
                  </div>
                </>
              )}
              <UnifiedWalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Render modals outside header */}
      {showDepositModal && (
        <DepositModal
          onClose={() => setShowDepositModal(false)}
          onDeposit={handleDeposit}
        />
      )}

      {showProfileDialog && publicKey && (
        <ProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          currentName={playerData?.displayName}
          walletAddress={publicKey.toString()}
        />
      )}
    </>
  );
}
