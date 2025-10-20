import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Domin8Prgm;

  const [gameConfigPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    program.programId
  );

  console.log("Config PDA:", gameConfigPda.toString());

  try {
    const config = await program.account.gameConfig.fetch(gameConfigPda);
    console.log("\nForce field:", Buffer.from(config.force).toString('hex'));
    console.log("Authority:", config.authority.toString());
    console.log("Bets locked:", config.betsLocked);
  } catch (e) {
    console.log("Config doesn't exist");
  }
}

main();
