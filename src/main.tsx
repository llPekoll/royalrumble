import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import App from "./App.tsx";
import {PrivyProvider} from '@privy-io/react-auth';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
        <PrivyProvider
          appId={import.meta.env.VITE_PRIVY_APP_ID}
          config={{
            loginMethods: ['email', 'google', 'twitter'],
            appearance: {
              theme: 'dark',
              accentColor: '#6366f1',
            },
            embeddedWallets: {
              solana: {
                createOnLogin: 'users-without-wallets',
              },
            },
          }}
        >
        <App />
           </PrivyProvider>
        <Toaster />
    </ConvexProvider>
  </StrictMode>,
);
