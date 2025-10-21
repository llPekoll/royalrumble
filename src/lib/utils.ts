import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEvmRpcUrl(): string {
  const network = import.meta.env.VITE_EVM_NETWORK || "base-sepolia";

  switch (network) {
    case "base-mainnet":
      return "https://mainnet.base.org";
    case "base-sepolia":
    default:
      return "https://sepolia.base.org";
  }
}
