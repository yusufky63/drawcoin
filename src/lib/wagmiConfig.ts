import {
  cookieStorage,
  createConfig,
  createStorage,
  http,
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";

import { DATA_SUFFIX } from "@/lib/builderCode";

// Base App loads DrawCoin as a standard web app. Base Account is primary;
// injected wallets remain a browser fallback.
export function getConfig() {
  return createConfig({
    chains: [base, baseSepolia],
    dataSuffix: DATA_SUFFIX,
    multiInjectedProviderDiscovery: false,
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
    transports: {
      [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
      [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
    },
    connectors: [baseAccount({ appName: "DrawCoin" }), injected()],
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
