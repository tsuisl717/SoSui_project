"use client";

import { FC, ReactNode, useState } from "react";
import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NETWORK, RPC_ENDPOINT } from "@/lib/constants";
import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl("mainnet") },
  testnet: { url: getFullnodeUrl("testnet") },
  devnet: { url: RPC_ENDPOINT || getFullnodeUrl("devnet") },
  localnet: { url: "http://127.0.0.1:9000" },
});

export const AppProviders: FC<{ children: ReactNode }> = ({ children }) => {
  // The QueryClient must be a stable per-tab instance, not a module singleton —
  // otherwise hot reload + SSR hydration get confused.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={NETWORK}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
};
