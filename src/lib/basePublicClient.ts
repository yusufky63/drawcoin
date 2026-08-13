import "server-only";

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.BASE_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_RPC_URL
  ),
});
