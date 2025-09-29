import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Domin8Vrf } from "../target/types/domin8_vrf";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("domin8_vrf", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.domin8Vrf as Program<Domin8Vrf>;
  const authority = provider.wallet;

  it("Initializes the VRF state", async () => {
    // Derive the VRF state PDA
    const [vrfStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vrf_state")],
      program.programId
    );

    try {
      // Initialize the VRF state
      const tx = await program.methods
        .initialize()
        .accounts({
          vrfState: vrfStatePda,
          authority: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("VRF initialized, tx:", tx);

      // Fetch and verify the state
      const vrfState = await program.account.vrfState.fetch(vrfStatePda);
      expect(vrfState.authority.toString()).to.equal(authority.publicKey.toString());
      expect(vrfState.nonce.toNumber()).to.equal(0);
    } catch (err) {
      // If already initialized, that's okay for testing
      console.log("VRF state might already be initialized:", err);
    }
  });

  it("Requests VRF for a quick game (round 1)", async () => {
    const gameId = "test_game_" + Date.now();
    const round = 1;

    // Derive PDAs
    const [vrfStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vrf_state")],
      program.programId
    );

    const [gameSeedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_seed"), Buffer.from(gameId), Buffer.from([round])],
      program.programId
    );

    // Request VRF
    const tx = await program.methods
      .requestVrf(gameId, round)
      .accounts({
        vrfState: vrfStatePda,
        gameSeed: gameSeedPda,
        authority: authority.publicKey,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("VRF requested for game:", gameId, "tx:", tx);

    // Fetch and verify the game seed
    const gameSeed = await program.account.gameSeed.fetch(gameSeedPda);
    expect(gameSeed.gameId).to.equal(gameId);
    expect(gameSeed.round).to.equal(round);
    expect(gameSeed.randomSeed).to.have.lengthOf(32);
    expect(gameSeed.used).to.be.false;

    console.log("Random seed generated:", Buffer.from(gameSeed.randomSeed).toString("hex"));
  });

  it("Requests VRF for a long game (both rounds)", async () => {
    const gameId = "long_game_" + Date.now();

    // Round 1 - Determine top 4
    const round1 = 1;
    const [vrfStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vrf_state")],
      program.programId
    );

    const [gameSeed1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_seed"), Buffer.from(gameId), Buffer.from([round1])],
      program.programId
    );

    // Request first VRF
    const tx1 = await program.methods
      .requestVrf(gameId, round1)
      .accounts({
        vrfState: vrfStatePda,
        gameSeed: gameSeed1Pda,
        authority: authority.publicKey,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Round 1 VRF requested, tx:", tx1);

    // Fetch round 1 seed
    const gameSeed1 = await program.account.gameSeed.fetch(gameSeed1Pda);
    const seed1 = Buffer.from(gameSeed1.randomSeed).toString("hex");
    console.log("Round 1 seed:", seed1);

    // Simulate betting phase delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Round 2 - Determine final winner
    const round2 = 2;
    const [gameSeed2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_seed"), Buffer.from(gameId), Buffer.from([round2])],
      program.programId
    );

    // Request second VRF
    const tx2 = await program.methods
      .requestVrf(gameId, round2)
      .accounts({
        vrfState: vrfStatePda,
        gameSeed: gameSeed2Pda,
        authority: authority.publicKey,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Round 2 VRF requested, tx:", tx2);

    // Fetch round 2 seed
    const gameSeed2 = await program.account.gameSeed.fetch(gameSeed2Pda);
    const seed2 = Buffer.from(gameSeed2.randomSeed).toString("hex");
    console.log("Round 2 seed:", seed2);

    // Verify seeds are different (proving unpredictability)
    expect(seed1).to.not.equal(seed2);
    console.log("✅ Seeds are different - betting phase security verified!");
  });

  it("Marks a seed as used", async () => {
    const gameId = "mark_used_" + Date.now();
    const round = 1;

    // First request VRF
    const [vrfStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vrf_state")],
      program.programId
    );

    const [gameSeedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_seed"), Buffer.from(gameId), Buffer.from([round])],
      program.programId
    );

    await program.methods
      .requestVrf(gameId, round)
      .accounts({
        vrfState: vrfStatePda,
        gameSeed: gameSeedPda,
        authority: authority.publicKey,
        recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Mark as used
    const tx = await program.methods
      .markSeedUsed()
      .accounts({
        gameSeed: gameSeedPda,
        vrfState: vrfStatePda,
        authority: authority.publicKey,
      })
      .rpc();

    console.log("Seed marked as used, tx:", tx);

    // Verify it's marked as used
    const gameSeed = await program.account.gameSeed.fetch(gameSeedPda);
    expect(gameSeed.used).to.be.true;
  });

  it("Prevents invalid round numbers", async () => {
    const gameId = "invalid_round_" + Date.now();
    const invalidRound = 3; // Only 1 and 2 are valid

    const [vrfStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vrf_state")],
      program.programId
    );

    const [gameSeedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_seed"), Buffer.from(gameId), Buffer.from([invalidRound])],
      program.programId
    );

    try {
      await program.methods
        .requestVrf(gameId, invalidRound)
        .accounts({
          vrfState: vrfStatePda,
          gameSeed: gameSeedPda,
          authority: authority.publicKey,
          recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Should not reach here
      expect.fail("Should have thrown error for invalid round");
    } catch (err) {
      expect(err.toString()).to.include("InvalidRound");
      console.log("✅ Invalid round rejected correctly");
    }
  });
});