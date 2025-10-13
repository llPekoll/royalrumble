#!/usr/bin/env node
/**
 * Initialize Game Script (Standalone version)
 * 
 * This script initializes the Domin8 game program by calling the initialize method.
 * This version doesn't rely on Anchor workspace and manually configures everything.
 * 
 * Usage:
 *   node scripts/initialize-standalone.mjs [--cluster=devnet|mainnet|localnet]
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from "@solana/web3.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import readline from "readline";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Parse command line arguments
const args = process.argv.slice(2);
const clusterArg = args.find(arg => arg.startsWith('--cluster='))?.split('=')[1] || 'localnet';

function getConnection(cluster) {
  switch (cluster) {
    case 'devnet':
      return new Connection(clusterApiUrl('devnet'), 'confirmed');
    case 'mainnet':
    case 'mainnet-beta':
      return new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
    case 'localnet':
    default:
      return new Connection('http://127.0.0.1:8899', 'confirmed');
  }
}

function getWallet() {
  // Try to load the default Solana wallet
  const walletPath = process.env.HOME ? 
    join(process.env.HOME, '.config', 'solana', 'id.json') :
    join(process.env.USERPROFILE || '', '.config', 'solana', 'id.json');
  
  try {
    const secretKey = JSON.parse(readFileSync(walletPath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch (error) {
    console.log("⚠️  Could not load default Solana wallet, generating a new one for this session...");
    return Keypair.generate();
  }
}

async function initializeGame() {
  console.log("🚀 Starting Domin8 Game Initialization (Standalone)...\n");

  try {
    console.log(`📡 Connecting to ${clusterArg} cluster...`);
    const connection = getConnection(clusterArg);
    
    // Test connection with timeout
    const connectionPromise = connection.getVersion();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );
    
    const version = await Promise.race([connectionPromise, timeoutPromise]);
    console.log(`✅ Connected to Solana cluster (version: ${version["solana-core"]})`);

    // Setup wallet
    console.log("🔑 Setting up wallet...");
    const wallet = getWallet();
    console.log(`Wallet: ${wallet.publicKey.toString()}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance === 0 && clusterArg === 'localnet') {
      console.log("💰 Requesting airdrop for localnet...");
      const airdropSig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdropSig);
      console.log("✅ Airdrop completed");
    } else if (balance < LAMPORTS_PER_SOL * 0.01) {
      console.log("⚠️  Warning: Low wallet balance. You may need more SOL for transaction fees.");
    }

    // Load the IDL
    console.log("📄 Loading program IDL...");
    const idlPath = join(projectRoot, "target", "idl", "domin8_prgm.json");
    const idl = JSON.parse(readFileSync(idlPath, "utf8"));
    
    // Setup provider and program
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(wallet),
      { commitment: 'confirmed' }
    );
    
    const programId = new PublicKey(idl.address || "CsCFNMvVnp8Mm1ijHJd7HvKHDB8TPQ9eKv2dptMpiXfK");
    const program = new anchor.Program(idl, provider);
    
    console.log("📋 Configuration:");
    console.log(`Program ID: ${programId.toString()}`);
    console.log(`RPC Endpoint: ${connection.rpcEndpoint}`);
    console.log(`Authority: ${wallet.publicKey.toString()}\n`);

    // Create treasury keypair
    const treasury = Keypair.generate();
    console.log(`Treasury: ${treasury.publicKey.toString()}`);
    
    // Fund treasury with some SOL for testing
    if (clusterArg === 'localnet') {
      console.log("💰 Funding treasury account...");
      const treasurySignature = await connection.requestAirdrop(
        treasury.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(treasurySignature);
      console.log("✅ Treasury funded with 1 SOL\n");
    } else {
      console.log("💡 Note: Treasury not funded automatically on non-localnet clusters\n");
    }
    
    // Derive PDAs
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
      if (error.message?.includes("Account does not exist")) {
        console.log("✅ No existing configuration found, proceeding with initialization...\n");
      } else {
        throw error; // Re-throw if it's a different error
      }
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
    
    if (error.message === 'Connection timeout' || error.message?.includes("Connection refused") || error.code === "ECONNREFUSED") {
      console.error("🔌 Connection Error: Cannot connect to Solana cluster");
      console.error("💡 Possible solutions:");
      console.error("   1. For localnet: Start local validator with 'solana-test-validator'");
      console.error("   2. For devnet: Check internet connection and try again");
      console.error("   3. Use different cluster: node scripts/initialize-standalone.mjs --cluster=devnet");
    } else if (error.message?.includes("Insufficient funds")) {
      console.error("💰 Funding Error: Authority wallet needs SOL for transaction fees");
      console.error("💡 Solution: Fund your wallet or request an airdrop");
    } else if (error.message?.includes("Account already exists")) {
      console.error("🔄 The game has already been initialized on this cluster");
      console.error("💡 Use a fresh cluster or reset the existing state");
    } else {
      console.error("📝 Error details:", error.message);
      if (process.env.DEBUG) {
        console.error("🔍 Full error:", error);
      }
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

// Show usage if help is requested
if (args.includes('--help') || args.includes('-h')) {
  console.log("Usage: node scripts/initialize-standalone.mjs [options]");
  console.log("");
  console.log("Options:");
  console.log("  --cluster=<cluster>  Specify Solana cluster (localnet, devnet, mainnet)");
  console.log("  --help, -h          Show this help message");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/initialize-standalone.mjs");
  console.log("  node scripts/initialize-standalone.mjs --cluster=devnet");
  console.log("  node scripts/initialize-standalone.mjs --cluster=mainnet");
  process.exit(0);
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