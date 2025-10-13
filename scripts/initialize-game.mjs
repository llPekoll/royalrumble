#!/usr/bin/env node
/**
 * Initialize Game Script (ES Module version)
 * 
 * This script initializes the Domin8 game program by calling the initialize method.
 * It sets up the game configuration and game round accounts.
 * 
 * Usage:
 *   node scripts/initialize-game.mjs
 *   or
 *   npm run script:initialize:mjs
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import readline from "readline";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

async function initializeGame() {
  console.log("🚀 Starting Domin8 Game Initialization...\n");

  try {
    // Configure the client to use the local cluster
    console.log("🔧 Setting up Anchor provider...");
    anchor.setProvider(anchor.AnchorProvider.env());

    // Load the IDL manually since workspace might not work in ES modules
    console.log("📄 Loading program IDL...");
    const idlPath = join(projectRoot, "target", "idl", "domin8_prgm.json");
    const idl = JSON.parse(readFileSync(idlPath, "utf8"));
    
    const provider = anchor.getProvider();
    const programId = new PublicKey(idl.address || "CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK");
    const program = new anchor.Program(idl, provider);
    
    // Test connection
    console.log("🌐 Testing connection to Solana cluster...");
    const version = await provider.connection.getVersion();
    console.log(`✅ Connected to Solana cluster (version: ${version["solana-core"]})`);
    
    console.log("📋 Configuration:");
    console.log(`Program ID: ${programId.toString()}`);
    console.log(`RPC Endpoint: ${provider.connection.rpcEndpoint}`);
    console.log(`Authority: ${provider.wallet?.publicKey?.toString()}\n`);

    // Game authority - use provider wallet (should be funded)
    const authority = provider.wallet.payer;
    
    // Create or use existing treasury keypair
    // For production, you might want to use a specific treasury address
    const treasury = Keypair.generate();
    console.log(`Treasury: ${treasury.publicKey.toString()}`);
    
    // Fund treasury with some SOL for testing
    console.log("💰 Funding treasury account...");
    const treasurySignature = await provider.connection.requestAirdrop(
      treasury.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(treasurySignature);
    console.log("✅ Treasury funded with 1 SOL\n");
    
    // Derive PDAs (these should match the seeds in your Rust program)
    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_config")],
      programId
    );
    
    const [gameRoundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_round")],
      programId
    );
    
    const [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      programId
    );
    
    console.log("🔑 Program Derived Addresses (PDAs):");
    console.log(`Config PDA: ${configPDA.toString()}`);
    console.log(`Game Round PDA: ${gameRoundPDA.toString()}`);
    console.log(`Vault PDA: ${vaultPDA.toString()}\n`);
    
    // Check if already initialized
    try {
      const existingConfig = await program.account.gameConfig.fetch(configPDA);
      console.log("⚠️  Game appears to already be initialized!");
      console.log(`Current authority: ${existingConfig.authority.toString()}`);
      console.log(`Current treasury: ${existingConfig.treasury.toString()}`);
      console.log(`House fee: ${existingConfig.houseFeeBasisPoints} basis points`);
      console.log(`Min bet: ${existingConfig.minBetLamports.toNumber() / LAMPORTS_PER_SOL} SOL\n`);
      
      const userInput = await promptUser("Do you want to reinitialize? This will fail if accounts exist. (y/N): ");
      if (userInput.toLowerCase() !== 'y' && userInput.toLowerCase() !== 'yes') {
        console.log("❌ Initialization cancelled by user");
        return;
      }
    } catch (error) {
      // Account doesn't exist yet, which is expected for first initialization
      console.log("✅ No existing configuration found, proceeding with initialization...\n");
    }
    
    // Initialize the game
    console.log("🎮 Calling initialize instruction...");
    const signature = await program.methods
      .initialize(treasury.publicKey)
      .rpc();
    
    console.log(`✅ Transaction successful! Signature: ${signature}\n`);
    
    // Fetch and display the initialized configuration
    const gameConfig = await program.account.gameConfig.fetch(configPDA);
    const gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    
    console.log("📊 Game Configuration Initialized:");
    console.log(`Authority: ${gameConfig.authority.toString()}`);
    console.log(`Treasury: ${gameConfig.treasury.toString()}`);
    console.log(`House Fee: ${gameConfig.houseFeeBasisPoints} basis points (${gameConfig.houseFeeBasisPoints / 100}%)`);
    console.log(`Min Bet: ${gameConfig.minBetLamports.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`Small Game Waiting Duration: ${gameConfig.smallGameDurationConfig.waitingPhaseDuration} seconds\n`);
    
    console.log("🎯 Initial Game Round State:");
    console.log(`Round ID: ${gameRound.roundId}`);
    console.log(`Status: ${Object.keys(gameRound.status)[0]}`);
    console.log(`Players: ${gameRound.bets.length}`);
    console.log(`Initial Pot: ${gameRound.initialPot.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`VRF Request: ${gameRound.vrfRequestPubkey.toString()}`);
    console.log(`Randomness Fulfilled: ${gameRound.randomnessFulfilled}\n`);
    
    console.log("🎉 Game initialization completed successfully!");
    console.log("The game is now ready for players to join and place bets.");
    
  } catch (error) {
    console.error("❌ Initialization failed:");
    
    if (error.message?.includes("Connection refused") || error.code === "ECONNREFUSED") {
      console.error("🔌 Connection Error: Cannot connect to Solana cluster");
      console.error("💡 Possible solutions:");
      console.error("   1. Start a local validator: solana-test-validator");
      console.error("   2. Change cluster in Anchor.toml to 'devnet' or 'mainnet'");
      console.error("   3. Check your internet connection for devnet/mainnet");
    } else if (error.message?.includes("Insufficient funds")) {
      console.error("💰 Funding Error: Authority wallet needs SOL for transaction fees");
      console.error("💡 Solution: Fund your wallet or request an airdrop");
    } else {
      console.error("📝 Error details:", error.message);
      console.error("🔍 Full error:", error);
    }
    
    process.exit(1);
  }
}

// Helper function to prompt user input
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeGame()
    .then(() => {
      console.log("\n✨ Script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}

export { initializeGame };