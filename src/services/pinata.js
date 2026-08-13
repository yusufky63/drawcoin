import "server-only";

import axios from "axios";

const getSafePinataErrorDetails = (error) => {
  if (!axios.isAxiosError(error)) {
    return { kind: "unexpected_error" };
  }

  const status = error.response?.status;
  const code = error.code;

  return {
    kind: "pinata_request_failed",
    ...(Number.isInteger(status) && status >= 100 && status <= 599
      ? { status }
      : {}),
    ...(typeof code === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(code)
      ? { code }
      : {}),
  };
};

const logPinataError = (message, error) => {
  // AxiosError carries the full request config, including Authorization.
  // Never send the raw error object or its headers to application logs.
  console.error(message, getSafePinataErrorDetails(error));
};

// Pinata API anahtarı
const PINATA_JWT = process.env.PINATA_JWT;

// JWT token kontrolü
if (!PINATA_JWT) {
  console.warn(
    "PINATA_JWT environment variable is not set. IPFS uploads will fail."
  );
}

// Güvenilir IPFS Gateway'leri - ipfs.io'yu öncelikten düşürdük çünkü zaman aşımı yaşanıyor
const IPFS_GATEWAYS = [
  "https://brown-naked-reindeer-865.mypinata.cloud/ipfs/", // Custom Pinata gateway (preferred)
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://ipfs.fleek.co/ipfs/",
  "https://dweb.link/ipfs/",
];

// Cache veri yapısı - IPFS yüklemelerini önbelleğe alarak tekrarlanan yüklemeleri önlemek için
const ipfsCache = {
  metadata: new Map(), // Metadata önbelleği
  images: new Map(), // Görsel önbelleği
  uploads: new Map(), // Yükleme işlemleri önbelleği
};

// İyileştirilmiş gateway seçimi
export const getGatewayUrl = async (hash) => {
  // İlk olarak en güvenilir gateway'i varsayılan olarak ayarla
  let bestGateway = IPFS_GATEWAYS[0];
  let fastestResponseTime = Number.MAX_SAFE_INTEGER;

  // Promise.race kullanarak en hızlı yanıt veren gateway'i bul
  const gatewayPromises = IPFS_GATEWAYS.map(async (gateway) => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${gateway}${hash}`, {
        method: "HEAD",
        timeout: 5000,
        cache: "no-store",
      });

      if (response.ok) {
        const responseTime = Date.now() - startTime;
        if (responseTime < fastestResponseTime) {
          fastestResponseTime = responseTime;
          bestGateway = gateway;
        }
        return { gateway, responseTime };
      }
    } catch {
      return null;
    }
  });

  try {
    const results = await Promise.allSettled(gatewayPromises);
    const successfulGateways = results
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value)
      .sort((a, b) => a.responseTime - b.responseTime);

    return successfulGateways.length > 0
      ? successfulGateways[0].gateway
      : bestGateway;
  } catch {
    return bestGateway;
  }
};

// Basit görsel optimizasyonu
const optimizeImage = async (imageFile) => {
  if (!imageFile || imageFile.size <= 768 * 768) return imageFile;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  return new Promise((resolve) => {
    img.onload = () => {
      const maxSize = 800;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          resolve(new File([blob], imageFile.name, { type: "image/webp" }));
        },
        "image/webp",
        0.85
      );
    };
    img.src = URL.createObjectURL(imageFile);
  });
};

// IPFS'e yükleme fonksiyonu - timeout artırıldı ve önbellek eklendi
const uploadToIPFS = async (data, options = {}) => {
  try {
    // Aynı veri için önceki yükleme işlemi varsa, onu kullan
    const cacheKey = typeof data === "string" ? data : JSON.stringify(data);

    // Eğer bu veri daha önce yüklendiyse, cache'den döndür
    if (ipfsCache.uploads.has(cacheKey)) {
      console.log("IPFS cache hit - previously uploaded content used");
      return ipfsCache.uploads.get(cacheKey);
    }

    // İşlemde olan yükleme varsa bekle
    const pendingUpload = ipfsCache.uploads.get(`pending_${cacheKey}`);
    if (pendingUpload) {
      console.log("Waiting for ongoing upload...");
      return pendingUpload;
    }

    // Yeni bir yükleme işlemi başlat ve cache'e kaydet
    const uploadPromise = new Promise((resolve, reject) => {
      // Async içindeki fonksiyonu normal function şeklinde tanımla
      const doUpload = async () => {
        try {
          console.log("IPFS upload process started...");
          const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            data,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${PINATA_JWT}`,
                ...options,
              },
            }
          );

          const hash = response.data.IpfsHash;
          // Başarılı sonucu cache'e kaydet
          ipfsCache.uploads.set(cacheKey, hash);
          // Pending işareti kaldır
          ipfsCache.uploads.delete(`pending_${cacheKey}`);

          console.log("IPFS upload successful:", hash);
          resolve(hash);
        } catch (error) {
          // Hata durumunda pending işareti kaldır
          ipfsCache.uploads.delete(`pending_${cacheKey}`);
          logPinataError("IPFS upload failed", error);
          reject(error);
        }
      };

      // Async fonksiyonu çağır
      doUpload();
    });

    // Pending işareti ekle
    ipfsCache.uploads.set(`pending_${cacheKey}`, uploadPromise);

    return uploadPromise;
  } catch (error) {
    logPinataError("IPFS upload failed", error);
    throw new Error("IPFS upload failed");
  }
};

export const uploadImageToIPFS = async (imageFile) => {
  if (!imageFile) {
    throw new Error("No image to upload");
  }

  try {
    // Görsel cache kontrolü - aynı görseli tekrar yüklemeyi önle
    const imageId = imageFile.name + "_" + imageFile.size;
    if (ipfsCache.images.has(imageId)) {
      console.log("Image cache hit - same image previously uploaded");
      return ipfsCache.images.get(imageId);
    }

    const optimizedImage = await optimizeImage(imageFile);
    const formData = new FormData();
    formData.append("file", optimizedImage);

    const hash = await uploadToIPFS(formData, {
      "Content-Type": "multipart/form-data",
    });
    const imageUrl = `${IPFS_GATEWAYS[0]}${hash}`;

    // Cache'e kaydet
    ipfsCache.images.set(imageId, imageUrl);

    return imageUrl;
  } catch (error) {
    logPinataError("Image upload failed", error);
    throw new Error("Image upload failed");
  }
};

// IPFS URL'yi ipfs:// formatına dönüştürür - Zora SDK uyumluluğu için
export const convertToIPFSFormat = (url) => {
  if (!url) return url;

  // Zaten ipfs:// formatındaysa değiştirme
  if (url.startsWith("ipfs://")) return url;

  // Gateway URL'lerinden hash'i çıkart
  let hash = "";
  if (url.includes("/ipfs/")) {
    hash = url.split("/ipfs/").pop();
  } else if (url.match(/https?:\/\/[^/]+\/[^/]+/)) {
    // gateway.domain.com/hash formatı
    hash = url.split("/").pop();
  }

  // Hash alınabildiyse ipfs:// formatına dönüştür
  if (hash) {
    return `ipfs://${hash}`;
  }

  // Dönüştürülemezse orijinal URL'yi döndür
  return url;
};

export const createAndUploadCoinMetadata = async (
  symbol,
  description,
  imageUrl
) => {
  if (!symbol || !imageUrl) {
    throw new Error("Symbol and image URL are required");
  }

  try {
    // Improve cache key generation to be more reliable
    let cacheKeyImage = imageUrl;
    if (typeof imageUrl === "object" && imageUrl instanceof File) {
      // For File objects, we use name and size as part of the key
      cacheKeyImage = `file:${imageUrl.name}:${imageUrl.size}`;
    }

    // Create a more robust cache key using all parameters
    const metadataKey = `metadata:${symbol}:${description}:${cacheKeyImage}`;
    console.log("Checking metadata cache with key:", metadataKey);

    // Check if we already have this metadata cached
    if (ipfsCache.metadata.has(metadataKey)) {
      console.log("Metadata cache hit - same metadata previously uploaded");

      // Get the cached URL and ensure it's in ipfs:// format
      const cachedUrl = ipfsCache.metadata.get(metadataKey);
      const ipfsUrl = convertToIPFSFormat(cachedUrl);
      console.log("Cached metadata URL used:", ipfsUrl);
      return ipfsUrl;
    }

    // If image is already in ipfs:// format, use it directly
    // Otherwise, convert HTTP URLs to ipfs:// format if possible
    let ipfsImageUrl;
    if (typeof imageUrl === "string") {
      ipfsImageUrl = convertToIPFSFormat(imageUrl);
      console.log("Image URL is in ipfs:// format:", ipfsImageUrl);
    } else {
      // Handle File object upload - this would need separate implementation
      // For now, assume uploadImageToIPFS handles this and returns an ipfs:// URL
      console.log("Image is a File object, will be uploaded to IPFS");
      // Implementation would go here
    }

    // Create the metadata object
    const metadata = {
      name: symbol,
      description,
      image: ipfsImageUrl || imageUrl, // Use converted URL or original
    };

    // Upload to IPFS
    const hash = await uploadToIPFS(metadata);

    // Create proper ipfs:// URL
    const metadataUrl = `ipfs://${hash}`;

    // Store in cache - both ipfs:// format and HTTP gateway URL
    const httpUrl = `${IPFS_GATEWAYS[0]}${hash}`;
    ipfsCache.metadata.set(metadataKey, metadataUrl); // Store the ipfs:// URL directly

    console.log("Metadata uploaded: ", {
      hash,
      metadataUrl,
      httpUrl,
      metadata,
    });

    return metadataUrl;
  } catch (error) {
    logPinataError("Metadata upload failed", error);
    throw new Error("Metadata upload failed");
  }
};

/**
 * Blob verisini IPFS'e yükler (Together API görsellerini işlemek için)
 * @param {Blob} blob - Yüklenecek blob verisi (görsel)
 * @returns {Promise<{url: string, hash: string}>} IPFS URL ve hash bilgisi
 */
export const storeToIPFS = async (blob, fileName = null) => {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error("A valid blob data is required");
  }

  if (!PINATA_JWT) {
    throw new Error(
      "IPFS upload service is not configured. Please add your Pinata JWT token to environment variables. Visit pinata.cloud to get your API key."
    );
  }

  const maximumBytes = blob.type === "application/json" ? 64 * 1024 : 4 * 1024 * 1024;
  const allowedTypes = new Set([
    "application/json",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  if (!allowedTypes.has(blob.type)) {
    throw new Error("Unsupported IPFS upload type");
  }
  if (blob.size === 0 || blob.size > maximumBytes) {
    throw new Error("IPFS upload exceeds the allowed size");
  }

  try {
    // Blob verisini FormData olarak hazırla
    const formData = new FormData();
    const extensions = {
      "application/json": "json",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const requestedBaseName = (fileName || `drawcoin_${Date.now()}`)
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "drawcoin";
    const finalFileName = `${requestedBaseName}.${extensions[blob.type]}`;
    formData.append(
      "file",
      new File([blob], finalFileName, { type: blob.type || "image/png" })
    );

    console.log(`Uploading blob to IPFS (${blob.size} bytes)...`);

    // Pinata API'ye istek gönder
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        timeout: 20_000,
        maxBodyLength: 6 * 1024 * 1024,
        maxContentLength: 1024 * 1024,
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );

    const hash = response.data.IpfsHash;
    console.log(`IPFS upload successful: ${hash}`);

    // IPFS URL'sini oluştur
    const url = `ipfs://${hash}`;

    return { url, hash };
  } catch (error) {
    logPinataError("IPFS blob upload failed", error);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error(
        "IPFS upload failed: Invalid API key. Please check your PINATA_JWT environment variable."
      );
    }
    throw new Error("Blob IPFS upload failed");
  }
};
