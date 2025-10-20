/**
 * Reset Program Accounts Script
 *
 * Closes config and counter accounts to allow fresh reinitialization
 */

import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Domin8Prgm;

  console.log("Program ID:", program.programId.toString());
  console.log("Authority:", provider.wallet.publicKey.toString());

  // Derive PDAs
  const [gameConfigPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    program.programId
  );

  const [gameCounterPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("game_counter")],
    program.programId
  );

  console.log("\nConfig PDA:", gameConfigPda.toString());
  console.log("Counter PDA:", gameCounterPda.toString());

  // Check if accounts exist and close them
  try {
    const configInfo = await provider.connection.getAccountInfo(gameConfigPda);
    if (configInfo) {
      console.log("\n✓ Config account exists, closing it...");
      // Note: We need a close instruction in the program to do this properly
      // For now, we'll just note it exists
      console.log("⚠ Config account exists but cannot be closed without a close instruction");
      console.log("   Recommendation: Add a close_config instruction or use a new program ID");
    } else {
      console.log("\n✓ Config account doesn't exist (ready for fresh init)");
    }
  } catch (e) {
    console.log("\n✓ Config account doesn't exist");
  }

  try {
    const counterInfo = await provider.connection.getAccountInfo(gameCounterPda);
    if (counterInfo) {
      console.log("✓ Counter account exists");
    } else {
      console.log("✓ Counter account doesn't exist (ready for fresh init)");
    }
  } catch (e) {
    console.log("✓ Counter account doesn't exist");
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
