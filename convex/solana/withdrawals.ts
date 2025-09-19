import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";

// Real withdrawal processing using Solana transactions
export async function processWithdrawal(transaction: any): Promise<{success: boolean, signature?: string}> {
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