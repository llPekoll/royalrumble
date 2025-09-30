import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { LogIn, LogOut, Wallet, Download } from "lucide-react";
import { Button } from "./ui/button";
import { isPhantomInstalled, openPhantomDownload } from "../lib/solana-wallet-utils";
import { toast } from "sonner";

interface PrivyWalletButtonProps {
  className?: string;
  compact?: boolean;
  showDisconnect?: boolean;
  onWalletConnected?: (address: string) => void;
}

export function PrivyWalletButton({
  className = "",
  compact = false,
  showDisconnect = true,
  onWalletConnected,
}: PrivyWalletButtonProps) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [isMounted, setIsMounted] = useState(false);
  const [hasPhantom, setHasPhantom] = useState(false);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address;

  // Check for Phantom installation
  useEffect(() => {
    setIsMounted(true);
    setHasPhantom(isPhantomInstalled());
  }, []);

  // Handle login with helpful message if Phantom not installed
  const handleLogin = () => {
    if (!hasPhantom) {
      toast.info(
        "Phantom wallet not detected. You can use email/social login for an embedded wallet, or install Phantom extension.",
        { duration: 5000 }
      );
    }
    login();
  };

  // Notify parent when wallet connects
  useEffect(() => {
    if (authenticated && walletAddress && onWalletConnected) {
      onWalletConnected(walletAddress);
    }
  }, [authenticated, walletAddress, onWalletConnected]);

  // Loading state
  if (!isMounted || !ready) {
    return (
      <Button disabled className="bg-gray-700 text-gray-300" size={compact ? "sm" : "default"}>
        Loading...
      </Button>
    );
  }

  // Not authenticated - show login button
  if (!authenticated || !walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={handleLogin}
          className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold"
          size={compact ? "sm" : "default"}
        >
          <LogIn className="h-4 w-4 mr-2" />
          {compact ? "Connect" : "Connect Wallet"}
        </Button>

        {/* Show Phantom install button if not detected */}
        {!hasPhantom && (
          <Button
            onClick={openPhantomDownload}
            variant="outline"
            size={compact ? "sm" : "default"}
            className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
            title="Install Phantom Wallet"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Authenticated - show wallet info
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/50 backdrop-blur-sm">
          <Wallet className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-medium text-gray-200 uppercase tracking-wide">
            {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
          </span>
        </div>

        {showDisconnect && (
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Full desktop version
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <Wallet className="w-4 h-4 text-indigo-400" />

        <div className="h-4 w-px bg-gray-700" />

        <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
          {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
        </span>
      </div>

      {showDisconnect && (
        <Button
          onClick={logout}
          variant="outline"
          size="sm"
          className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      )}
    </div>
  );
}