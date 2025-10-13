/**
 * IPFS utility functions for converting ipfs:// URLs to HTTP gateway URLs
 */

// List of fast and reliable IPFS gateways (in order of preference)
const IPFS_GATEWAYS = [
  'https://brown-naked-reindeer-865.mypinata.cloud/ipfs/', // Custom Pinata gateway (preferred)
  'https://ipfs.io/ipfs/', // Official gateway
  'https://gateway.pinata.cloud/ipfs/', // Pinata
  'https://cloudflare-ipfs.com/ipfs/', // Cloudflare
  'https://dweb.link/ipfs/', // Protocol Labs
];

/**
 * Convert an IPFS URL to an HTTP gateway URL
 * @param ipfsUrl - The IPFS URL (e.g., "ipfs://QmHash..." or "QmHash...")
 * @param gatewayIndex - Index of the gateway to use (default: 0)
 * @returns HTTP URL or original URL if not an IPFS URL
 */
export function ipfsToHttp(ipfsUrl: string, gatewayIndex: number = 0): string {
  if (!ipfsUrl) return ipfsUrl;

  // Extract IPFS hash from various formats
  let hash: string;
  
  if (ipfsUrl.startsWith('ipfs://')) {
    hash = ipfsUrl.replace('ipfs://', '');
  } else if (ipfsUrl.startsWith('Qm') || ipfsUrl.startsWith('bafy')) {
    // Direct IPFS hash
    hash = ipfsUrl;
  } else if (ipfsUrl.includes('/ipfs/')) {
    // Already an HTTP gateway URL - extract hash and use our preferred gateway
    const match = ipfsUrl.match(/\/ipfs\/([^/?#]+)/);
    hash = match ? match[1] : '';
  } else {
    // Not an IPFS URL, return as is
    return ipfsUrl;
  }

  if (!hash) return ipfsUrl;

  // Clean the hash (remove any additional path or query parameters for the hash part)
  const cleanHash = hash.split('/')[0].split('?')[0];
  const remainingPath = hash.substring(cleanHash.length);

  // Use the specified gateway (fallback to first one if index is out of bounds)
  const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];
  
  return `${gateway}${cleanHash}${remainingPath}`;
}

/**
 * Get multiple gateway URLs for an IPFS hash (useful for fallbacks)
 * @param ipfsUrl - The IPFS URL
 * @returns Array of HTTP URLs using different gateways
 */
export function ipfsToHttpMultiple(ipfsUrl: string): string[] {
  return IPFS_GATEWAYS.map((_, index) => ipfsToHttp(ipfsUrl, index));
}

/**
 * Check if a URL is an IPFS URL
 * @param url - The URL to check
 * @returns true if the URL is an IPFS URL
 */
export function isIpfsUrl(url: string): boolean {
  return url.startsWith('ipfs://') || 
         url.startsWith('Qm') || 
         url.startsWith('bafy') ||
         url.includes('/ipfs/');
}

/**
 * Resolve image URL with IPFS support and image optimization
 * @param imageUrl - The original image URL
 * @returns Resolved image URL or empty string if no valid image
 */
export function resolveImageUrl(imageUrl: string): string {
  if (!imageUrl) {
    return '';
  }

  // Handle external image URLs directly (Together AI, Replicate, etc.)
  if (imageUrl.startsWith('http') && !imageUrl.includes('/ipfs/')) {
    return imageUrl;
  }

  if (isIpfsUrl(imageUrl)) {
    const httpUrl = ipfsToHttp(imageUrl);
    return httpUrl;
  }

  return imageUrl;
}

/**
 * Get a pre-validated IPFS URL that should work in browsers
 * @param ipfsUrl - The IPFS URL
 * @returns A working HTTP URL or empty string
 */
export function getWorkingIpfsUrl(ipfsUrl: string): string {
  if (!isIpfsUrl(ipfsUrl)) {
    return ipfsUrl;
  }
  
  // Use ipfs.io gateway as it's most reliable
  const httpUrl = ipfsToHttp(ipfsUrl, 0);
  
  // Test if we can create a valid URL
  try {
    new URL(httpUrl);
    return httpUrl;
  } catch {
    return '';
  }
}

/**
 * Fetch and parse IPFS metadata to extract image URL
 * @param ipfsUrl - The IPFS URL containing metadata JSON
 * @returns Promise with the actual image URL or empty string
 */
export async function getImageFromIpfsMetadata(ipfsUrl: string): Promise<string> {
  if (!ipfsUrl || !isIpfsUrl(ipfsUrl)) {
    return ipfsUrl || '';
  }

  try {
    // Get HTTP URL for the metadata
    const metadataUrl = getWorkingIpfsUrl(ipfsUrl);
    if (!metadataUrl) return '';

    console.log('Fetching IPFS metadata from:', metadataUrl);
    
    // Fetch the metadata JSON
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      console.error('Failed to fetch IPFS metadata:', response.status);
      return '';
    }

    const metadata = await response.json();
    console.log('IPFS metadata loaded:', metadata);

    // Extract image URL from metadata
    const imageUrl = metadata.image || metadata.imageUrl || metadata.image_url;
    
    if (!imageUrl) {
      console.warn('No image found in IPFS metadata');
      return '';
    }

    // If the image URL is also an IPFS URL, convert it
    if (isIpfsUrl(imageUrl)) {
      return getWorkingIpfsUrl(imageUrl);
    }

    return imageUrl;
  } catch (error) {
    console.error('Error fetching IPFS metadata:', error);
    return '';
  }
}

/**
 * Enhanced image loading with fallback mechanisms
 * @param imageUrl - The image URL to load
 * @returns Promise with working image URL or empty string
 */
export async function loadImageWithFallback(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';

  // If it's already an HTTP URL (not IPFS), return it
  if (imageUrl.startsWith('http') && !imageUrl.includes('/ipfs/')) {
    return imageUrl;
  }

  // If it's an IPFS metadata URL, try to extract the actual image
  if (isIpfsUrl(imageUrl)) {
    try {
      const extractedImage = await getImageFromIpfsMetadata(imageUrl);
      if (extractedImage) {
        return extractedImage;
      }
    } catch (error) {
      console.warn('Failed to extract image from IPFS metadata:', error);
    }
    
    // Fallback to direct IPFS URL
    return getWorkingIpfsUrl(imageUrl);
  }

  return imageUrl;
}

/**
 * Component helper for image loading with fallback
 * @param imageUrl - The image URL
 * @param fallbackUrl - Fallback image URL (optional)
 * @returns Object with src and fallback methods
 */
export function createImageLoader(imageUrl: string, fallbackUrl?: string) {
  let currentUrl = resolveImageUrl(imageUrl);
  let fallbackIndex = 0;
  
  const tryNextFallback = () => {
    if (isIpfsUrl(imageUrl) && fallbackIndex < IPFS_GATEWAYS.length - 1) {
      fallbackIndex++;
      currentUrl = ipfsToHttp(imageUrl, fallbackIndex);
      return currentUrl;
    }
    
    if (fallbackUrl) {
      currentUrl = fallbackUrl;
      return currentUrl;
    }
    
    return '';
  };

  return {
    src: currentUrl,
    onError: tryNextFallback
  };
} 
