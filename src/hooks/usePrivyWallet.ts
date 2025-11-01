import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey } from "@solana/web3.js";

export function usePrivyWallet() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  
  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address;
  
  return {
    connected: ready && authenticated && !!walletAddress,
    publicKey: walletAddress ? new PublicKey(walletAddress) : null,
    walletAddress,
    wallet: solanaWallet,
    ready
  };
}