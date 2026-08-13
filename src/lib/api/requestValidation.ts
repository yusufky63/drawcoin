export class ApiInputError extends Error {
  readonly status: 400 | 413 | 415 | 422;

  constructor(message: string, status: 400 | 413 | 415 | 422 = 400) {
    super(message);
    this.name = "ApiInputError";
    this.status = status;
  }
}

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function normalizeEvmAddress(value: string | null | undefined) {
  if (!value || !EVM_ADDRESS_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

export function parseAddressList(
  value: string | null | undefined,
  maximumItems = 50
) {
  if (!value) throw new ApiInputError("Addresses are required.");
  if (value.length > maximumItems * 43) {
    throw new ApiInputError("Too many addresses.", 413);
  }

  const rawItems = value.split(",");
  if (rawItems.length > maximumItems) {
    throw new ApiInputError("Too many addresses.", 413);
  }

  const addresses = new Set<string>();
  for (const rawItem of rawItems) {
    const address = normalizeEvmAddress(rawItem.trim());
    if (!address) throw new ApiInputError("An address is invalid.", 422);
    addresses.add(address);
  }

  if (addresses.size === 0) {
    throw new ApiInputError("Addresses are required.");
  }
  return Array.from(addresses);
}

export function parseBoundedInteger(
  value: string | null,
  options: { fallback: number; minimum: number; maximum: number }
) {
  if (value === null || value === "") return options.fallback;
  if (!/^\d+$/.test(value)) throw new ApiInputError("Invalid number.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ApiInputError("Invalid number.");
  return Math.min(options.maximum, Math.max(options.minimum, parsed));
}

export async function readJsonBody<T>(
  request: Request,
  maximumBytes: number
): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType?.trim().toLowerCase() !== "application/json") {
    throw new ApiInputError("A JSON body is required.", 415);
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)
  ) {
    throw new ApiInputError("The request body is too large.", 413);
  }

  if (!request.body) throw new ApiInputError("A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel("body limit exceeded").catch(() => undefined);
        throw new ApiInputError("The request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as T;
  } catch {
    throw new ApiInputError("The JSON body is invalid.");
  }
}
