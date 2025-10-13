/**
 * Persist Together.ai-generated images to IPFS, then build metadata JSON on IPFS.
 */

import { storeToIPFS } from "./pinata";

function ipfsToGateway(url) {
  if (!url) return "";
  if (!url.startsWith("ipfs://")) return url;
  const hash = url.slice(7);
  return `https://ipfs.io/ipfs/${hash}`;
}

/**
 * Downloads the Together image, uploads the bytes to IPFS, then uploads metadata JSON to IPFS.
 * Returns displayUrl (gateway) and ipfsUri (metadata JSON ipfs://...)
 */
export async function processTogetherImageToIPFS(imageUrl, tokenName, tokenSymbol, tokenDescription) {
  try {
    if (!imageUrl) throw new Error("No image URL provided");

    // 1) Fetch image & upload bytes to IPFS (no fallback to external URL)
    const resp = await fetch(imageUrl, { mode: 'cors' });
    if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
    const blob = await resp.blob();

    // Derive a safe filename with extension
    const ext = (blob.type && blob.type.split('/')[1]) || 'png';
    const safeName = `${(tokenName || 'token').toString().slice(0,32)}_${(tokenSymbol || '').toString().slice(0,16)}.${ext}`;
    const uploaded = await storeToIPFS(blob, safeName);
    if (!uploaded?.url?.startsWith('ipfs://')) {
      throw new Error('IPFS image upload failed');
    }
    const imageIpfsUrl = uploaded.url;

    // 2) Build metadata using IPFS image when available
    const metadata = {
      name: tokenName || 'Token',
      description: tokenDescription || `${tokenName} token - Created with DrawCoin`,
      symbol: tokenSymbol,
      image: imageIpfsUrl, // always ipfs://
    };
    const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metaRes = await storeToIPFS(jsonBlob, `${metadata.name}_metadata.json`);
    if (!metaRes?.url?.startsWith('ipfs://')) throw new Error('IPFS metadata upload failed');

    // 3) Prefer IPFS image for display
    const displayUrl = ipfsToGateway(imageIpfsUrl);
    return { displayUrl, ipfsUri: metaRes.url };
  } catch (error) {
    console.error('Error processing Together.ai image:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}
