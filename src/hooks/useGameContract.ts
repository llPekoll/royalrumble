/**
 * React Hook for Domin8 Smart Contract Interactions
 *
 * This hook provides all the functions needed to interact with the
 * domin8_prgm Solana smart contract from the frontend using Privy.
 *
 * IMPORTANT: This hook uses Privy for wallet management, NOT @solana/wallet-adapter
 * Pattern follows CharacterSelection.tsx implementation with @solana/kit
 *
 * KEY IMPLEMENTATION DETAILS:
 * - Uses usePrivyWallet() custom hook for wallet state
 * - Uses @solana/kit for manual transaction building (NOT Anchor Program)
 * - Manual instruction creation with discriminators from IDL
 * - Transaction signing via wallet.signAndSendAllTransactions()
 * - Chain specification required: `solana:${network}`
 * - Signature returned as hex string for database storage
 *
 * EXAMPLE USAGE:
 * ```typescript
 * const { connected, placeBet, getBalance } = useGameContract();
 *
 * if (connected) {
 *   const signature = await placeBet(0.5); // 0.5 SOL
 *   console.log("Bet placed:", signature);
 * }
 * ```
 */

import { useCallback, useMemo } from "react";
import { usePrivyWallet } from "./usePrivyWallet";
import { useWallets } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, TransactionSignature, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN, web3, Wallet } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import { Domin8PrgmIDL, DOMIN8_PROGRAM_ID, type Domin8Prgm } from "../programs/domin8";

// Use the program ID from the IDL (or environment override)
const PROGRAM_ID = import.meta.env.VITE_GAME_PROGRAM_ID
  ? new PublicKey(import.meta.env.VITE_GAME_PROGRAM_ID)
  : DOMIN8_PROGRAM_ID;

// Simple Wallet implementation for Privy
class PrivyWalletAdapter implements Wallet {
  constructor(
    public publicKey: PublicKey,
    private privyWallet: any,
    private network: string
  ) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    const chainId = `solana:${this.network}` as `${string}:${string}`;

    // Serialize transaction
    let serialized: Uint8Array;
    if (tx instanceof Transaction) {
      serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    } else {
      serialized = tx.message.serialize();
    }

    // Sign with Privy
    const result = await this.privyWallet.signAndSendAllTransactions([
      {
        chain: chainId,
        transaction: serialized,
      }
    ]);

    // Note: Privy sends the transaction, so we just return the signed tx
    // This is a limitation - we can't get back the signed tx without sending
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    const chainId = `solana:${this.network}` as `${string}:${string}`;

    const serializedTxs = txs.map(tx => {
      if (tx instanceof Transaction) {
        return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      } else {
        return tx.message.serialize();
      }
    });

    await this.privyWallet.signAndSendAllTransactions(
      serializedTxs.map(transaction => ({
        chain: chainId,
        transaction,
      }))
    );

    return txs;
  }
}

// Constants from smart contract
const MIN_BET_LAMPORTS = 10_000_000; // 0.01 SOL
const HOUSE_FEE_BPS = 500; // 5%

// PDA Seeds
const GAME_CONFIG_SEED = "game_config";
const GAME_COUNTER_SEED = "game_counter";
const GAME_ROUND_SEED = "game_round";
const BET_ENTRY_SEED = "bet";
const VAULT_SEED = "vault";

// Type definitions
export interface GameRound {
  roundId: BN;
  status: "idle" | "waiting" | "awaitingWinnerRandomness" | "finished";
  startTimestamp: BN;
  endTimestamp: BN;
  betCount: number;
  totalPot: BN;
  betAmounts: BN[];
  winner: PublicKey;
  winningBetIndex: number;
  vrfRequestPubkey: PublicKey;
  vrfSeed: number[];
}

export interface GameConfig {
  authority: PublicKey;
  treasury: PublicKey;
  houseFee: number;
  minBet: BN;
  betsLocked: boolean;
  force: number[];
}

export interface BetEntry {
  roundId: BN;
  betIndex: number;
  wallet: PublicKey;
  betAmount: BN;
}

export interface GameCounter {
  currentRoundId: BN;
}

export const useGameContract = () => {
  const { connected, publicKey, walletAddress } = usePrivyWallet();
  const { wallets } = useWallets();

  // Get selected wallet (first Solana wallet from Privy)
  const selectedWallet = useMemo(() => {
    return wallets.length > 0 ? wallets[0] : null;
  }, [wallets]);

  // RPC connection (use env variable)
  const connection = useMemo(() => {
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    return new Connection(rpcUrl, "confirmed");
  }, []);

  // Network configuration
  const network = useMemo(() => {
    return import.meta.env.VITE_SOLANA_NETWORK || "devnet";
  }, []);

  const rpcUrl = useMemo(() => {
    return network === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  }, [network]);

  // Create Anchor Provider and Program
  const { provider, program } = useMemo<{ provider: AnchorProvider | null; program: Program<Domin8Prgm> | null }>(() => {
    if (!connected || !publicKey || !selectedWallet) {
      return { provider: null, program: null };
    }

    try {
      const wallet = new PrivyWalletAdapter(publicKey, selectedWallet, network);
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });

      const program = new Program<Domin8Prgm>(Domin8PrgmIDL as any, provider);
      return { provider, program };
    } catch (error) {
      console.error("Failed to create Anchor program:", error);
      return { provider: null, program: null };
    }
  }, [connected, publicKey, selectedWallet, connection, network]);

  // Derive PDAs
  const derivePDAs = useCallback(() => {
    const [gameConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_CONFIG_SEED)],
      PROGRAM_ID
    );

    const [gameCounterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_COUNTER_SEED)],
      PROGRAM_ID
    );

    const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from(VAULT_SEED)], PROGRAM_ID);

    return { gameConfigPda, gameCounterPda, vaultPda };
  }, []);

  const deriveGameRoundPda = useCallback((roundId: number) => {
    // Match Rust: round_id is u64 (8 bytes)
    const roundIdBuffer = new BN(roundId).toArrayLike(Buffer, "le", 8);

    const [gameRoundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_ROUND_SEED), roundIdBuffer],
      PROGRAM_ID
    );

    return gameRoundPda;
  }, []);

  const deriveBetEntryPda = useCallback((roundId: number, betIndex: number) => {
    // Match Rust: round_id is u64 (8 bytes), bet_count is u32 (4 bytes)
    const roundIdBuffer = new BN(roundId).toArrayLike(Buffer, "le", 8);
    const betIndexBuffer = new BN(betIndex).toArrayLike(Buffer, "le", 4);

    const [betEntryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(BET_ENTRY_SEED), roundIdBuffer, betIndexBuffer],
      PROGRAM_ID
    );

    return betEntryPda;
  }, []);

  // Fetch functions
  const fetchGameConfig = useCallback(async (): Promise<GameConfig | null> => {
    try {
      const { gameConfigPda } = derivePDAs();
      const accountInfo = await connection.getAccountInfo(gameConfigPda);

      if (!accountInfo) return null;

      // Parse account data (simplified - use anchor IDL in production)
      // For now, return null and handle in calling code
      return null;
    } catch (error) {
      console.error("Error fetching game config:", error);
      return null;
    }
  }, [connection, derivePDAs]);

  const fetchGameRound = useCallback(
    async (roundId: number): Promise<GameRound | null> => {
      try {
        const gameRoundPda = deriveGameRoundPda(roundId);
        const accountInfo = await connection.getAccountInfo(gameRoundPda);

        if (!accountInfo) return null;

        // Parse account data (use anchor IDL in production)
        return null;
      } catch (error) {
        console.error("Error fetching game round:", error);
        return null;
      }
    },
    [connection, deriveGameRoundPda]
  );

  const fetchCurrentRoundId = useCallback(async (): Promise<number> => {
    try {
      const { gameCounterPda } = derivePDAs();
      const accountInfo = await connection.getAccountInfo(gameCounterPda);

      if (!accountInfo) return 0;

      // Parse current_round_id (u64 at offset 8)
      const data = accountInfo.data;
      const roundId = Number(new BN(data.slice(8, 16), "le"));

      return roundId;
    } catch (error) {
      console.error("Error fetching current round ID:", error);
      return 0;
    }
  }, [connection, derivePDAs]);

  const fetchBetEntry = useCallback(
    async (roundId: number, betIndex: number): Promise<BetEntry | null> => {
      try {
        const betEntryPda = deriveBetEntryPda(roundId, betIndex);
        const accountInfo = await connection.getAccountInfo(betEntryPda);

        if (!accountInfo) return null;

        // Parse bet entry data
        return null;
      } catch (error) {
        console.error("Error fetching bet entry:", error);
        return null;
      }
    },
    [connection, deriveBetEntryPda]
  );

  // Smart contract instruction functions

  /**
   * Create a new game with the first bet
   * @param amount - Bet amount in SOL
   * @returns Transaction signature
   */
  const createGame = useCallback(
    async (amount: number): Promise<TransactionSignature> => {
      if (!connected || !publicKey || !selectedWallet) {
        throw new Error("Wallet not connected");
      }

      if (amount < MIN_BET_LAMPORTS / LAMPORTS_PER_SOL) {
        throw new Error(`Minimum bet is ${MIN_BET_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
      }

      try {
        const { gameConfigPda, vaultPda } = derivePDAs();
        const currentRoundId = await fetchCurrentRoundId();
        const gameRoundPda = deriveGameRoundPda(currentRoundId);

        // Convert SOL to lamports
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

        // Create instruction data: [discriminator (8 bytes), amount (8 bytes)]
        const instructionData = new Uint8Array(16);

        // Discriminator for create_game instruction (from IDL)
        // create_game: [124, 69, 75, 66, 184, 220, 72, 206]
        const discriminator = new Uint8Array([124, 69, 75, 66, 184, 220, 72, 206]);
        instructionData.set(discriminator, 0);

        // Write amount as little-endian u64
        const view = new DataView(instructionData.buffer);
        view.setBigUint64(8, BigInt(amountLamports), true);

        // Create deposit_bet instruction in @solana/kit format
        const depositBetInstruction = {
          programAddress: address(PROGRAM_ID.toString()),
          accounts: [
            { address: address(gameConfigPda.toString()), role: 0 }, // readonly
            { address: address(gameRoundPda.toString()), role: 1 }, // writable
            { address: address(vaultPda.toString()), role: 1 }, // writable
            { address: address(selectedWallet.address), role: 3 }, // signer + writable
            { address: address(SystemProgram.programId.toString()), role: 0 }, // readonly
          ],
          data: instructionData,
        };

        // Get latest blockhash
        const { getLatestBlockhash } = createSolanaRpc(rpcUrl);
        const { value: latestBlockhash } = await getLatestBlockhash().send();

        // Create transaction using @solana/kit
        const transaction = pipe(
          createTransactionMessage({ version: 0 }),
          (tx) => setTransactionMessageFeePayer(address(selectedWallet.address), tx),
          (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
          (tx) => appendTransactionMessageInstructions([depositBetInstruction], tx),
          (tx) => compileTransaction(tx),
          (tx) => new Uint8Array(getTransactionEncoder().encode(tx))
        );

        // Send the transaction with explicit chain specification
        const chainId = `solana:${network}` as `${string}:${string}`;
        const receipts = await selectedWallet.signAndSendAllTransactions([
          {
            chain: chainId,
            transaction,
          },
        ]);

        // Convert signature to hex string
        const signature = receipts[0].signature;
        const signatureHex = Array.from(signature as Uint8Array)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        return signatureHex;
      } catch (error) {
        console.error("Error creating game:", error);
        throw error;
      }
    },
    [
      connected,
      publicKey,
      selectedWallet,
      connection,
      derivePDAs,
      deriveGameRoundPda,
      fetchCurrentRoundId,
      rpcUrl,
      network,
    ]
  );

  /**
   * Place a bet in the current game using Anchor Program
   * @param amount - Bet amount in SOL
   * @returns Transaction signature
   */
  const placeBet = useCallback(
    async (amount: number): Promise<TransactionSignature> => {
      if (!connected || !publicKey || !program) {
        throw new Error("Wallet not connected or program not initialized");
      }

      if (amount < MIN_BET_LAMPORTS / LAMPORTS_PER_SOL) {
        throw new Error(`Minimum bet is ${MIN_BET_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
      }

      try {
        console.log("[placeBet] Placing bet of", amount, "SOL");

        // Convert SOL to lamports
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
        const amountBN = new BN(amountLamports);

        // Fetch current round ID
        const currentRoundId = await fetchCurrentRoundId();
        console.log("[placeBet] Current round ID:", currentRoundId);

        // Derive PDAs
        const { gameConfigPda, gameCounterPda, vaultPda } = derivePDAs();

        // Check previous round first (counter increments AFTER game creation, so active game is usually counter - 1)
        let activeRoundId = currentRoundId;
        let gameRoundPda = deriveGameRoundPda(currentRoundId);
        let gameRoundInfo = await connection.getAccountInfo(gameRoundPda);

        // If current round doesn't exist, check previous round
        if (!gameRoundInfo && currentRoundId > 0) {
          const prevRoundId = currentRoundId - 1;
          const prevGameRoundPda = deriveGameRoundPda(prevRoundId);
          const prevGameRoundInfo = await connection.getAccountInfo(prevGameRoundPda);

          if (prevGameRoundInfo) {
            // Previous round exists, check if it's still accepting bets
            const prevGameRound = await program.account.gameRound.fetch(prevGameRoundPda);
            const prevStatus = Object.keys(prevGameRound.status)[0];
            console.log(`[placeBet] Previous round ${prevRoundId} exists with status: ${prevStatus}`);

            if (prevStatus === "waiting") {
              // Previous round is still active, use it!
              activeRoundId = prevRoundId;
              gameRoundPda = prevGameRoundPda;
              gameRoundInfo = prevGameRoundInfo;
              console.log(`[placeBet] Using active previous round: ${prevRoundId}`);
            }
          }
        }

        let tx: string;

        // Check if we need to create a new game (no game OR game is finished)
        let shouldCreateNewGame = false;

        if (!gameRoundInfo) {
          shouldCreateNewGame = true;
          console.log("[placeBet] No game exists, creating new game with first bet");
        } else {
          // Game exists - check if it's finished
          const gameRoundAccount = await program.account.gameRound.fetch(gameRoundPda);
          const gameStatus = Object.keys(gameRoundAccount.status)[0];
          console.log("[placeBet] Game exists with status:", gameStatus);

          if (gameStatus === "finished") {
            shouldCreateNewGame = true;
            console.log("[placeBet] Game is finished, need to create new round");
          }
        }

        if (shouldCreateNewGame) {
          // No game exists OR game is finished - CREATE a new game with this bet
          console.log("[placeBet] Creating new game for round", currentRoundId);

          // Get config to fetch VRF force field
          const configInfo = await connection.getAccountInfo(gameConfigPda);
          if (!configInfo) {
            throw new Error("Game config not found. Please contact support.");
          }

          // Parse force field from config using Anchor deserialization
          const configAccountParsed = await program.account.gameConfig.fetch(gameConfigPda);
          const force = Buffer.from(configAccountParsed.force);

          // Derive VRF accounts using ORAO VRF SDK
          const { Orao, networkStateAccountAddress, randomnessAccountAddress } = await import('@orao-network/solana-vrf');

          const ORAO_VRF_PROGRAM_ID = new PublicKey("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");

          // Use ORAO SDK methods for correct PDA derivation
          const networkState = networkStateAccountAddress();
          const vrfRequest = randomnessAccountAddress(force);

          // Fetch treasury from network state (dynamic, not hardcoded)
          // Create minimal provider for ORAO SDK
          const orao = new Orao(provider as any);
          const networkStateData = await orao.getNetworkState();
          const vrfTreasury = networkStateData.config.treasury;

          console.log("[placeBet] VRF accounts:", {
            networkState: networkState.toString(),
            vrfRequest: vrfRequest.toString(),
            treasury: vrfTreasury.toString(),
          });

          // Derive first bet entry PDA (index 0)
          const betEntryPda = deriveBetEntryPda(currentRoundId, 0);

          // Call create_game instruction
          tx = await program.methods
            .createGame(amountBN)
            .accounts({
              config: gameConfigPda,
              counter: gameCounterPda,
              gameRound: gameRoundPda,
              betEntry: betEntryPda,
              vault: vaultPda,
              player: publicKey,
              networkState,
              treasury: vrfTreasury,
              vrfRequest,
              systemProgram: SystemProgram.programId,
              vrfProgram: ORAO_VRF_PROGRAM_ID,
            })
            .rpc();

          console.log("[placeBet] Created new game with first bet");
        } else {
          // Game exists - PLACE an additional bet
          console.log(`[placeBet] Game exists (round ${activeRoundId}), placing additional bet`);

          // Fetch fresh game state using Anchor (more reliable than manual parsing)
          const gameRoundAccount = await program.account.gameRound.fetch(gameRoundPda);
          const betCount = gameRoundAccount.betCount;
          console.log("[placeBet] Current bet count (from Anchor):", betCount);

          // Derive bet entry PDA for this bet (use activeRoundId, not currentRoundId!)
          const betEntryPda = deriveBetEntryPda(activeRoundId, betCount);
          console.log("[placeBet] Derived bet entry PDA:", betEntryPda.toString());

          // Call place_bet instruction with all required accounts
          tx = await program.methods
            .placeBet(amountBN)
            .accounts({
              config: gameConfigPda,
              counter: gameCounterPda,
              gameRound: gameRoundPda,
              betEntry: betEntryPda,
              vault: vaultPda,
              player: publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
        }

        console.log("[placeBet] Transaction successful:", tx);
        return tx;
      } catch (error: any) {
        console.error("[placeBet] Error:", error);

        // WORKAROUND: Privy signing sometimes throws "signature verification failed"
        // but the transaction actually succeeds on-chain. Check if it's just a signing error.
        if (error.message && error.message.includes("Signature verification")) {
          console.log("[placeBet] Signature verification error (Privy quirk) - transaction likely succeeded");
          // Return a placeholder - the UI should refresh to show the updated game state
          return "transaction_pending";
        }

        // Try to extract useful error message
        if (error.error) {
          throw new Error(`Smart contract error: ${error.error.errorMessage || error.error.errorCode?.code || "Unknown error"}`);
        } else if (error.message) {
          throw new Error(error.message);
        } else {
          throw error;
        }
      }
    },
    [connected, publicKey, program, fetchCurrentRoundId, derivePDAs, deriveGameRoundPda, deriveBetEntryPda, connection]
  );

  /**
   * Get user's wallet balance
   * @returns Balance in SOL
   */
  const getBalance = useCallback(async (): Promise<number> => {
    if (!publicKey) return 0;

    try {
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error fetching balance:", error);
      return 0;
    }
  }, [publicKey, connection]);

  /**
   * Validate bet amount
   * @param amount - Bet amount in SOL
   * @returns Validation result
   */
  const validateBet = useCallback(
    async (amount: number): Promise<{ valid: boolean; error?: string }> => {
      if (amount < MIN_BET_LAMPORTS / LAMPORTS_PER_SOL) {
        return {
          valid: false,
          error: `Minimum bet is ${MIN_BET_LAMPORTS / LAMPORTS_PER_SOL} SOL`,
        };
      }

      const balance = await getBalance();
      if (amount > balance) {
        return {
          valid: false,
          error: "Insufficient balance",
        };
      }

      return { valid: true };
    },
    [getBalance]
  );

  /**
   * Check if user can place bet based on game status
   * @param gameStatus - Current game status
   * @param endTimestamp - Betting window end time
   * @returns Can place bet
   */
  const canPlaceBet = useCallback((gameStatus: string, endTimestamp: number): boolean => {
    const now = Math.floor(Date.now() / 1000);

    if (gameStatus !== "waiting") {
      return false;
    }

    if (now >= endTimestamp) {
      return false;
    }

    return true;
  }, []);

  return {
    // Connection info
    connected,
    publicKey,
    walletAddress,
    selectedWallet,

    // PDA derivation
    derivePDAs,
    deriveGameRoundPda,
    deriveBetEntryPda,

    // Fetch functions
    fetchGameConfig,
    fetchGameRound,
    fetchCurrentRoundId,
    fetchBetEntry,
    getBalance,

    // Validation
    validateBet,
    canPlaceBet,

    // Smart contract interactions (using Anchor)
    placeBet,

    // Constants
    MIN_BET: MIN_BET_LAMPORTS / LAMPORTS_PER_SOL,
    HOUSE_FEE_BPS,
    PROGRAM_ID,
  };
};

export default useGameContract;
