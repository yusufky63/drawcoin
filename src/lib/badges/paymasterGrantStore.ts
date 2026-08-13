import "server-only";

import type { Address, Hex } from "viem";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PaymasterRequestMethod =
  | "pm_getPaymasterStubData"
  | "pm_getPaymasterData";

export type PaymasterGrantRecord = {
  grantId: string;
  account: Address;
  contractAddress: Address;
  chainId: number;
  tokenId: string;
  nonce: string;
  expiresAt: number;
  claimCallDataHash: Hex;
};

function grantRpcArgs(grant: PaymasterGrantRecord) {
  return {
    p_grant_id: grant.grantId,
    p_account: grant.account.toLowerCase(),
    p_contract_address: grant.contractAddress.toLowerCase(),
    p_chain_id: grant.chainId,
    p_token_id: grant.tokenId,
    p_claim_nonce: grant.nonce,
    p_claim_calldata_hash: grant.claimCallDataHash.toLowerCase(),
    p_expires_at: new Date(grant.expiresAt * 1_000).toISOString(),
  };
}

export async function issuePaymasterGrant(
  grant: PaymasterGrantRecord
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "issue_paymaster_grant",
      grantRpcArgs(grant)
    );

    return !error && data === true;
  } catch {
    // Missing migrations, unavailable storage, and permission failures must all
    // disable sponsorship. The badge voucher remains valid for user-paid gas.
    return false;
  }
}

export async function reservePaymasterGrant(
  grant: PaymasterGrantRecord,
  requestMethod: PaymasterRequestMethod
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "reserve_paymaster_grant",
      {
        ...grantRpcArgs(grant),
        p_request_method: requestMethod,
      }
    );

    return !error && data === true;
  } catch {
    return false;
  }
}
