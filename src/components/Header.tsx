import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
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
import { toast } from "sonner";

export function Header() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [showDepositModal, setShowDepositModal] = useState(false);

  const initiateDeposit = useMutation(api.solana.initiateDeposit);

  const playerData = useQuery(
    api.players.getPlayer,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip",
  );

  const houseWallet = useQuery(api.solana.getHouseWallet);

  const pendingTransactions = useQuery(
    api.transactions.getPendingTransactions,
    connected && publicKey ? { walletAddress: publicKey.toString() } : "skip",
  );

  const gameCoins = playerData?.gameCoins || 0;
  const pendingCoins = playerData?.pendingCoins || 0;

  // Track previous transaction states to detect changes
  const prevTransactionsRef = useRef<typeof pendingTransactions>();
  const prevPlayerDataRef = useRef<typeof playerData>();

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white">Royal Rumble</h1>
            </div>

            <div className="flex items-center space-x-4">
              {connected && (
                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-green-400 font-mono text-sm">
                      {gameCoins.toLocaleString()} coins
                    </div>
                    {pendingCoins > 0 && (
                      <div className="text-yellow-400 font-mono text-xs">
                        +{pendingCoins.toLocaleString()} pending
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => setShowDepositModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1 h-auto"
                  >
                    Deposit
                  </Button>
                </div>
              )}
              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 transition-colors" />
            </div>
          </div>
        </div>
      </header>

      {/* Render deposit modal outside header */}
      {showDepositModal && (
        <DepositModal
          onClose={() => setShowDepositModal(false)}
          houseWallet={houseWallet?.address}
          onDeposit={handleDeposit}
        />
      )}
    </>
  );
}
