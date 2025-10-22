import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import idl from "../../convex/lib/domin8_prgm.json";

export interface BetEntry {
  wallet: string;
  betAmount: number;
  timestamp: number;
}

export interface GameState {
  roundId: number;
  status: "Idle" | "Waiting" | "AwaitingWinnerRandomness" | "Finished";
  startTimestamp: number;
  endTimestamp: number; // ⭐ NEW: When betting closes
  bets: BetEntry[];
  initialPot: number;
  winner: string | null;
  vrfRequestPubkey: string;
  vrfSeed: number[];
  randomnessFulfilled: boolean;
  gameRoundPda: string;
  vaultPda: string;
}

export interface GameConfig {
  authority: string;
  treasury: string;
  houseFeeBasisPoints: number;
  minBetLamports: number;
  vrfFeeLamports: number;
  vrfNetworkState: string;
  vrfTreasury: string;
  gameLocked: boolean; // ⭐ NEW: Is game locked?
}

const PROGRAM_ID = idl.address;
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function fetchGameState() {
      try {
        setLoading(true);
        setError(null);

        // Create connection
        const connection = new Connection(RPC_URL, "confirmed");

        // Create a dummy provider (we only need to read, no wallet needed)
        const provider = new AnchorProvider(
          connection,
          {} as any, // No wallet needed for reads
          { commitment: "confirmed" }
        );

        // Create program instance
        const program = new Program(idl as any, provider);

        // Derive PDAs
        const [gameRoundPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("game_round")],
          new PublicKey(PROGRAM_ID)
        );

        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault")],
          new PublicKey(PROGRAM_ID)
        );

        const [configPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("game_config")],
          new PublicKey(PROGRAM_ID)
        );

        // Fetch game round account
        // Note: Anchor generates PascalCase account names in TypeScript
        const gameRoundAccount = await (program.account as any).gameRound.fetch(gameRoundPda);

        // Fetch game config account
        const gameConfigAccount = await (program.account as any).gameConfig.fetch(configPda);

        // Fetch vault balance
        const vaultAccountInfo = await connection.getAccountInfo(vaultPda);
        const vaultBalanceLamports = vaultAccountInfo?.lamports || 0;

        if (!isSubscribed) return;

        // Parse game state
        const parsedGameState: GameState = {
          roundId: Number(gameRoundAccount.roundId),
          status: Object.keys(gameRoundAccount.status)[0] as any,
          startTimestamp: Number(gameRoundAccount.startTimestamp),
          endTimestamp: Number(gameRoundAccount.endTimestamp), // ⭐ NEW
          bets: gameRoundAccount.bets.map((bet: any) => ({
            wallet: bet.wallet.toString(),
            betAmount: Number(bet.betAmount) / 1_000_000_000, // Convert to SOL
            timestamp: Number(bet.timestamp),
          })),
          initialPot: Number(gameRoundAccount.initialPot) / 1_000_000_000, // Convert to SOL
          winner:
            gameRoundAccount.winner.toString() === PublicKey.default.toString()
              ? null
              : gameRoundAccount.winner.toString(),
          vrfRequestPubkey: gameRoundAccount.vrfRequestPubkey.toString(),
          vrfSeed: Array.from(gameRoundAccount.vrfSeed),
          randomnessFulfilled: gameRoundAccount.randomnessFulfilled,
          gameRoundPda: gameRoundPda.toString(),
          vaultPda: vaultPda.toString(),
        };

        // Parse game config
        const parsedGameConfig: GameConfig = {
          authority: gameConfigAccount.authority.toString(),
          treasury: gameConfigAccount.treasury.toString(),
          houseFeeBasisPoints: gameConfigAccount.houseFeeBasisPoints,
          minBetLamports: Number(gameConfigAccount.minBetLamports) / 1_000_000_000,
          vrfFeeLamports: Number(gameConfigAccount.vrfFeeLamports) / 1_000_000_000,
          vrfNetworkState: gameConfigAccount.vrfNetworkState.toString(),
          vrfTreasury: gameConfigAccount.vrfTreasury.toString(),
          gameLocked: gameConfigAccount.gameLocked, // ⭐ NEW
        };

        setGameState(parsedGameState);
        setGameConfig(parsedGameConfig);
        setVaultBalance(vaultBalanceLamports / 1_000_000_000);
      } catch (err: any) {
        if (!isSubscribed) return;
        console.error("Error fetching game state:", err);
        setError(err.message || "Failed to fetch game state");
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    void fetchGameState();

    // Poll every 3 seconds for updates
    const interval = setInterval(() => void fetchGameState(), 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  return { gameState, gameConfig, vaultBalance, loading, error, refresh: () => setLoading(true) };
}
