import "server-only";

import { isAddressEqual, type Address, type Hex } from "viem";
import { getBadgeRuntimeConfig } from "@/lib/badges/config";
import {
  BASE_ACCOUNT_FACTORY_ADDRESS,
  attestBaseAccountSender,
  baseAccountFactoryAbi,
  baseAccountIntrospectionAbi,
  validatePaymasterRequestShape,
  type PaymasterRequest,
} from "@/lib/badges/paymasterPolicyCore";
import type { PaymasterGrant } from "@/lib/badges/voucher";

export async function validatePaymasterRequest(
  body: unknown,
  grant: PaymasterGrant
): Promise<{ allowed: true; request: PaymasterRequest } | { allowed: false }> {
  try {
    const config = getBadgeRuntimeConfig();
    if (
      config.chainId !== grant.chainId ||
      !isAddressEqual(config.contractAddress, grant.contractAddress)
    ) {
      return { allowed: false };
    }

    const parsed = validatePaymasterRequestShape(body, grant);
    if (!parsed.allowed) return parsed;

    const isBaseAccount = await attestBaseAccountSender(
      parsed.userOperation.sender,
      parsed.deployment,
      {
        getBytecode: (address: Address) =>
          config.publicClient.getBytecode({ address }),
        getFactoryImplementation: () =>
          config.publicClient.readContract({
            address: BASE_ACCOUNT_FACTORY_ADDRESS,
            abi: baseAccountFactoryAbi,
            functionName: "implementation",
          }),
        getAccountImplementation: (address: Address) =>
          config.publicClient.readContract({
            address,
            abi: baseAccountIntrospectionAbi,
            functionName: "implementation",
          }),
        getAccountEntryPoint: (address: Address) =>
          config.publicClient.readContract({
            address,
            abi: baseAccountIntrospectionAbi,
            functionName: "entryPoint",
          }),
        getCounterfactualAddress: (owners: readonly Hex[], nonce: bigint) =>
          config.publicClient.readContract({
            address: BASE_ACCOUNT_FACTORY_ADDRESS,
            abi: baseAccountFactoryAbi,
            functionName: "getAddress",
            args: [owners, nonce],
          }),
      }
    );

    return isBaseAccount
      ? { allowed: true, request: parsed.request }
      : { allowed: false };
  } catch {
    return { allowed: false };
  }
}
