import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Domin8Prgm } from "../target/types/domin8_prgm";
import { expect } from "chai";

describe("domin8_prgm - Basic Tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Domin8Prgm as Program<Domin8Prgm>;
  const provider = anchor.getProvider();

  it("Program loads successfully", () => {
    console.log("Program ID:", program.programId.toString());
    expect(program.programId).to.not.be.null;
    expect(program.programId.toString()).to.be.a("string");
  });

  it("Provider is connected", () => {
    console.log("Provider wallet:", provider.wallet.publicKey.toString());
    expect(provider.wallet.publicKey).to.not.be.null;
  });
});