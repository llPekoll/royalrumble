/**
 * Hook for debugging blockchain state
 * Shows all program accounts and their current state
 */

import { useEffect, useState, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Domin8PrgmIDL, DOMIN8_PROGRAM_ID, type Domin8Prgm } from '../programs/domin8';

export interface BlockchainDebugState {
  // Connection info
  connected: boolean;
  rpcEndpoint: string;
  programId: string;

  // Account states
  gameConfig: any | null;
  gameCounter: any | null;
  gameRound: any | null;
  vault: { balance: number; address: string } | null;

  // Derived info
  currentRoundId: number;
  gameRoundPDA: string;
  gameExists: boolean;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

export function useBlockchainDebug(): BlockchainDebugState {
  const [state, setState] = useState<Omit<BlockchainDebugState, 'refresh'>>({
    connected: false,
    rpcEndpoint: '',
    programId: '',
    gameConfig: null,
    gameCounter: null,
    gameRound: null,
    vault: null,
    currentRoundId: 0,
    gameRoundPDA: '',
    gameExists: false,
    isLoading: true,
    error: null,
  });

  const fetchBlockchainState = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      // Create a read-only provider (no wallet needed)
      const provider = new AnchorProvider(
        connection,
        {} as any, // No wallet for read-only
        { commitment: 'confirmed' }
      );

      const program = new Program<Domin8Prgm>(Domin8PrgmIDL as any, provider);

      // Derive all PDAs
      const [gameConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('game_config')],
        program.programId
      );

      const [gameCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('game_counter')],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        program.programId
      );

      // Fetch accounts
      let gameConfig = null;
      let gameCounter = null;
      let gameRound = null;
      let currentRoundId = 0;
      let gameRoundPDA = '';
      let gameExists = false;

      try {
        gameConfig = await program.account.gameConfig.fetch(gameConfigPda);
      } catch (err) {
        console.warn('Game config not found:', err);
      }

      try {
        gameCounter = await program.account.gameCounter.fetch(gameCounterPda);
        currentRoundId = Number(gameCounter.currentRoundId);
      } catch (err) {
        console.warn('Game counter not found:', err);
      }

      // Derive game round PDA
      // Try to fetch the current round, if it doesn't exist, try the previous round
      if (currentRoundId !== null) {
        let roundIdToFetch = currentRoundId;

        // Try current round first
        let roundIdBuffer = Buffer.alloc(8);
        roundIdBuffer.writeBigUInt64LE(BigInt(roundIdToFetch), 0);

        let [gameRoundPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('game_round'), roundIdBuffer],
          program.programId
        );

        gameRoundPDA = gameRoundPda.toString();

        try {
          gameRound = await program.account.gameRound.fetch(gameRoundPda);
          gameExists = true;
        } catch (err) {
          console.warn(`Game round ${roundIdToFetch} not found, trying previous round...`);

          // Try previous round (counter - 1) if current doesn't exist
          if (roundIdToFetch > 0) {
            roundIdToFetch = roundIdToFetch - 1;
            roundIdBuffer = Buffer.alloc(8);
            roundIdBuffer.writeBigUInt64LE(BigInt(roundIdToFetch), 0);

            [gameRoundPda] = PublicKey.findProgramAddressSync(
              [Buffer.from('game_round'), roundIdBuffer],
              program.programId
            );

            gameRoundPDA = gameRoundPda.toString();

            try {
              gameRound = await program.account.gameRound.fetch(gameRoundPda);
              gameExists = true;
              console.log(`Found previous round: ${roundIdToFetch}`);
            } catch (err2) {
              console.warn(`Previous round ${roundIdToFetch} also not found`);
              gameExists = false;
            }
          } else {
            gameExists = false;
          }
        }
      }

      // Get vault balance
      let vault = null;
      try {
        const vaultInfo = await connection.getAccountInfo(vaultPda);
        vault = {
          balance: (vaultInfo?.lamports || 0) / 1e9,
          address: vaultPda.toString(),
        };
      } catch (err) {
        console.warn('Vault info not found:', err);
      }

      setState({
        connected: true,
        rpcEndpoint: rpcUrl,
        programId: program.programId.toString(),
        gameConfig,
        gameCounter,
        gameRound,
        vault,
        currentRoundId,
        gameRoundPDA,
        gameExists,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to fetch blockchain state:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to fetch blockchain state',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBlockchainState();
  }, [fetchBlockchainState]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBlockchainState();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchBlockchainState]);

  return {
    ...state,
    refresh: fetchBlockchainState,
  };
}
