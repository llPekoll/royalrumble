"use node";
// @ts-ignore - ethers is installed in node_modules for Node.js actions
import { ethers } from "ethers";
import type { GameConfig, GameRound, BetEntry } from "./evm-types";
// @ts-ignore - JSON import for ABI
const Domin8ABI = require("./Domin8.json");

/**
 * @notice EVM client for interacting with the Domin8 smart contract.
 * @dev This class handles communication with an EVM-compatible blockchain like Base.
 * It uses the 'ethers' library for all blockchain interactions.
 */
export class EvmClient {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    public contract: ethers.Contract;

    /**
     * @param rpcEndpoint The URL of the EVM JSON-RPC endpoint.
     * @param privateKey The private key of the authority wallet ("crank").
     * @param contractAddress The address of the deployed Domin8 smart contract.
     */
    constructor(rpcEndpoint: string, privateKey: string, contractAddress: string) {
        this.provider = new ethers.JsonRpcProvider(rpcEndpoint);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(contractAddress, Domin8ABI, this.wallet);
    }

    /**
     * @notice Retrieves the current game configuration from the smart contract.
     * @returns A promise that resolves to the GameConfig object.
     */
    async getGameConfig(): Promise<GameConfig> {
        const [
            authority,
            treasury,
            houseFeeBasisPoints,
            minBet,
            gameDurationConfig
        ] = await Promise.all([
            this.contract.authority(),
            this.contract.treasury(),
            this.contract.houseFeeBasisPoints(),
            this.contract.minBet(),
            this.contract.gameDurationConfig()
        ]);

        return {
            authority,
            treasury,
            houseFeeBasisPoints: Number(houseFeeBasisPoints),
            minBet: minBet.toString(),
            gameDurationConfig: {
                waitingPhaseDuration: Number(gameDurationConfig.waitingPhaseDuration)
            }
        };
    }

    /**
     * @notice Retrieves the state of the current game round from the smart contract.
     * @returns A promise that resolves to the GameRound object.
     */
    async getGameRound(): Promise<GameRound> {
        const currentRoundId = await this.contract.currentRoundId();
        const roundData = await this.contract.gameRounds(currentRoundId);

        const bets: BetEntry[] = roundData.bets.map((bet: any) => ({
            wallet: bet.wallet,
            betAmount: Number(bet.betAmount),
            timestamp: Number(bet.timestamp)
        }));

        return {
            roundId: Number(roundData.roundId),
            status: roundData.status,
            startTimestamp: Number(roundData.startTimestamp),
            endTimestamp: Number(roundData.endTimestamp),
            bets: bets,
            totalPot: roundData.totalPot.toString(),
            winner: {
                wallet: roundData.winner.wallet,
                betAmount: Number(roundData.winner.betAmount),
                timestamp: Number(roundData.winner.timestamp)
            },
            randomnessFulfilled: roundData.randomnessFulfilled,
            vrfRequestId: roundData.vrfRequestId
        };
    }

    /**
     * @notice Calls the closeBettingWindow function on the smart contract.
     * @returns A promise that resolves to the transaction response.
     */
    async closeBettingWindow(): Promise<ethers.TransactionResponse> {
        const tx = await this.contract.closeBettingWindow();
        return tx;
    }
    
    /**
     * @notice Calls the selectWinnerAndPayout function on the smart contract.
     * @returns A promise that resolves to the transaction response.
     */
    async selectWinnerAndPayout(): Promise<ethers.TransactionResponse> {
        const tx = await this.contract.selectWinnerAndPayout();
        return tx;
    }
    
    /**
     * @notice Checks if a transaction has been confirmed on the blockchain.
     * @param txHash The hash of the transaction to check.
     * @returns A promise that resolves to the transaction receipt, or null if not confirmed.
     */
    async confirmTransaction(txHash: string): Promise<ethers.TransactionReceipt | null> {
        return this.provider.getTransactionReceipt(txHash);
    }

    /**
     * @notice Performs a health check on the EVM client and its connection.
     * @returns An object indicating the health status and any relevant messages.
     */
    async healthCheck(): Promise<{ healthy: boolean; message: string; blockNumber?: number }> {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            const balance = await this.provider.getBalance(this.wallet.address);

            if (balance === 0n) {
                return {
                    healthy: false,
                    message: `Authority wallet ${this.wallet.address} has zero balance.`,
                    blockNumber
                };
            }

            return {
                healthy: true,
                message: "EVM client is healthy.",
                blockNumber
            };
        } catch (error: any) {
            return {
                healthy: false,
                message: `Health check failed: ${error.message}`
            };
        }
    }
}
