import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useState, useEffect } from "react";
import { getEvmRpcUrl } from "../lib/utils";

export function usePrivyWallet() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);

  const evmWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
  const walletAddress = evmWallet?.address;
  const connected = ready && authenticated && !!walletAddress;

  // Fetch ETH balance from the Privy embedded wallet
  useEffect(() => {
    if (!connected || !walletAddress) {
      setEthBalance(0);
      return;
    }

    const fetchBalance = async () => {
      setIsLoadingBalance(true);
      try {
        // Get RPC endpoint based on network environment
        const provider = new ethers.JsonRpcProvider(getEvmRpcUrl());

        // Fetch balance in wei
        const balanceWei = await provider.getBalance(walletAddress);

        // Convert wei to ETH
        const balanceETH = parseFloat(ethers.formatEther(balanceWei));
        setEthBalance(balanceETH);
      } catch (error) {
        console.error("Error fetching ETH balance:", error);
        setEthBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    void fetchBalance();

    // Refresh balance every 10 seconds while connected
    const interval = setInterval(() => void fetchBalance(), 10000);
    return () => clearInterval(interval);
  }, [connected, walletAddress]);

  // Function to manually refresh balance (e.g., after a transaction)
  const refreshBalance = async () => {
    if (!connected || !walletAddress) return;

    setIsLoadingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider(getEvmRpcUrl());
      const balanceWei = await provider.getBalance(walletAddress);
      const balanceETH = parseFloat(ethers.formatEther(balanceWei));
      setEthBalance(balanceETH);
    } catch (error) {
      console.error("Error refreshing ETH balance:", error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  return {
    connected,
    walletAddress,
    wallet: evmWallet,
    ready,
    ethBalance,
    isLoadingBalance,
    refreshBalance,
  };
}