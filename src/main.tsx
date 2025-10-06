import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App.tsx";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
// Solana network configuration utility
const getSolanaConfig = () => {
  const network = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
  const isMainnet = network === "mainnet" || network === "mainnet-beta";
  const customRpcUrl = import.meta.env.VITE_SOLANA_RPC_URL;
  const defaultRpcUrl = isMainnet
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

  const rpcUrl = customRpcUrl || defaultRpcUrl;

  // Create WebSocket URL from HTTP URL
  const wsUrl = rpcUrl.replace(/^https?:\/\//, "wss://");

  return {
    network,
    isMainnet,
    rpcUrl,
    wsUrl,
  };
};

const solanaConfig = getSolanaConfig();

// Log configuration for debugging
console.log(
  `🔗 Privy configured for Solana-ONLY ${solanaConfig.isMainnet ? "Mainnet" : "Devnet"}`,
  {
    network: solanaConfig.network,
    rpcUrl: solanaConfig.rpcUrl,
    wsUrl: solanaConfig.wsUrl,
    isMainnet: solanaConfig.isMainnet,
    walletChainType: "solana-only", // NO EVM support
    embeddedWallets: "all-users-solana-only", // Creating Solana embedded wallets for all users
    externalWallets: "solana-authentication-only", // Solana external wallets used only for auth
    rpcs: {
      mainnet: solanaConfig.isMainnet ? solanaConfig.rpcUrl : "https://api.mainnet-beta.solana.com",
      devnet: !solanaConfig.isMainnet ? solanaConfig.rpcUrl : "https://api.devnet.solana.com",
    },
  }
);

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <PrivyProvider
        appId={import.meta.env.VITE_PRIVY_APP_ID}
        config={{
          // SOLANA EMBEDDED WALLETS ONLY
          // Login with email/social - embedded wallet created automatically
          loginMethods: ["wallet", "email", "google"],

          // Appearance configuration
          appearance: {
            theme: "dark",
            accentColor: "#6366f1",
            showWalletLoginFirst: true,
            walletChainType: "solana-only",
            walletList: ["phantom", "solflare", "backpack", "metamask"],
          },
          externalWallets: {
            solana: {
              connectors: toSolanaWalletConnectors(), // For detecting EOA browser wallets
            },
          },
          // NO external wallets - prevents redirect to wallet websites
          // Users get embedded Solana wallet automatically

          // Embedded wallets - create for ALL users (in-game wallet)
          embeddedWallets: {
            solana: {
              createOnLogin: "all-users", // Always create embedded wallet for in-game funds
            },
          },

          solana: {
            rpcs: {
              "solana:mainnet": {
                rpc: createSolanaRpc("https://api.mainnet-beta.solana.com"),
                rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.mainnet-beta.solana.com"),
              },
              "solana:devnet": {
                rpc: createSolanaRpc("https://api.devnet.solana.com"),
                rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
              },
            },
          },
          // Additional configuration
          mfa: {
            noPromptOnMfaRequired: false,
          },

          // Configure legal and terms
          // legal: {
          //   termsAndConditionsUrl: "/terms",
          //   privacyPolicyUrl: "/privacy",
          // },
        }}
      >
        <App />
      </PrivyProvider>
      <Toaster />
    </ConvexProvider>
  </StrictMode>
);
