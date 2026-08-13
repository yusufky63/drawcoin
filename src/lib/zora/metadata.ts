import { validateMetadataJSON } from "@zoralabs/coins-sdk";

export interface DrawCoinMetadataInput {
  name: string;
  symbol: string;
  description?: string | null;
  image: string;
}

export interface DrawCoinMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
}

/**
 * Build the exact JSON that DrawCoin pins before calling createCoin.
 *
 * Coin creation skips the SDK's remote metadata fetch because the upload route
 * has just pinned this object. Keep this local validation as the trust boundary
 * for that optimization.
 */
export function buildZoraCoinMetadata(
  input: DrawCoinMetadataInput
): DrawCoinMetadata {
  const name = input.name.trim();
  const symbol = input.symbol.trim();
  const image = input.image.trim();
  const description =
    input.description?.trim() ||
    `${name} (${symbol}) - A token created with DrawCoin`;

  if (!name) throw new Error("Token name is required");
  if (!symbol) throw new Error("Token symbol is required");
  if (!image.startsWith("ipfs://")) {
    throw new Error("Zora metadata images must use an IPFS URI");
  }

  const metadata: DrawCoinMetadata = {
    name,
    symbol,
    description,
    image,
  };

  validateMetadataJSON(metadata);
  return metadata;
}
