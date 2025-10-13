#!/usr/bin/env ts-node
/**
 * Initialize Game Script
 * 
 * This script initializes the Domin8 game program by calling the initialize method.
 * It sets up the game configuration and game round accounts.
 * 
 * Usage:
 *   npm run script:initialize
 *   or
 *   npx ts-node scripts/initialize-game.ts
 *   or
 *   bun run scripts/initialize-game.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Domin8Prgm } from "../target/types/domin8_prgm";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function initializeGame() {
  console.log("🚀 Starting Domin8 Game Initialization...\n");

  try {
    // Configure the client to use the local cluster
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Domin8Prgm as Program<Domin8Prgm>;
    const provider = anchor.getProvider();
    
    console.log("📋 Configuration:");
    console.log(`Program ID: ${program.programId.toString()}`);
    console.log(`RPC Endpoint: ${provider.connection.rpcEndpoint}`);
    console.log(`Authority: ${provider.wallet?.publicKey.toString()}\n`);

    // Game authority - use provider wallet (should be funded)
    const authority = (provider.wallet as anchor.Wallet).payer;
    
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
    console.error(error);
    process.exit(1);
  }
}

// Helper function to prompt user input
function promptUser(question: string): Promise<string> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Run the script
if (require.main === module) {
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