// Re-export all solana functionality for backward compatibility
export { getHouseWallet } from "./solana/wallet";
export { initiateDeposit, initiateWithdrawal } from "./solana/operations";
export { processTransactionQueue } from "./solana/processor";