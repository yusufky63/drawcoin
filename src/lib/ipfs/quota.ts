import "server-only";

import { resolveTrustedClientIdentifier } from "@/lib/auth/clientIdentity";
import { getIpfsUploadClientKey } from "@/lib/ipfs/security";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export class IpfsQuotaError extends Error {
  constructor(
    readonly status: 429 | 503,
    readonly retryAfterSeconds: number
  ) {
    super(
      status === 429
        ? "The IPFS upload quota is exhausted."
        : "The IPFS upload quota is unavailable."
    );
    this.name = "IpfsQuotaError";
  }
}

function boundedRetryAfter(value: number | undefined): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(86_400, Math.ceil(value ?? 5)));
}

export function getIpfsUploadRequestClientKey(request: Request): string {
  const identifier = resolveTrustedClientIdentifier(request.headers, {
    isVercel: process.env.VERCEL === "1",
    trustedProxyHeader: process.env.AUTH_TRUSTED_CLIENT_IP_HEADER,
  });

  return getIpfsUploadClientKey(identifier);
}

export async function reserveIpfsUpload(
  clientKey: string,
  imageBytes: number
): Promise<void> {
  if (!Number.isInteger(imageBytes) || imageBytes < 1 || imageBytes > 4_194_304) {
    throw new IpfsQuotaError(503, 5);
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("reserve_ipfs_upload", {
      p_client_key: clientKey,
      p_image_bytes: imageBytes,
    });
    const result = data?.[0];

    if (error || !result) {
      throw new IpfsQuotaError(503, 5);
    }
    if (!result.allowed) {
      throw new IpfsQuotaError(
        429,
        boundedRetryAfter(result.retry_after_seconds)
      );
    }
  } catch (error) {
    if (error instanceof IpfsQuotaError) throw error;
    throw new IpfsQuotaError(503, 5);
  }
}
