"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { useMemo, useRef, useState } from "react";

/**
 * Compatibility hook that provides the same interface as @solana/wallet-adapter-react
 * but using Privy underneath. This allows for gradual migration of components.
 */
export function useWalletCompat() {
  const { authenticated, login, logout, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction: privySendTransaction } = useSignAndSendTransaction();
  
  // Loop prevention state
  const signingOperationRef = useRef<string | null>(null);
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);
  
  // Get Solana wallet address with priority for embedded wallets (same logic as WalletAddressDisplay)
  const getSolanaWalletAddress = () => {
    if (!user) return null;
    
    // PRIORITY 1: Check if primary wallet is embedded Solana wallet
    if (user.wallet?.walletClientType === 'privy' && user.wallet?.chainType === 'solana') {
      console.log('✅ Using primary Solana embedded wallet (chainType verified):', {
        address: user.wallet.address,
        walletClientType: user.wallet.walletClientType,
        chainType: user.wallet.chainType
      });
      return user.wallet.address;
    }
    
    // PRIORITY 2: Look for embedded Solana wallet in linkedAccounts
    console.log('🔍 Looking for embedded Solana wallet in linkedAccounts:', user.linkedAccounts);
    const embeddedWallet = user.linkedAccounts?.find(
      account => {
        // Type guard: ensure it's a wallet account with required properties
        return account.type === 'wallet' && 
               'walletClientType' in account &&
               'chainType' in account &&
               'address' in account &&
               account.walletClientType === 'privy' && 
               account.chainType === 'solana';
      }
    );

    if (embeddedWallet && 'address' in embeddedWallet) {
      console.log('✅ Using linked Solana embedded wallet (chainType verified):', {
        address: embeddedWallet.address,
        walletClientType: 'walletClientType' in embeddedWallet ? embeddedWallet.walletClientType : 'unknown',
        chainType: 'chainType' in embeddedWallet ? embeddedWallet.chainType : 'unknown'
      });
      return embeddedWallet.address;
    }
    
    // PRIORITY 3: Fallback to external Solana wallet (primary)
    if (user.wallet?.address && user.wallet?.chainType === 'solana') {
      console.log('⚠️ Using external Solana wallet as fallback (chainType verified):', {
        address: user.wallet.address,
        chainType: user.wallet.chainType
      });
      return user.wallet.address;
    }
    
    // PRIORITY 4: Final fallback - any Solana wallet in linkedAccounts
    const solanaWallet = user.linkedAccounts?.find(
      account => {
        // Type guard: ensure it's a wallet account with Solana chainType
        return account.type === 'wallet' && 
               'chainType' in account &&
               'address' in account &&
               account.chainType === 'solana';
      }
    );
    
    if (solanaWallet && 'address' in solanaWallet) {
      console.log('⚠️ Using any Solana wallet from linkedAccounts (chainType verified):', {
        address: solanaWallet.address,
        chainType: 'chainType' in solanaWallet ? solanaWallet.chainType : 'unknown'
      });
      return solanaWallet.address;
    }
    
    console.error('❌ No Solana wallets found in user account - rejecting all non-Solana wallets');
    
    return null;
  };
  
  const walletAddress = getSolanaWalletAddress();
  
  // Find the corresponding Solana wallet that matches the wallet address (prioritizing embedded)
  const solanaWallet = useMemo(() => {
    if (!walletAddress || !wallets.length) return null;
    
    // In Privy v3, wallets are ConnectedStandardSolanaWallet objects
    // Find wallet that matches our prioritized address
    const matchedWallet = wallets.find(wallet => wallet.address === walletAddress);
    
    if (matchedWallet) {
      console.log('🎯 Found matching Solana wallet for game transactions:', {
        address: matchedWallet.address,
        walletType: matchedWallet.walletClientType || 'unknown',
        isEmbedded: matchedWallet.walletClientType === 'privy'
      });
    }
    
    return matchedWallet || wallets[0];
  }, [walletAddress, wallets]);
  
  // Extract wallet information from Privy user - use consistent wallet address
  const publicKey = useMemo(() => {
    if (!authenticated || !walletAddress) {
      console.log("🔍 Wallet Debug: Not authenticated or no wallet address", { authenticated, walletAddress });
      return null;
    }
    
    // Final safety check: Solana addresses are base58 and typically 32-44 characters
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      console.error('❌ Invalid Solana address format:', walletAddress);
      return null;
    }
    
    try {
      console.log("🔍 Wallet Debug: Creating PublicKey from embedded Solana wallet:", walletAddress);
      return new PublicKey(walletAddress);
    } catch (error) {
      console.error("Invalid public key from Privy wallet address:", error);
      return null;
    }
  }, [authenticated, walletAddress]);
  
  const connected = authenticated && publicKey !== null && walletAddress !== undefined;
  const connecting = ready && !authenticated;
  const disconnecting = false;
  
  const wallet = solanaWallet ? {
    adapter: {
      name: "Privy Solana",
      url: "https://privy.io",
      icon: "",
      publicKey,
      connected,
      ready
    }
  } : null;

  const connect = login;
  const disconnect = logout;

  // Implement signMessage using Privy's Solana wallet
  const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    if (!solanaWallet || !connected) {
      throw new Error("Solana wallet not connected");
    }

    // Verify we're using embedded wallet for message signing
    const isEmbeddedWallet = solanaWallet.walletClientType === 'privy';
    console.log('🎯 Signing message with Solana wallet:', {
      address: solanaWallet.address,
      isEmbedded: isEmbeddedWallet,
      walletType: solanaWallet.walletClientType || 'unknown'
    });
    
    if (!isEmbeddedWallet) {
      console.warn('⚠️ Using external wallet instead of embedded Privy wallet for message signing');
    }

    try {
      // Use Privy's signMessage method for Solana wallets with v3 API
      const result = await solanaWallet.signMessage({
        message
      });
      
      // The result should contain the signature
      return result.signature;
    } catch (error) {
      console.error("❌ Failed to sign message with Privy Solana wallet:", error);
      throw new Error(`Message signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Send transaction function using Privy's implementation
  const sendTransaction = async (transaction: Transaction, _connection?: Connection) => {
    if (!solanaWallet || !connected) {
      throw new Error("Solana wallet not connected");
    }
    
    try {
      // Determine the network/chain based on connection
      const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
      const chain = network === "mainnet" ? "solana:mainnet" : "solana:devnet";
      
      // Serialize the transaction to the format expected by Privy v3
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      
      // Use Privy's signAndSendTransaction hook with v3 API
      const result = await privySendTransaction({ 
        wallet: solanaWallet,
        transaction: serializedTransaction,
        chain
      });
      return result.signature;
    } catch (error) {
      console.error("Failed to send transaction with Privy:", error);
      throw error;
    }
  };

  const signTransaction = async (transaction: Transaction) => {
    if (!solanaWallet || !connected) {
      throw new Error("Solana wallet not connected");
    }
    
    // Generate operation ID for loop prevention
    const operationId = `sign-${transaction.signatures[0]?.toString() || Date.now()}`;
    
    // Loop prevention: Check if signing operation is already in progress
    if (isSigningInProgress || signingOperationRef.current === operationId) {
      console.warn('⚠️ Transaction signing already in progress, preventing loop:', operationId);
      throw new Error("Transaction signing already in progress");
    }
    
    // Verify we're using embedded wallet for game transactions
    const isEmbeddedWallet = solanaWallet.walletClientType === 'privy';
    console.log('🎯 Signing transaction with Solana wallet:', {
      address: solanaWallet.address,
      isEmbedded: isEmbeddedWallet,
      walletType: solanaWallet.walletClientType || 'unknown',
      operationId
    });
    
    if (!isEmbeddedWallet) {
      console.warn('⚠️ Using external wallet instead of embedded Privy wallet for game transaction');
    }
    
    try {
      // Set loop prevention flags
      setIsSigningInProgress(true);
      signingOperationRef.current = operationId;
      
      // Determine the network/chain based on environment
      const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
      const chain = network === "mainnet" ? "solana:mainnet" : "solana:devnet";
      
      // Serialize the transaction for Privy v3
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      
      // Use Privy's Solana wallet signTransaction method with v3 API
      const result = await solanaWallet.signTransaction({
        transaction: serializedTransaction,
        chain
      });
      
      console.log('✅ Transaction signed successfully with embedded wallet:', {
        operationId,
        signedTransaction: result.signedTransaction
      });
      
      // Convert back to Transaction object if needed
      return Transaction.from(result.signedTransaction);
    } catch (error) {
      console.error("❌ Failed to sign transaction with Privy Solana wallet:", error);
      throw error;
    } finally {
      // Clear loop prevention flags
      setIsSigningInProgress(false);
      signingOperationRef.current = null;
    }
  };

  const signAllTransactions = async (transactions: Transaction[]) => {
    if (!solanaWallet || !connected) {
      throw new Error("Solana wallet not connected");
    }
    
    // Generate operation ID for loop prevention
    const operationId = `sign-all-${transactions.length}-${Date.now()}`;
    
    // Loop prevention: Check if signing operation is already in progress
    if (isSigningInProgress || signingOperationRef.current === operationId) {
      console.warn('⚠️ Batch transaction signing already in progress, preventing loop:', operationId);
      throw new Error("Batch transaction signing already in progress");
    }
    
    // Verify we're using embedded wallet for game transactions
    const isEmbeddedWallet = solanaWallet.walletClientType === 'privy';
    console.log('🎯 Signing batch transactions with Solana wallet:', {
      address: solanaWallet.address,
      isEmbedded: isEmbeddedWallet,
      walletType: solanaWallet.walletClientType || 'unknown',
      transactionCount: transactions.length,
      operationId
    });
    
    if (!isEmbeddedWallet) {
      console.warn('⚠️ Using external wallet instead of embedded Privy wallet for batch game transactions');
    }
    
    try {
      // Set loop prevention flags
      setIsSigningInProgress(true);
      signingOperationRef.current = operationId;
      
      // Use Privy's Solana wallet signAllTransactions method if available with v3 API
      if (solanaWallet.signAndSendAllTransactions) {
        // Determine the network/chain based on environment
        const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
        const chain = network === "mainnet" ? "solana:mainnet" : "solana:devnet";
        
        // Serialize all transactions
        const serializedTransactions = transactions.map(tx => ({
          transaction: tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false
          }),
          chain
        }));
        
        const results = await solanaWallet.signAndSendAllTransactions(serializedTransactions);
        
        console.log('✅ Batch transactions signed successfully with embedded wallet:', {
          operationId,
          count: results.length
        });
        
        // Convert back to Transaction objects
        return results.map((result: any) => Transaction.from(result.signedTransaction));
      } else {
        // Fallback: sign transactions one by one using our enhanced signTransaction
        console.log('🔄 Fallback: Signing transactions one by one');
        const signedTransactions = [];
        for (const transaction of transactions) {
          // Use our enhanced signTransaction method (but disable loop prevention for this context)
          const tempRef: string | null = signingOperationRef.current;
          const tempState: boolean = isSigningInProgress;
          setIsSigningInProgress(false);
          signingOperationRef.current = null;
          
          try {
            // Determine the network/chain based on environment
            const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
            const chain = network === "mainnet" ? "solana:mainnet" : "solana:devnet";
            
            // Serialize the transaction for Privy v3
            const serializedTransaction = transaction.serialize({
              requireAllSignatures: false,
              verifySignatures: false
            });
            
            // Use Privy's Solana wallet signTransaction method with v3 API
            const result = await solanaWallet.signTransaction({
              transaction: serializedTransaction,
              chain
            });
            
            // Convert back to Transaction object
            const signed = Transaction.from(result.signedTransaction);
            signedTransactions.push(signed);
          } finally {
            // Restore loop prevention state
            setIsSigningInProgress(tempState);
            signingOperationRef.current = tempRef;
          }
        }
        
        console.log('✅ Sequential transactions signed successfully with embedded wallet:', {
          operationId,
          count: signedTransactions.length
        });
        return signedTransactions;
      }
    } catch (error) {
      console.error("❌ Failed to sign all transactions with Privy Solana wallet:", error);
      throw error;
    } finally {
      // Clear loop prevention flags
      setIsSigningInProgress(false);
      signingOperationRef.current = null;
    }
  };

  return {
    publicKey,
    connected,
    connecting,
    disconnecting,
    wallet,
    connect,
    disconnect,
    sendTransaction,
    signTransaction,
    signAllTransactions,
    signMessage,
    // Loop prevention state
    isSigningInProgress,
    // Additional properties that might be needed
    autoConnect: false,
    wallets: [],
    select: () => {},
  };
}
