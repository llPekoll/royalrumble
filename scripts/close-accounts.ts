/**
 * Close Config and Counter Accounts
 *
 * Closes the existing config and counter accounts so we can reinitialize
 * with a fresh random force field.
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

  // Check balances before closing
  const configInfo = await provider.connection.getAccountInfo(gameConfigPda);
  const counterInfo = await provider.connection.getAccountInfo(gameCounterPda);

  if (configInfo) {
    console.log("\nConfig account lamports:", configInfo.lamports);
  }
  if (counterInfo) {
    console.log("Counter account lamports:", counterInfo.lamports);
  }

  // Close accounts by transferring lamports to authority
  // This requires the accounts to be owned by the program
  // Since they're PDAs, we need to use a program instruction to close them

  console.log("\n⚠ These accounts are PDAs owned by the program");
  console.log("⚠ They can only be closed via a program instruction");
  console.log("\nWe need to use cleanup_old_game instruction or add a close instruction");
  console.log("Alternatively, use solana-test-validator reset for clean slate");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
