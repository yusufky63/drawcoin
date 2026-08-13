export type SiweVerificationAttemptResult =
  | "nonce_rejected"
  | "signature_invalid"
  | "verified";

type SiweVerificationAttemptOptions = {
  nonceHash: string;
  consumeNonce: (nonceHash: string) => Promise<boolean>;
  verifySignature: () => Promise<boolean>;
};

/**
 * Burns the one-time challenge before invoking the comparatively expensive
 * signature/RPC check. A failed signature therefore requires a fresh nonce,
 * and replaying a copied nonce cookie cannot amplify RPC work.
 */
export async function runSiweVerificationAttempt({
  nonceHash,
  consumeNonce,
  verifySignature,
}: SiweVerificationAttemptOptions): Promise<SiweVerificationAttemptResult> {
  const consumed = await consumeNonce(nonceHash);
  if (!consumed) return "nonce_rejected";

  try {
    return (await verifySignature()) ? "verified" : "signature_invalid";
  } catch {
    return "signature_invalid";
  }
}
