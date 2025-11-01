import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Domin8Prgm } from "../target/types/domin8_prgm";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("domin8_prgm - Security Robustness", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Domin8Prgm as Program<Domin8Prgm>;
  const provider = anchor.getProvider();

  const authority = (provider.wallet as anchor.Wallet).payer;
  const maliciousCrank = Keypair.generate();
  const treasuryFallback = Keypair.generate();

  let treasuryPubkey: PublicKey;
  let playerOne: Keypair;
  let playerTwo: Keypair;

  let configPDA: PublicKey;
  let gameRoundPDA: PublicKey;

  const airdrop = async (pubkey: PublicKey, solAmount = 1) => {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      solAmount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  };

  const waitForSlots = async (targetSlot: number, timeoutMs = 20000) => {
    const start = Date.now();
    // Poll the cluster until we have reached or surpassed the target slot
    while (Date.now() - start < timeoutMs) {
      const currentSlot = await provider.connection.getSlot();
      if (currentSlot >= targetSlot) {
        return currentSlot;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for slot ${targetSlot}`);
  };

  before(async () => {
    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_config")],
      program.programId
    );
    [gameRoundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_round")],
      program.programId
    );
    // Attempt to fetch existing config to determine if initialization already occurred
    let gameConfig;
    try {
      gameConfig = await program.account.gameConfig.fetch(configPDA);
      treasuryPubkey = gameConfig.treasury;
    } catch (error) {
      // Initialize if not yet created
      treasuryPubkey = treasuryFallback.publicKey;
      await program.methods
        .initialize(treasuryPubkey)
        .rpc();
      gameConfig = await program.account.gameConfig.fetch(configPDA);
    }

    // Ensure treasury address (either existing or fallback) is funded for fee collection
    await airdrop(treasuryPubkey, 1);
    await airdrop(maliciousCrank.publicKey, 1);

    playerOne = Keypair.generate();
    playerTwo = Keypair.generate();

    await airdrop(playerOne.publicKey, 2);
    await airdrop(playerTwo.publicKey, 2);
  });

  it("guards critical instructions against malicious actors", async () => {
    const gameConfig = await program.account.gameConfig.fetch(configPDA);
    const minBetLamports = gameConfig.minBetLamports.toNumber();
    const betAmount = Math.max(minBetLamports, Math.floor(0.2 * LAMPORTS_PER_SOL));

    // Make sure round starts idle
    const initialRound = await program.account.gameRound.fetch(gameRoundPDA);
    const initialStatus = Object.keys(initialRound.status)[0];
    expect(initialStatus).to.equal("idle");

    // Player deposits to enter waiting state
    await program.methods
      .depositBet(new anchor.BN(betAmount))
      .accounts({
        player: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc();

    await program.methods
      .depositBet(new anchor.BN(betAmount))
      .accounts({
        player: playerTwo.publicKey,
      })
      .signers([playerTwo])
      .rpc();

    let gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    expect(Object.keys(gameRound.status)[0]).to.equal("waiting");

    // Unauthorized crank attempt should be rejected
    try {
      await program.methods
        .progressToResolution()
        .accounts({
          crank: maliciousCrank.publicKey,
          vrfAccount: null,
        })
        .signers([maliciousCrank])
        .rpc();
      expect.fail("Unauthorized crank was able to progress the game");
    } catch (error: any) {
      expect(error.error?.errorCode?.code).to.equal("Unauthorized");
    }

    // Authorized crank progresses the game
    await program.methods
      .progressToResolution()
      .accounts({
        crank: authority.publicKey,
        vrfAccount: null,
      })
      .rpc();

    gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    expect(Object.keys(gameRound.status)[0]).to.equal("awaitingWinnerRandomness");

    // Attempt to resolve before commit slot elapsed should fail
    try {
      await program.methods
        .resolveWinner()
        .accounts({
          crank: authority.publicKey,
          vrfAccount: null,
        })
        .rpc();
      expect.fail("Resolution succeeded before commit slot elapsed");
    } catch (error: any) {
      expect(error.error?.errorCode?.code).to.equal("CommitSlotNotElapsed");
    }

    // Wait for commit slot to elapse
    const updatedRound = await program.account.gameRound.fetch(gameRoundPDA);
    const commitSlot = updatedRound.randomnessCommitSlot.toNumber();
    await waitForSlots(commitSlot);

    // Unauthorized crank still cannot resolve
    try {
      await program.methods
        .resolveWinner()
        .accounts({
          crank: maliciousCrank.publicKey,
          vrfAccount: null,
        })
        .signers([maliciousCrank])
        .rpc();
      expect.fail("Unauthorized crank resolved the winner");
    } catch (error: any) {
      expect(error.error?.errorCode?.code).to.equal("Unauthorized");
    }

    // Authorized resolution should now succeed
    await program.methods
      .resolveWinner()
      .accounts({
        crank: authority.publicKey,
        vrfAccount: null,
      })
      .rpc();

    gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    expect(Object.keys(gameRound.status)[0]).to.equal("finished");

    const roundIdForPayout = gameRound.roundId;
    const winnerPubkey = gameRound.winner;

    // Malicious crank cannot distribute winnings
    try {
      await program.methods
        .distributeWinningsAndReset()
        .accounts({
          treasury: treasuryPubkey,
          winner: winnerPubkey,
          crank: maliciousCrank.publicKey,
        })
        .signers([maliciousCrank])
        .rpc();
      expect.fail("Unauthorized crank distributed winnings");
    } catch (error: any) {
      expect(error.error?.errorCode?.code).to.equal("Unauthorized");
    }

    // Authorized distribution succeeds
    await program.methods
      .distributeWinningsAndReset()
      .accounts({
        treasury: treasuryPubkey,
        winner: winnerPubkey,
        crank: authority.publicKey,
      })
      .rpc();

    const postDistributionRound = await program.account.gameRound.fetch(gameRoundPDA);
    expect(Object.keys(postDistributionRound.status)[0]).to.equal("idle");

    // Determine which player won for claim attempts
    const winnerKeypair = winnerPubkey.equals(playerOne.publicKey)
      ? playerOne
      : winnerPubkey.equals(playerTwo.publicKey)
      ? playerTwo
      : null;

    expect(winnerKeypair).to.not.be.null;

    // Winner cannot double-claim
    try {
      await program.methods
        .claimWinnings(roundIdForPayout)
        .accounts({
          claimer: winnerKeypair!.publicKey,
        })
        .signers([winnerKeypair!])
        .rpc();
      expect.fail("Winner was able to claim winnings twice");
    } catch (error: any) {
      expect(error.error?.errorCode?.code).to.equal("AlreadyClaimed");
    }
  });
});
