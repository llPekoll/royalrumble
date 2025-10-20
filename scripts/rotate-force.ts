/**
 * Rotate Force Field Script
 *
 * This script manually rotates the force field in the config account
 * to prevent VRF request account collisions during testing.
 */

import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";

async function main() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Domin8Prgm;

  // Derive config PDA
  const [gameConfigPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    program.programId
  );

  console.log("Program ID:", program.programId.toString());
  console.log("Config PDA:", gameConfigPda.toString());
  console.log("Authority:", provider.wallet.publicKey.toString());

  // Fetch current config
  const configAccount = await program.account.gameConfig.fetch(gameConfigPda);

  console.log("\n=== Current Force Field ===");
  console.log("Force (hex):", Buffer.from(configAccount.force).toString('hex'));
  console.log("Force (first 16 bytes):", configAccount.force.slice(0, 16));

  console.log("\n✓ Force field fetched successfully");
  console.log("\nNOTE: Force field rotates automatically after each game");
  console.log("If you need to manually rotate, add an admin instruction to the program");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
