import * as anchor from "@coral-xyz/anchor";
import { Orao } from "@orao-network/solana-vrf";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const vrf = new Orao(provider as any);

  console.log("VRF Program ID:", vrf.programId.toString());

  const networkState = await vrf.getNetworkState();

  console.log("\n=== ORAO VRF Network State ===");
  console.log("Authority:", networkState.config.authority.toString());
  console.log("Treasury:", networkState.config.treasury.toString());
  console.log("Request Fee (lamports):", networkState.config.requestFee.toString());
  console.log("Request Fee (SOL):", networkState.config.requestFee.toNumber() / 1e9);
  console.log("Fulfillment Authorities:", networkState.config.fulfillmentAuthorities.length);

  if (networkState.config.tokenFeeConfig) {
    console.log("\nToken Fee Config:");
    console.log("Mint:", networkState.config.tokenFeeConfig.mint.toString());
    console.log("Treasury:", networkState.config.tokenFeeConfig.treasury.toString());
    console.log("Fee:", networkState.config.tokenFeeConfig.fee.toString());
  } else {
    console.log("\nNo token fee config (SOL only)");
  }
}

main().catch(console.error);
