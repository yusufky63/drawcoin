import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const MAX_IPFS_UPLOAD_REQUEST_BYTES = 6 * 1024 * 1024;
export const MAX_IPFS_IMAGE_BYTES = 4 * 1024 * 1024;

const DATA_IMAGE_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const IMAGE_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (bytes) =>
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  "image/jpeg": (bytes) =>
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff,
  "image/webp": (bytes) =>
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP",
};

export function getIpfsUploadClientKey(identifier: string): string {
  return createHash("sha256")
    .update(`drawcoin-ipfs-upload:${identifier.toLowerCase()}`, "utf8")
    .digest("hex");
}

export class IpfsInputError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(
    message: string,
    status: 400 | 413 | 415
  ) {
    super(message);
    this.name = "IpfsInputError";
    this.status = status;
  }
}

export function decodeDataImageUrl(value: unknown): {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
} {
  if (typeof value !== "string") {
    throw new IpfsInputError("A data image is required.", 400);
  }

  const match = DATA_IMAGE_PATTERN.exec(value);
  if (!match) {
    throw new IpfsInputError(
      "Only base64 PNG, JPEG, or WebP data images are accepted.",
      415
    );
  }

  const mimeType = match[1] as "image/png" | "image/jpeg" | "image/webp";
  const encoded = match[2];
  if (encoded.length % 4 !== 0) {
    throw new IpfsInputError("The image encoding is invalid.", 400);
  }

  const maximumEncodedLength = Math.ceil(MAX_IPFS_IMAGE_BYTES / 3) * 4;
  if (encoded.length > maximumEncodedLength) {
    throw new IpfsInputError("The image is too large.", 413);
  }

  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length > MAX_IPFS_IMAGE_BYTES) {
    throw new IpfsInputError("The image is too large.", 413);
  }
  if (decoded.length === 0 || decoded.toString("base64") !== encoded) {
    throw new IpfsInputError("The image encoding is invalid.", 400);
  }

  const bytes = new Uint8Array(decoded);
  if (!IMAGE_SIGNATURES[mimeType](bytes)) {
    throw new IpfsInputError(
      "The image content does not match its declared type.",
      415
    );
  }

  return { bytes, mimeType };
}

export async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maximumBytes: number
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel("size limit exceeded").catch(() => undefined);
        throw new IpfsInputError("The payload is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
