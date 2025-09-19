import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { verifyDepositTransaction } from "./verification";
import { processWithdrawal } from "./withdrawals";

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