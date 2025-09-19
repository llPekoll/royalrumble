import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Real transaction verification using Solana RPC
export async function verifyDepositTransaction(transaction: any): Promise<{success: boolean, signature?: string}> {
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