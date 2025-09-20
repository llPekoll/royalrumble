import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";

// Get house wallet address
export const getHouseWallet = query({
  args: {},
  handler: async () => {
    const houseWallet = process.env.HOUSE_WALLET;
    if (!houseWallet) {
      throw new Error("House wallet not configured");
    }
    return { address: houseWallet };
  },
});

// Initiate a deposit transaction
export const initiateDeposit = mutation({
  args: {
    walletAddress: v.string(),
    solAmount: v.number()
  },
  handler: async (ctx, args) => {
    const houseWallet = process.env.HOUSE_WALLET;
    if (!houseWallet) {
      throw new Error("House wallet not configured");
    }

    // Ensure player exists
    let player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      const playerId = await ctx.db.insert("players", {
        walletAddress: args.walletAddress,
        gameCoins: 0,
        lastActive: Date.now(),
        characterRerolls: 0,
        totalGamesPlayed: 0,
        totalWins: 0,
        totalEarnings: 0,
      });
      player = await ctx.db.get(playerId);
    }

    // Convert SOL to game coins (1 SOL = 1000 coins)
    const gameCoins = Math.floor(args.solAmount * 1000);

    // Queue the deposit transaction
    const transactionId = await ctx.db.insert("transactionQueue", {
      walletAddress: args.walletAddress,
      amount: gameCoins,
      solAmount: args.solAmount,
      type: "deposit",
      status: "queued",
      queuedAt: Date.now(),
      priority: 1,
    });

    // Note: Game coins will be added when transaction is verified and completed

    return {
      transactionId,
      gameCoins,
      houseWallet,
      message: `Send ${args.solAmount} SOL to ${houseWallet} to complete deposit`
    };
  },
});

// Initiate a withdrawal transaction
export const initiateWithdrawal = mutation({
  args: {
    walletAddress: v.string(),
    gameCoins: v.number()
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    if (player.gameCoins < args.gameCoins) {
      throw new Error("Insufficient game coins");
    }

    // Convert game coins to SOL (1000 coins = 1 SOL)
    const solAmount = args.gameCoins / 1000;

    // Queue the withdrawal transaction
    const transactionId = await ctx.db.insert("transactionQueue", {
      walletAddress: args.walletAddress,
      amount: args.gameCoins,
      solAmount: solAmount,
      type: "withdrawal",
      status: "queued",
      queuedAt: Date.now(),
      priority: 2, // Higher priority for withdrawals
    });

    // Deduct from game coins immediately
    await ctx.db.patch(player._id, {
      gameCoins: player.gameCoins - args.gameCoins,
    });

    return {
      transactionId,
      solAmount,
      message: `Withdrawal of ${args.gameCoins} coins (${solAmount} SOL) queued for processing`
    };
  },
});

// Real transaction verification using Solana RPC
async function verifyDepositTransaction(transaction: any): Promise<{ success: boolean, signature?: string }> {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, 'confirmed');
    const houseWallet = process.env.HOUSE_WALLET;

    if (!houseWallet) {
      console.error("HOUSE_WALLET environment variable not set");
      return { success: false };
    }

    const housePublicKey = new PublicKey(houseWallet);

    // Check recent transactions to house wallet for matching deposit
    const signatures = await connection.getSignaturesForAddress(housePublicKey, { limit: 50 });

    // Expected SOL amount (convert game coins back to SOL)
    const expectedLamports = Math.floor((transaction.amount / 1000) * LAMPORTS_PER_SOL);

    // Look for recent transactions with matching amount from this wallet
    for (const sig of signatures) {
      try {
        const txDetails = await connection.getTransaction(sig.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });

        if (!txDetails || !txDetails.meta) continue;

        // Check if this transaction is from our user and has the right amount
        const preBalances = txDetails.meta.preBalances;
        const postBalances = txDetails.meta.postBalances;

        // Find the house wallet account index
        const houseIndex = txDetails.transaction.message.staticAccountKeys.findIndex(
          (key: any) => key.equals(housePublicKey)
        );

        if (houseIndex >= 0) {
          const balanceChange = postBalances[houseIndex] - preBalances[houseIndex];

          // Check if the balance change matches expected deposit (within small tolerance)
          if (Math.abs(balanceChange - expectedLamports) < 1000) { // 1000 lamport tolerance
            // Verify the sender is our user
            const fromPubkey = txDetails.transaction.message.staticAccountKeys[0];
            if (fromPubkey && fromPubkey.toString() === transaction.walletAddress) {
              return { success: true, signature: sig.signature };
            }
          }
        }
      } catch (err) {
        console.error("Error checking transaction:", err);
        continue;
      }
    }

    return { success: false };

  } catch (error) {
    console.error("Error verifying deposit transaction:", error);
    return { success: false };
  }
}

// Real withdrawal processing using Solana transactions
async function processWithdrawal(transaction: any): Promise<{ success: boolean, signature?: string }> {
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, 'confirmed');
    const houseWalletPrivateKey = process.env.HOUSE_WALLET_PRIVATE_KEY;

    if (!houseWalletPrivateKey) {
      console.error("HOUSE_WALLET_PRIVATE_KEY environment variable not set");
      return { success: false };
    }

    // Create house wallet keypair from private key
    const houseKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(houseWalletPrivateKey))
    );

    const userPublicKey = new PublicKey(transaction.walletAddress);

    // Convert game coins to lamports (1000 coins = 1 SOL)
    const lamportsToSend = Math.floor((transaction.amount / 1000) * LAMPORTS_PER_SOL);

    // Check house wallet balance
    const houseBalance = await connection.getBalance(houseKeypair.publicKey);

    if (houseBalance < lamportsToSend + 5000) { // 5000 lamports for transaction fee
      console.error("Insufficient house wallet balance for withdrawal");
      return { success: false };
    }

    // Create transfer transaction
    const transferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: houseKeypair.publicKey,
        toPubkey: userPublicKey,
        lamports: lamportsToSend,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transferTransaction.recentBlockhash = blockhash;
    transferTransaction.feePayer = houseKeypair.publicKey;

    // Sign transaction
    transferTransaction.sign(houseKeypair);

    // Send transaction
    const signature = await connection.sendRawTransaction(transferTransaction.serialize());

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      console.error("Transaction failed:", confirmation.value.err);
      return { success: false };
    }

    return { success: true, signature };

  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return { success: false };
  }
}

// Process the transaction queue
export const processTransactionQueue = action({
  args: {},
  handler: async (ctx) => {
    // Get queued transactions
    const queuedTransactions = await ctx.runQuery(api.transactions.getQueuedTransactions as any);

    if (queuedTransactions.length === 0) {
      return { processed: 0, message: "No transactions to process" };
    }

    // Process up to 5 transactions at a time to avoid overwhelming
    const batchSize = Math.min(5, queuedTransactions.length);
    const batch = queuedTransactions.slice(0, batchSize);

    let processed = 0;
    let failed = 0;

    for (const transaction of batch) {
      try {
        // Mark as processing
        await ctx.runMutation(api.transactions.updateTransactionStatus, {
          transactionId: transaction._id,
          status: "processing"
        });

        if (transaction.type === "deposit") {
          // For deposits, we would verify the Solana transaction here
          // For now, we'll simulate verification
          const verified = await verifyDepositTransaction(transaction);

          if (verified.success) {
            await ctx.runMutation(api.transactions.updateTransactionStatus, {
              transactionId: transaction._id,
              status: "completed",
              transactionSignature: verified.signature
            });
            processed++;
          } else {
            await ctx.runMutation(api.transactions.updateTransactionStatus, {
              transactionId: transaction._id,
              status: "failed"
            });
            failed++;
          }
        } else {
          // For withdrawals, we would send SOL to user's wallet
          const withdrawal = await processWithdrawal(transaction);

          if (withdrawal.success) {
            await ctx.runMutation(api.transactions.updateTransactionStatus, {
              transactionId: transaction._id,
              status: "completed",
              transactionSignature: withdrawal.signature
            });
            processed++;
          } else {
            await ctx.runMutation(api.transactions.updateTransactionStatus, {
              transactionId: transaction._id,
              status: "failed"
            });
            failed++;
          }
        }
      } catch (error) {
        console.error(`Failed to process transaction ${transaction._id}:`, error);
        await ctx.runMutation(api.transactions.updateTransactionStatus, {
          transactionId: transaction._id,
          status: "failed"
        });
        failed++;
      }
    }

    return {
      processed,
      failed,
      message: `Processed ${processed} transactions, ${failed} failed`
    };
  },
});
