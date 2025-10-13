import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Domin8Prgm } from "../target/types/domin8_prgm";
import { PublicKey, Keypair } from "@solana/web3.js";

/**
 * Script to initialize the Domin8 game program
 *
 * This will:
 * 1. Derive the necessary PDAs (config, game_round, vault)
 * 2. Call the initialize instruction
 * 3. Set up the game configuration with a treasury wallet
 *
 * Usage:
 *   ts-node scripts/initialize.ts
 */

async function main() {
  // Configure the client to use the configured cluster (devnet/localnet)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Domin8Prgm as Program<Domin8Prgm>;

  console.log("🎮 Initializing Domin8 Game Program");
  console.log("==========================================");
  console.log(`Program ID: ${program.programId.toString()}`);
  console.log(`Authority: ${provider.wallet.publicKey.toString()}`);
  console.log(`RPC Endpoint: ${provider.connection.rpcEndpoint}`);
  console.log("");

  // Derive PDAs
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    program.programId
  );

  const [gameRoundPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_round")],
    program.programId
  );

  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
  );

  console.log("📍 PDAs:");
  console.log(`  Config PDA: ${configPDA.toString()}`);
  console.log(`  GameRound PDA: ${gameRoundPDA.toString()}`);
  console.log(`  Vault PDA: ${vaultPDA.toString()}`);
  console.log("");

  // Check if already initialized
  try {
    const existingConfig = await program.account.gameConfig.fetch(configPDA);
    console.log("⚠️  Program is already initialized!");
    console.log(`  Treasury: ${existingConfig.treasury.toString()}`);
    console.log(`  Authority: ${existingConfig.authority.toString()}`);
    console.log(`  House Fee: ${existingConfig.houseFeeBasisPoints} basis points`);
    console.log("");
    console.log("If you want to reinitialize, you need to:");
    console.log("  1. Close the existing accounts");
    console.log("  2. Or deploy a new program with a different ID");
    return;
  } catch (error) {
    // Not initialized yet, which is good
    console.log("✅ Program not yet initialized - proceeding...");
    console.log("");
  }

  // Option 1: Use the wallet's public key as treasury
  const treasuryWallet = provider.wallet.publicKey;

  // Option 2: Generate a new treasury wallet (uncomment if preferred)
  // const treasuryKeypair = Keypair.generate();
  // const treasuryWallet = treasuryKeypair.publicKey;
  // console.log("⚠️  Save this treasury keypair:");
  // console.log(`  Public Key: ${treasuryWallet.toString()}`);
  // console.log(`  Secret Key: [${Array.from(treasuryKeypair.secretKey)}]`);
  // console.log("");

  console.log("💰 Treasury Configuration:");
  console.log(`  Treasury: ${treasuryWallet.toString()}`);
  console.log("");

  // Initialize the program
  console.log("🚀 Sending initialize transaction...");

  try {
    const txSignature = await program.methods
      .initialize(treasuryWallet)
      .rpc();

    console.log("✅ Program initialized successfully!");
    console.log(`  Transaction: ${txSignature}`);
    console.log("");

    // Fetch and display the configuration
    const gameConfig = await program.account.gameConfig.fetch(configPDA);
    const gameRound = await program.account.gameRound.fetch(gameRoundPDA);

    console.log("📋 Game Configuration:");
    console.log(`  Authority: ${gameConfig.authority.toString()}`);
    console.log(`  Treasury: ${gameConfig.treasury.toString()}`);
    console.log(`  House Fee: ${gameConfig.houseFeeBasisPoints} basis points (${gameConfig.houseFeeBasisPoints / 100}%)`);
    console.log(`  Min Bet: ${gameConfig.minBetLamports.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`  Waiting Phase Duration: ${gameConfig.smallGameDurationConfig.waitingPhaseDuration} seconds`);
    console.log("");

    console.log("📋 Initial Game Round State:");
    console.log(`  Round ID: ${gameRound.roundId.toString()}`);
    console.log(`  Status: ${Object.keys(gameRound.status)[0]}`);
    console.log(`  Players: ${gameRound.players.length}`);
    console.log(`  Initial Pot: ${gameRound.initialPot.toNumber() / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log("");

    console.log("🎉 Initialization complete! Your game is ready to accept bets.");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Run the tests: anchor test");
    console.log("  2. Start your frontend: bun run dev");
    console.log("  3. Players can now deposit bets and play!");

  } catch (error: any) {
    console.error("❌ Initialization failed:");
    console.error(error);

    if (error.error) {
      console.error("Error code:", error.error.errorCode?.code);
      console.error("Error message:", error.error.errorMessage);
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
