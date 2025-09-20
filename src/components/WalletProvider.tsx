import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { getSolanaRpcUrl } from '../lib/utils';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';

import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  const endpoint = useMemo(() =>
    import.meta.env.VITE_SOLANA_RPC_URL || getSolanaRpcUrl(), []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <UnifiedWalletProvider
        wallets={[]}
        config={{
          autoConnect: true,
          env: 'mainnet-beta',
          metadata: {
            name: 'Royal Rumble',
            description: 'Battle royale betting game on Solana',
            url: typeof window !== 'undefined' ? window.location.origin : '',
            iconUrls: ['favicon.ico'],
          },
          theme: 'dark',
        }}
      >
        {children}
      </UnifiedWalletProvider>
    </ConnectionProvider>
  );
};