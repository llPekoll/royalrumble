/**
 * React Hook for Domin8 Smart Contract Interactions
 *
 * This hook provides all the functions needed to interact with the
 * domin8_prgm Solana smart contract from the frontend.
 */

import { useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionSignature
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { Orao, networkStateAccountAddress, randomnessAccountAddress } from '@orao-network/solana-vrf';

// Program ID (update this with your deployed program ID)
const PROGRAM_ID = new PublicKey('8BH1JMeZCohtUKcfGGTqpYjpwxMowZBi6HrnAhc6eJFz');
const ORAO_VRF_PROGRAM_ID = new PublicKey('VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y');

// Constants from smart contract
const MIN_BET_LAMPORTS = 10_000_000; // 0.01 SOL
const HOUSE_FEE_BPS = 500; // 5%

// PDA Seeds
const GAME_CONFIG_SEED = 'game_config';
const GAME_COUNTER_SEED = 'game_counter';
const GAME_ROUND_SEED = 'game_round';
const BET_ENTRY_SEED = 'bet';
const VAULT_SEED = 'vault';

// Type definitions
export interface GameRound {
  roundId: BN;
  status: 'idle' | 'waiting' | 'awaitingWinnerRandomness' | 'finished';
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
  const { connection } = useConnection();
  const wallet = useWallet();

  // Create Anchor provider
  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return null;
    }

    return new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
  }, [connection, wallet]);

  // Initialize ORAO VRF
  const vrf = useMemo(() => {
    if (!provider) return null;
    return new Orao(provider as any);
  }, [provider]);

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

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED)],
      PROGRAM_ID
    );

    return { gameConfigPda, gameCounterPda, vaultPda };
  }, []);

  const deriveGameRoundPda = useCallback((roundId: number) => {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeUInt32LE(roundId, 0);

    const [gameRoundPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(GAME_ROUND_SEED), roundIdBuffer],
      PROGRAM_ID
    );

    return gameRoundPda;
  }, []);

  const deriveBetEntryPda = useCallback((roundId: number, betIndex: number) => {
    const roundIdBuffer = Buffer.alloc(8);
    roundIdBuffer.writeUInt32LE(roundId, 0);

    const betIndexBuffer = Buffer.alloc(4);
    betIndexBuffer.writeUInt32LE(betIndex, 0);

    const [betEntryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(BET_ENTRY_SEED), roundIdBuffer, betIndexBuffer],
      PROGRAM_ID
    );

    return betEntryPda;
  }, []);

  // Get VRF accounts from config
  const deriveVrfAccounts = useCallback(async (forceFieldSeed: Buffer) => {
    const networkState = networkStateAccountAddress();
    const vrfRequest = randomnessAccountAddress(forceFieldSeed);

    // Get treasury from ORAO network state
    let treasury: PublicKey;
    try {
      if (vrf) {
        const networkStateData = await vrf.getNetworkState();
        treasury = networkStateData.config.treasury;
      } else {
        // Fallback - get from on-chain account
        const networkStateInfo = await connection.getAccountInfo(networkState);
        // Parse treasury from account data (offset 40)
        treasury = new PublicKey(networkStateInfo!.data.slice(40, 72));
      }
    } catch (error) {
      console.error('Failed to fetch ORAO treasury:', error);
      throw new Error('VRF not available');
    }

    return { networkState, treasury, vrfRequest };
  }, [connection, vrf]);

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
      console.error('Error fetching game config:', error);
      return null;
    }
  }, [connection, derivePDAs]);

  const fetchGameRound = useCallback(async (roundId: number): Promise<GameRound | null> => {
    try {
      const gameRoundPda = deriveGameRoundPda(roundId);
      const accountInfo = await connection.getAccountInfo(gameRoundPda);

      if (!accountInfo) return null;

      // Parse account data (use anchor IDL in production)
      return null;
    } catch (error) {
      console.error('Error fetching game round:', error);
      return null;
    }
  }, [connection, deriveGameRoundPda]);

  const fetchCurrentRoundId = useCallback(async (): Promise<number> => {
    try {
      const { gameCounterPda } = derivePDAs();
      const accountInfo = await connection.getAccountInfo(gameCounterPda);

      if (!accountInfo) return 0;

      // Parse current_round_id (u64 at offset 8)
      const data = accountInfo.data;
      const roundId = Number(new BN(data.slice(8, 16), 'le'));

      return roundId;
    } catch (error) {
      console.error('Error fetching current round ID:', error);
      return 0;
    }
  }, [connection, derivePDAs]);

  const fetchBetEntry = useCallback(async (roundId: number, betIndex: number): Promise<BetEntry | null> => {
    try {
      const betEntryPda = deriveBetEntryPda(roundId, betIndex);
      const accountInfo = await connection.getAccountInfo(betEntryPda);

      if (!accountInfo) return null;

      // Parse bet entry data
      return null;
    } catch (error) {
      console.error('Error fetching bet entry:', error);
      return null;
    }
  }, [connection, deriveBetEntryPda]);

  // Smart contract instruction functions

  /**
   * Create a new game with the first bet
   * @param amount - Bet amount in SOL
   * @returns Transaction signature
   */
  const createGame = useCallback(async (amount: number): Promise<TransactionSignature> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    if (amount < MIN_BET_LAMPORTS / LAMPORTS_PER_SOL) {
      throw new Error(`Minimum bet is ${MIN_BET_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
    }

    try {
      const { gameConfigPda, gameCounterPda, vaultPda } = derivePDAs();
      const currentRoundId = await fetchCurrentRoundId();
      const gameRoundPda = deriveGameRoundPda(currentRoundId);
      const betEntryPda = deriveBetEntryPda(currentRoundId, 0);

      // Get config to fetch force field for VRF
      const configAccountInfo = await connection.getAccountInfo(gameConfigPda);
      if (!configAccountInfo) throw new Error('Game not initialized');

      // Parse force field (32 bytes at offset after authority + treasury + house_fee + min_bet)
      // Offset: 8 (discriminator) + 32 (authority) + 32 (treasury) + 2 (house_fee) + 8 (min_bet) + 1 (bets_locked) = 83
      const forceField = Buffer.from(configAccountInfo.data.slice(83, 115));

      // Derive VRF accounts
      const vrfAccounts = await deriveVrfAccounts(forceField);

      // Create instruction data
      const amountLamports = new BN(amount * LAMPORTS_PER_SOL);

      // Build transaction (simplified - use anchor program in production)
      const transaction = new Transaction();

      // Add create_game instruction
      // In production, use: await program.methods.createGame(amountLamports).accounts({...}).rpc()

      throw new Error('Use Anchor Program for instruction building');

    } catch (error) {
      console.error('Error creating game:', error);
      throw error;
    }
  }, [wallet, connection, derivePDAs, deriveGameRoundPda, deriveBetEntryPda, fetchCurrentRoundId, deriveVrfAccounts]);

  /**
   * Place a bet in the current game
   * @param amount - Bet amount in SOL
   * @returns Transaction signature
   */
  const placeBet = useCallback(async (amount: number): Promise<TransactionSignature> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    if (amount < MIN_BET_LAMPORTS / LAMPORTS_PER_SOL) {
      throw new Error(`Minimum bet is ${MIN_BET_LAMPORTS / LAMPORTS_PER_SOL} SOL`);
    }

    try {
      const { gameConfigPda, gameCounterPda, vaultPda } = derivePDAs();
      const currentRoundId = await fetchCurrentRoundId();
      const gameRoundPda = deriveGameRoundPda(currentRoundId);

      // Get current bet count to determine next bet index
      const gameRoundInfo = await connection.getAccountInfo(gameRoundPda);
      if (!gameRoundInfo) throw new Error('No active game');

      // Parse bet_count (u32 at offset after other fields)
      const betCount = gameRoundInfo.data.readUInt32LE(/* offset */);
      const betEntryPda = deriveBetEntryPda(currentRoundId, betCount);

      const amountLamports = new BN(amount * LAMPORTS_PER_SOL);

      // Use anchor program in production:
      // const tx = await program.methods
      //   .placeBet(amountLamports)
      //   .accounts({
      //     config: gameConfigPda,
      //     counter: gameCounterPda,
      //     gameRound: gameRoundPda,
      //     betEntry: betEntryPda,
      //     vault: vaultPda,
      //     player: wallet.publicKey,
      //     systemProgram: SystemProgram.programId,
      //   })
      //   .rpc();

      throw new Error('Use Anchor Program for instruction building');

    } catch (error) {
      console.error('Error placing bet:', error);
      throw error;
    }
  }, [wallet, connection, derivePDAs, deriveGameRoundPda, deriveBetEntryPda, fetchCurrentRoundId]);

  /**
   * Get user's wallet balance
   * @returns Balance in SOL
   */
  const getBalance = useCallback(async (): Promise<number> => {
    if (!wallet.publicKey) return 0;

    try {
      const balance = await connection.getBalance(wallet.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return 0;
    }
  }, [wallet.publicKey, connection]);

  /**
   * Validate bet amount
   * @param amount - Bet amount in SOL
   * @returns Validation result
   */
  const validateBet = useCallback(async (amount: number): Promise<{ valid: boolean; error?: string }> => {
    if (amount < MIN_BET_LAMPORTS / LAMPORTS_PER_SOL) {
      return {
        valid: false,
        error: `Minimum bet is ${MIN_BET_LAMPORTS / LAMPORTS_PER_SOL} SOL`
      };
    }

    const balance = await getBalance();
    if (amount > balance) {
      return {
        valid: false,
        error: 'Insufficient balance'
      };
    }

    return { valid: true };
  }, [getBalance]);

  /**
   * Check if user can place bet based on game status
   * @param gameStatus - Current game status
   * @param endTimestamp - Betting window end time
   * @returns Can place bet
   */
  const canPlaceBet = useCallback((gameStatus: string, endTimestamp: number): boolean => {
    const now = Math.floor(Date.now() / 1000);

    if (gameStatus !== 'waiting') {
      return false;
    }

    if (now >= endTimestamp) {
      return false;
    }

    return true;
  }, []);

  return {
    // Connection info
    connected: wallet.connected,
    publicKey: wallet.publicKey,

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

    // Smart contract interactions
    createGame,
    placeBet,

    // Constants
    MIN_BET: MIN_BET_LAMPORTS / LAMPORTS_PER_SOL,
    HOUSE_FEE_BPS,
  };
};

export default useGameContract;
