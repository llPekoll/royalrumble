import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSolanaRpcUrl(): string {
  const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";

  switch (network) {
    case "mainnet":
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    case "testnet":
      return "https://api.testnet.solana.com";
    case "devnet":
    default:
      return "https://api.devnet.solana.com";
  }
}
