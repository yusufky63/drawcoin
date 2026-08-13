/**
 * Image utilities that ensure external images (Together/Replicate/etc.)
 * are downloaded and pinned to IPFS. Metadata JSON always references ipfs://.
 */

import { decodeDataImageUrl } from "@/lib/ipfs/security";
import { buildZoraCoinMetadata } from "@/lib/zora/metadata";
import { storeToIPFS } from "./pinata";

/**
 * Upload raw Blob/File to IPFS
 * @param {Blob|File} imageData
 * @returns {Promise<string>} ipfs:// URL
 */
export async function uploadImageToIPFS(imageData) {
  if (!imageData) throw new Error("No image data provided");
  const result = await storeToIPFS(imageData);
  if (!result || !result.url || !result.url.startsWith('ipfs://')) {
    throw new Error("IPFS storage failed: No valid URL returned");
  }
  return result.url;
}

/**
 * Convert ipfs:// to a gateway URL
 * @param {string} ipfsUri
 */
export function getIPFSDisplayUrl(ipfsUri) {
  if (!ipfsUri) return '';
  if (!ipfsUri.startsWith('ipfs://')) return ipfsUri;
  const hash = ipfsUri.slice(7);
  // Prefer custom Pinata gateway for faster loads
  return `https://brown-naked-reindeer-865.mypinata.cloud/ipfs/${hash}`;
}

/**
 * Normalize a URL to ipfs:// if possible
 * @param {string} uri
 */
export function validateIpfsUri(uri) {
  if (!uri) return { valid: false, message: 'URI is required', uri: '' };
  if (uri.startsWith('ipfs://')) return { valid: true, message: 'URI validated', uri };

  if (uri.includes('/ipfs/')) {
    const parts = uri.split('/ipfs/');
    if (parts.length >= 2) {
      const hash = parts[1].split('/')[0].split('?')[0];
      if (hash) return { valid: true, message: 'Converted to IPFS URI', uri: `ipfs://${hash}` };
    }
  }

  const uriParts = uri.split('/');
  const potentialHash = uriParts[uriParts.length - 1].split('?')[0];
  if (potentialHash && potentialHash.length > 20) {
    return { valid: true, message: 'Converted direct URL to IPFS URI', uri: `ipfs://${potentialHash}` };
  }

  console.warn(`Could not normalize URI to IPFS format: ${uri}`);
  return { valid: true, message: 'Using original URI', uri };
}

/**
 * Download external image, pin to IPFS, then create metadata JSON on IPFS.
 * Returns metadata ipfs:// and display gateway URL for the image.
 * @param {string} imageUrl External image URL (e.g., Together)
 * @param {string} name Token name
 * @param {string} symbol Token symbol
 * @param {string} description Token description
 */
export async function processImageAndUploadToIPFS(imageUrl, name, symbol, description) {
  const image = decodeDataImageUrl(imageUrl);
  const blob = new Blob([image.bytes], { type: image.mimeType });
  return processImageBlobAndUploadToIPFS(blob, name, symbol, description);
}

export async function processImageBlobAndUploadToIPFS(blob, name, symbol, description) {
  if (!blob || !(blob instanceof Blob)) throw new Error("Image data is required");
  if (!name) throw new Error("Token name is required");
  if (!symbol) throw new Error("Token symbol is required");

  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extensions[blob.type];
  if (!ext) throw new Error("Unsupported image type");
  const safeBaseName = `${name}_${symbol}`
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "drawcoin";
  const safeName = `${safeBaseName}.${ext}`;
  const uploaded = await storeToIPFS(blob, safeName);
  if (!uploaded?.url?.startsWith('ipfs://')) throw new Error('IPFS image upload failed');
  const imageIpfsUrl = uploaded.url;

  const metadata = buildZoraCoinMetadata({
    name,
    symbol,
    description,
    image: imageIpfsUrl,
  });
  const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
  const metadataRes = await storeToIPFS(jsonBlob, `${safeBaseName}_metadata.json`);
  if (!metadataRes?.url?.startsWith('ipfs://')) throw new Error('IPFS metadata upload failed');

  return {
    ipfsUrl: metadataRes.url,
    displayUrl: getIPFSDisplayUrl(imageIpfsUrl),
  };
}

/**
 * Backward-compatible helper for Together-like URLs.
 * Returns { displayUrl, ipfsUri }.
 */
export async function processTtlgenHerImage(imageUrl, tokenName, tokenSymbol, tokenDescription) {
  if (!imageUrl) throw new Error("No image URL provided");
  const name = tokenName || 'Token';
  const symbol = tokenSymbol || '';
  const description = tokenDescription || `${name} token - Created with DrawCoin`;

  const { ipfsUrl, displayUrl } = await processImageAndUploadToIPFS(imageUrl, name, symbol, description);
  return { displayUrl, ipfsUri: ipfsUrl };
}
