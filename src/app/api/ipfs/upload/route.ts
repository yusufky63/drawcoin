import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getIpfsUploadRequestClientKey,
  IpfsQuotaError,
  reserveIpfsUpload,
} from "@/lib/ipfs/quota";
import {
  decodeDataImageUrl,
  IpfsInputError,
  MAX_IPFS_UPLOAD_REQUEST_BYTES,
  readStreamWithLimit,
} from "@/lib/ipfs/security";
import { processImageBlobAndUploadToIPFS } from "@/services/imageUtils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const uploadSchema = z.object({
  imageUrl: z.string(),
  name: z.string().trim().min(1).max(100),
  symbol: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(2_000),
});

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

async function parseUploadBody(request: NextRequest) {
  const rawBody = await readStreamWithLimit(
    request.body,
    MAX_IPFS_UPLOAD_REQUEST_BYTES
  );

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    return uploadSchema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError) {
      throw new IpfsInputError("The upload payload is invalid.", 400);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType?.trim().toLowerCase() !== "application/json") {
    return jsonResponse(
      { error: "JSON_BODY_REQUIRED", success: false },
      415
    );
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_IPFS_UPLOAD_REQUEST_BYTES)
  ) {
    return jsonResponse(
      { error: "UPLOAD_TOO_LARGE", success: false },
      413
    );
  }

  try {
    const input = await parseUploadBody(request);
    const image = decodeDataImageUrl(input.imageUrl);
    await reserveIpfsUpload(
      getIpfsUploadRequestClientKey(request),
      image.bytes.byteLength
    );
    const imageBuffer = new ArrayBuffer(image.bytes.byteLength);
    new Uint8Array(imageBuffer).set(image.bytes);
    const imageBlob = new Blob([imageBuffer], { type: image.mimeType });
    const result = await processImageBlobAndUploadToIPFS(
      imageBlob,
      input.name,
      input.symbol,
      input.description
    );

    return jsonResponse({ ...result, success: true });
  } catch (error) {
    if (error instanceof IpfsQuotaError) {
      return jsonResponse(
        {
          error:
            error.status === 429
              ? "UPLOAD_RATE_LIMITED"
              : "UPLOAD_QUOTA_UNAVAILABLE",
          success: false,
        },
        error.status,
        { "Retry-After": String(error.retryAfterSeconds) }
      );
    }
    if (error instanceof IpfsInputError) {
      return jsonResponse(
        {
          error:
            error.status === 413
              ? "UPLOAD_TOO_LARGE"
              : error.status === 415
                ? "UNSUPPORTED_IMAGE"
                : "INVALID_UPLOAD",
          success: false,
        },
        error.status
      );
    }
    console.error("IPFS upload failed", error);
    return jsonResponse(
      { error: "UPLOAD_SERVICE_UNAVAILABLE", success: false },
      503
    );
  }
}
