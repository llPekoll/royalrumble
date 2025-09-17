import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SolanaWalletProvider } from "./components/WalletProvider";
import { Toaster } from "sonner";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import App from "./App.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <SolanaWalletProvider>
        <App />
        <Toaster />
      </SolanaWalletProvider>
    </ConvexProvider>
  </StrictMode>,
);
