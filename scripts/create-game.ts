/**
 * Create a new game round with the first bet
 * This calls the create_game instruction with ORAO VRF
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { networkStateAccountAddress, randomnessAccountAddress } from "@orao-network/solana-vrf";
import { BN } from "bn.js";

const { Program } = anchor;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IDL = JSON.parse(readFileSync(join(__dirname, "../convex/lib/domin8_prgm.json"), "utf-8"));
const PROGRAM_ID = new PublicKey(IDL.address);
const ORAO_VRF_PROGRAM_ID = new PublicKey("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");

async function main() {
  console.log("🎮 Creating New Game Round");
  console.log("==========================================\n");

  // Configure provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(IDL as any, provider);

  console.log("Program ID:", program.programId.toString());
  console.log("Player:", provider.wallet.publicKey.toString());
  console.log("Network:", provider.connection.rpcEndpoint);
  console.log("");

  // Derive PDAs
  const [gameConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    program.programId
  );

  const [gameCounter] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_counter")],
    program.programId
  );

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
  );

  // Fetch current round ID
  const counterAccount = await program.account.gameCounter.fetch(gameCounter);
  const roundId = Number(counterAccount.currentRoundId);

  console.log("📍 Current Round ID:", roundId);

  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId), 0);

  const [gameRound] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_round"), roundIdBuffer],
    program.programId
  );

  // First bet entry (bet_index = 0)
  const [betEntry] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), roundIdBuffer, Buffer.from([0, 0, 0, 0])],
    program.programId
  );

  console.log("📍 Game Round PDA:", gameRound.toString());
  console.log("📍 Bet Entry PDA:", betEntry.toString());
  console.log("");

  // Check if game already exists
  const existingGame = await provider.connection.getAccountInfo(gameRound);
  if (existingGame) {
    console.log("⚠️  Game already exists for round", roundId);
    console.log("Use place_bet instruction to join the game");
    return;
  }

  // Get VRF accounts
  const configAccount = await program.account.gameConfig.fetch(gameConfig);
  const force = Buffer.from(configAccount.force);

  const networkState = networkStateAccountAddress();
  const vrfRequest = randomnessAccountAddress(force);

  // Get treasury from network state
  const networkStateInfo = await provider.connection.getAccountInfo(networkState);
  if (!networkStateInfo) {
    throw new Error("ORAO VRF network state not found");
  }
  const treasury = new PublicKey(networkStateInfo.data.slice(40, 72));

  console.log("🎲 ORAO VRF:");
  console.log("  Network State:", networkState.toString());
  console.log("  VRF Request:", vrfRequest.toString());
  console.log("  Treasury:", treasury.toString());
  console.log("  Force (first 16 bytes):", force.slice(0, 16).toString("hex"));
  console.log("");

  // Bet amount
  const betAmount = new BN(10_000_000); // 0.01 SOL (minimum)
  console.log("💰 Bet Amount:", betAmount.toNumber() / 1e9, "SOL");
  console.log("");

  console.log("🚀 Calling create_game instruction...");

  try {
    const tx = await program.methods
      .createGame(betAmount)
      .accounts({
        config: gameConfig,
        counter: gameCounter,
        gameRound: gameRound,
        betEntry: betEntry,
        vault: vault,
        player: provider.wallet.publicKey,
        vrfProgram: ORAO_VRF_PROGRAM_ID,
        networkState: networkState,
        treasury: treasury,
        vrfRequest: vrfRequest,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Game created!");
    console.log("   Transaction:", tx);
    console.log("");

    // Wait for confirmation
    await provider.connection.confirmTransaction(tx, "confirmed");
    console.log("✅ Transaction confirmed!");
    console.log("");

    // Fetch game state
    const gameRoundAccount = await program.account.gameRound.fetch(gameRound);
    console.log("📋 Game State:");
    console.log("   Round ID:", Number(gameRoundAccount.roundId));
    console.log("   Status:", Object.keys(gameRoundAccount.status)[0]);
    console.log("   Total Pot:", gameRoundAccount.totalPot.toNumber() / 1e9, "SOL");
    console.log("   Bet Count:", gameRoundAccount.betCount);
    console.log("   Start Time:", new Date(Number(gameRoundAccount.startTimestamp) * 1000).toISOString());
    console.log("   End Time:", new Date(Number(gameRoundAccount.endTimestamp) * 1000).toISOString());
    console.log("");

    console.log("🎉 Game is ready! Other players can now call place_bet to join.");
  } catch (error: any) {
    console.error("❌ Error:", error);
    if (error.logs) {
      console.error("\nProgram Logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
