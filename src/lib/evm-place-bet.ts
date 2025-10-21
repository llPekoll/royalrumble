/**
 * EVM bet placement utilities
 * This file contains the logic for calling the Domin8 smart contract functions
 */

import { ethers } from "ethers";
import Domin8ABI from "../../convex/evm/Domin8.json";

// Types for transaction parameters
export interface PlaceBetParams {
  wallet: any; // Privy wallet
  betAmountEth: number;
  contractAddress: string;
}

export interface PlaceBetResult {
  txHash: string;
  receipt: ethers.TransactionReceipt;
  betAmount: string; // in wei
}

/**
 * Places a bet on the EVM Domin8 contract
 *
 * @param params - Transaction parameters
 * @returns Promise with transaction result
 */
export async function placeBetOnContract(
  params: PlaceBetParams
): Promise<PlaceBetResult> {
  const {
    wallet,
    betAmountEth,
    contractAddress,
  } = params;

  // Create provider and signer using Privy's wallet provider
  const ethProvider = await wallet.getEthereumProvider();
  const provider = new ethers.BrowserProvider(ethProvider);
  const signer = await provider.getSigner();

  // Create contract instance with full ABI
  const contract = new ethers.Contract(
    contractAddress,
    Domin8ABI.abi,
    signer
  );

  // Convert ETH to wei
  const betAmountWei = ethers.parseEther(betAmountEth.toString());

  // Check current game state to determine if we need to create a new game or place a bet
  const currentRoundId = await contract.currentRoundId();
  const gameRound = await contract.gameRounds(currentRoundId);

  let tx: ethers.TransactionResponse;

  if (gameRound.status === 0) { // Idle - need to create game
    tx = await contract.createGame({ value: betAmountWei });
  } else if (gameRound.status === 1) { // Waiting - can place bet
    tx = await contract.placeBet({ value: betAmountWei });
  } else {
    throw new Error("Cannot place bet: Game is not in a valid state for betting");
  }

  // Wait for confirmation
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Transaction failed or was not confirmed");
  }

  return {
    txHash: tx.hash,
    receipt,
    betAmount: betAmountWei.toString(),
  };
}

/**
 * Validates bet amount against contract constraints
 *
 * @param betAmountEth - Bet amount in ETH
 * @param minBetWei - Minimum bet from contract config
 * @returns Validation result
 */
export function validateBetAmount(
  betAmountEth: number,
  minBetWei: string = "10000000000000000" // 0.01 ETH default
): { valid: boolean; error?: string } {
  const betAmountWei = ethers.parseEther(betAmountEth.toString());
  const minBet = BigInt(minBetWei);

  if (betAmountWei < minBet) {
    return {
      valid: false,
      error: `Bet amount must be at least ${ethers.formatEther(minBet)} ETH`
    };
  }

  if (betAmountEth > 10) { // Max bet of 10 ETH
    return {
      valid: false,
      error: "Bet amount cannot exceed 10 ETH"
    };
  }

  return { valid: true };
}