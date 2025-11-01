import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Domin8Prgm } from "../target/types/domin8_prgm";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("domin8_prgm - Complete Game Workflow", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Domin8Prgm as Program<Domin8Prgm>;
  const provider = anchor.getProvider();
  
  // Game authority (also acts as crank in Phase 3) - use provider wallet
  const authority = (provider.wallet as anchor.Wallet).payer;
  const treasury = Keypair.generate();
  
  // Test players
  let player1: Keypair;
  let player2: Keypair;
  let player3: Keypair;
  
  // PDAs
  let configPDA: PublicKey;
  let gameRoundPDA: PublicKey;
  let vaultPDA: PublicKey;
  
  // Helper function to get SOL balance
  const getBalance = async (pubkey: PublicKey): Promise<number> => {
    const balance = await provider.connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  };

  // Helper function to create and fund a player
  const createPlayer = async (solAmount: number = 1): Promise<Keypair> => {
    const player = Keypair.generate();
    
    // Airdrop SOL to player
    const signature = await provider.connection.requestAirdrop(
      player.publicKey,
      solAmount * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    
    return player;
  };

  before(async () => {
    console.log("Setting up test environment...");
    
    // Fund treasury (authority is already funded as it's the provider wallet)
    const treasurySignature = await provider.connection.requestAirdrop(
      treasury.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(treasurySignature);
    
    // Create test players
    player1 = await createPlayer(2);
    player2 = await createPlayer(2);
    player3 = await createPlayer(2);
    
    // Derive PDAs
    [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_config")],
      program.programId
    );
    
    [gameRoundPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("game_round")],
      program.programId
    );
    
    [vaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );
    
    console.log("Test environment setup complete");
    console.log("Authority:", authority.publicKey.toString());
    console.log("Treasury:", treasury.publicKey.toString());
    console.log("Player 1:", player1.publicKey.toString());
    console.log("Player 2:", player2.publicKey.toString());
    console.log("Player 3:", player3.publicKey.toString());
  });

  it("Complete Game Workflow: Initialize → Players Join → Progress → Resolve → Distribute", async () => {
    console.log("\n=== PHASE 1: Initialize Game ===");
    
    // Initialize the game
    try {
      await program.methods
        .initialize(treasury.publicKey)
        .rpc();
      console.log("✅ Game initialized successfully");
    } catch (error) {
      console.log("Initialization error:", error);
      throw error;
    }
    
    // Get initial game state
    const gameConfig = await program.account.gameConfig.fetch(configPDA);
    const initialGameRound = await program.account.gameRound.fetch(gameRoundPDA);
    
    console.log("Game config treasury:", gameConfig.treasury.toString());
    console.log("Initial game status:", Object.keys(initialGameRound.status)[0]);
    expect(Object.keys(initialGameRound.status)[0]).to.equal("idle");
    
    console.log("\n=== PHASE 2: Players Join Game ===");
    
    // Record initial balances
    const player1InitialBalance = await getBalance(player1.publicKey);
    const player2InitialBalance = await getBalance(player2.publicKey);
    const player3InitialBalance = await getBalance(player3.publicKey);
    const vaultInitialBalance = await getBalance(vaultPDA);
    
    console.log(`Player 1 initial balance: ${player1InitialBalance} SOL`);
    console.log(`Player 2 initial balance: ${player2InitialBalance} SOL`);
    console.log(`Player 3 initial balance: ${player3InitialBalance} SOL`);
    console.log(`Vault initial balance: ${vaultInitialBalance} SOL`);
    
    const betAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL bet
    
    // Player 1 deposits bet (should transition from Idle to Waiting)
    await program.methods
      .depositBet(new anchor.BN(betAmount))
      .accounts({
        player: player1.publicKey,
      })
      .signers([player1])
      .rpc();
    
    console.log("✅ Player 1 deposited bet");
    
    // Check game transitioned to Waiting
    let gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    console.log("Game status after player 1:", Object.keys(gameRound.status)[0]);
    expect(Object.keys(gameRound.status)[0]).to.equal("waiting");
    expect(gameRound.players).to.have.lengthOf(1);
    
    // Player 2 deposits bet
    await program.methods
      .depositBet(new anchor.BN(betAmount))
      .accounts({
        player: player2.publicKey,
      })
      .signers([player2])
      .rpc();
    
    console.log("✅ Player 2 deposited bet");
    
    // Player 3 deposits bet
    await program.methods
      .depositBet(new anchor.BN(betAmount))
      .accounts({
        player: player3.publicKey,
      })
      .signers([player3])
      .rpc();
    
    console.log("✅ Player 3 deposited bet");
    
    // Check all players are registered
    gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    console.log(`Total players: ${gameRound.players.length}`);
    console.log(`Initial pot: ${gameRound.initialPot.toNumber() / LAMPORTS_PER_SOL} SOL`);
    expect(gameRound.players).to.have.lengthOf(3);
    expect(gameRound.initialPot.toNumber()).to.equal(betAmount * 3);
    
    console.log("\n=== PHASE 3: Progress Game to Resolution ===");
    
    // Progress game to resolution phase (crank action)
    await program.methods
      .progressToResolution()
      .accounts({
        vrfAccount: null, // Optional VRF account, not used in Phase 3
      })
      .rpc();
    
    console.log("✅ Game progressed to resolution");
    
    gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    console.log("Game status after progression:", Object.keys(gameRound.status)[0]);
    expect(Object.keys(gameRound.status)[0]).to.equal("awaitingWinnerRandomness");
    
    console.log("\n=== PHASE 4: Resolve Winner ===");
    
    // Wait for commit slot to elapse (security feature)
    console.log("⏳ Waiting for commit slot to elapse...");
    
    // Get current slot and wait for several slots to pass
    const currentSlot = await provider.connection.getSlot();
    console.log(`Current slot: ${currentSlot}`);
    
    // Wait for at least 10 seconds to ensure multiple slots have passed
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const newSlot = await provider.connection.getSlot();
    console.log(`New slot: ${newSlot} (${newSlot - currentSlot} slots elapsed)`);
    
    // Resolve winner using randomness (crank action) with retry
    let resolveAttempts = 0;
    const maxResolveAttempts = 3;
    
    while (resolveAttempts < maxResolveAttempts) {
      try {
        await program.methods
          .resolveWinner()
          .accounts({
            vrfAccount: null, // Optional VRF account, not used in Phase 3
          })
          .rpc();
        break; // Success, exit loop
      } catch (error: any) {
        resolveAttempts++;
        if (error.error?.errorCode?.code === "CommitSlotNotElapsed" && resolveAttempts < maxResolveAttempts) {
          console.log(`⏳ Attempt ${resolveAttempts} failed, waiting 5 more seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          const retrySlot = await provider.connection.getSlot();
          console.log(`Retry slot: ${retrySlot}`);
        } else {
          throw error; // Re-throw if it's not the slot error or we've exhausted attempts
        }
      }
    }
    
    console.log("✅ Winner resolved");
    
    gameRound = await program.account.gameRound.fetch(gameRoundPDA);
    console.log("Game status after resolution:", Object.keys(gameRound.status)[0]);
    console.log("Winner:", gameRound.winner ? gameRound.winner.toString() : "None");
    expect(Object.keys(gameRound.status)[0]).to.equal("finished");
    expect(gameRound.winner).to.not.be.null;
    
    // Determine which player won
    let winnerPlayer: Keypair;
    let nonWinners: Keypair[] = [];
    
    if (gameRound.winner!.equals(player1.publicKey)) {
      winnerPlayer = player1;
      nonWinners = [player2, player3];
      console.log("🏆 Player 1 is the winner!");
    } else if (gameRound.winner!.equals(player2.publicKey)) {
      winnerPlayer = player2;
      nonWinners = [player1, player3];
      console.log("🏆 Player 2 is the winner!");
    } else if (gameRound.winner!.equals(player3.publicKey)) {
      winnerPlayer = player3;
      nonWinners = [player1, player2];
      console.log("🏆 Player 3 is the winner!");
    } else {
      throw new Error("Winner is not one of our test players!");
    }
    
    console.log("\n=== PHASE 5: Distribute Winnings ===");
    
    // Record balances before distribution
    const winnerBalanceBefore = await getBalance(winnerPlayer.publicKey);
    const treasuryBalanceBefore = await getBalance(treasury.publicKey);
    const vaultBalanceBefore = await getBalance(vaultPDA);
    
    console.log(`Winner balance before distribution: ${winnerBalanceBefore} SOL`);
    console.log(`Treasury balance before distribution: ${treasuryBalanceBefore} SOL`);
    console.log(`Vault balance before distribution: ${vaultBalanceBefore} SOL`);
    
    // Derive winnings claim PDA
    const [winningsClaimPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("winnings"), gameRound.roundId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    // Distribute winnings (crank action)
    await program.methods
      .distributeWinningsAndReset()
      .accounts({
        treasury: treasury.publicKey,
        winner: winnerPlayer.publicKey,
      })
      .rpc();
    
    console.log("✅ Winnings distributed and game reset");
    
    // Record balances after distribution
    const winnerBalanceAfter = await getBalance(winnerPlayer.publicKey);
    const treasuryBalanceAfter = await getBalance(treasury.publicKey);
    const vaultBalanceAfter = await getBalance(vaultPDA);
    
    console.log(`Winner balance after distribution: ${winnerBalanceAfter} SOL`);
    console.log(`Treasury balance after distribution: ${treasuryBalanceAfter} SOL`);
    console.log(`Vault balance after distribution: ${vaultBalanceAfter} SOL`);
    
    // Check final game state
    const finalGameRound = await program.account.gameRound.fetch(gameRoundPDA);
    console.log("Final game status:", Object.keys(finalGameRound.status)[0]);
    console.log("Final player count:", finalGameRound.players.length);
    console.log("Final initial pot:", finalGameRound.initialPot.toNumber());
    
    console.log("\n=== ASSERTIONS ===");
    
    // Assert winner received winnings
    const winnerGain = winnerBalanceAfter - winnerBalanceBefore;
    console.log(`Winner gained: ${winnerGain} SOL`);
    expect(winnerGain).to.be.greaterThan(0.2); // Should get most of the 0.3 SOL pot minus house fee
    
    // Assert treasury received house fee
    const treasuryGain = treasuryBalanceAfter - treasuryBalanceBefore;
    console.log(`Treasury gained: ${treasuryGain} SOL`);
    expect(treasuryGain).to.be.greaterThan(0); // Should receive house fee
    
    // Assert vault is empty or nearly empty (only rent-exempt amount)
    console.log(`Vault final balance: ${vaultBalanceAfter} SOL`);
    expect(vaultBalanceAfter).to.be.lessThan(0.01); // Should be mostly empty
    
    // Assert game reset properly
    expect(Object.keys(finalGameRound.status)[0]).to.equal("idle");
    expect(finalGameRound.players).to.have.lengthOf(0);
    expect(finalGameRound.initialPot.toNumber()).to.equal(0);
    // Winner should be null or the system program key (indicating no winner)
    const isWinnerReset = finalGameRound.winner === null || 
                         finalGameRound.winner.equals(anchor.web3.SystemProgram.programId);
    expect(isWinnerReset).to.be.true;
    
    // Check non-winner balances (they should have lost their bets)
    for (const nonWinner of nonWinners) {
      const currentBalance = await getBalance(nonWinner.publicKey);
      let initialBalance: number;
      
      if (nonWinner === player1) initialBalance = player1InitialBalance;
      else if (nonWinner === player2) initialBalance = player2InitialBalance;
      else initialBalance = player3InitialBalance;
      
      const loss = initialBalance - currentBalance;
      console.log(`Non-winner ${nonWinner.publicKey.toString().slice(0, 8)}... lost: ${loss} SOL`);
      expect(loss).to.be.approximately(0.1, 0.01); // Should have lost their bet amount (plus small tx fees)
    }
    
    console.log("\n🎉 Complete game workflow test passed!");
    console.log("✅ Game initialized correctly");
    console.log("✅ Players joined and deposited bets");
    console.log("✅ Game progressed through all phases");
    console.log("✅ Winner was selected and paid correctly");
    console.log("✅ House fee was collected");
    console.log("✅ Non-winners lost their bets");
    console.log("✅ Game reset for next round");
  });
});