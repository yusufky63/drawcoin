import { processTtlgenHerImage } from "./imageUtils";

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MAX_RETRIES = 3;

const API_ENDPOINTS = {
  TOGETHER_IMAGE: "https://api.together.xyz/v1/images/generations",
  GEMINI_IMAGEN3_FAST: "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-fast:generateImages",
};

const MODELS = {
  IMAGE: {
    TOGETHER: "black-forest-labs/FLUX.1-schnell-Free",
    GEMINI: "imagen-3.0-fast",
  },
};


// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get API key from environment variables
 */
const getApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
  if (!apiKey) {
    console.error("Together API key is missing from environment variables");
    throw new Error(
      "API key is required. Please set NEXT_PUBLIC_TOGETHER_API_KEY in your environment variables."
    );
  }
  return apiKey;
};

/**
 * Clean text to avoid NSFW detection
 */
const sanitizeText = (text) => {
  if (!text) return "";
  return text.replace(/beauty|sexy|hot|attractive|babe|gorgeous/gi, "lovely");
};

/**
 * Generic retry mechanism
 */
const retryOperation = async (operation, context, handleError, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`${context} attempt ${i + 1}/${retries} failed:`, error);

      if (i === retries - 1) {
        handleError(error, context);
        throw error;
      }

      if (error.message?.includes("user rejected")) {
        handleError(error, context);
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

/**
 * Wait utility
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// IMAGE GENERATION PROVIDERS
// =============================================================================

/**
 * Gemini SDK Image Generation (Streaming)
 */
const generateGeminiImageStream = async (userPrompt) => {
  const { GoogleGenAI } = await import('@google/genai');
  const mime = await import('mime');
  
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.NEXT_PUBLIC_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

  const systemPrompt = "Hand-drawn art style, sketch, drawing, pencil sketch, artistic drawing, hand-drawn illustration, sketchy style, drawing art, hand-drawn design, artistic sketch, pencil drawing, hand-drawn artwork, sketchy illustration, drawing style, hand-drawn style, artistic drawing, sketch art, hand-drawn sketch, drawing illustration";
  const prompt = `${systemPrompt}, ${userPrompt}, 1024x1024, high quality, detailed, artistic, clean background, centered composition`;

  const config = {
    responseModalities: ['IMAGE', 'TEXT'],
  };

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  const stream = await ai.models.generateContentStream({ model, config, contents });

  let firstImageData = null;
  for await (const chunk of stream) {
    const parts = chunk?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts) || parts.length === 0) continue;

    const inline = parts.find((p) => p?.inlineData);
    if (inline?.inlineData?.data) {
      const mimeType = inline.inlineData.mimeType || 'image/png';
      firstImageData = { data: inline.inlineData.data, mimeType };
      break; // first image is enough
    }
  }

  if (!firstImageData) {
    throw new Error('Gemini returned no image data');
  }

  const dataUrl = `data:${firstImageData.mimeType || 'image/png'};base64,${firstImageData.data}`;
  return dataUrl;
};



/**
 * Together.ai Image Generation
 */
const generateImageWithTogetherAI = async (userPrompt) => {
  const TOGETHER_API_KEY = getApiKey();
  
  const systemPrompt = "Hand-drawn art style, sketch, drawing, pencil sketch, artistic drawing, hand-drawn illustration, sketchy style, drawing art, hand-drawn design, artistic sketch, pencil drawing, hand-drawn artwork, sketchy illustration, drawing style, hand-drawn style, artistic drawing, sketch art, hand-drawn sketch, drawing illustration";
  const prompt = `${systemPrompt}, ${userPrompt}, 1024x1024, high quality, detailed, artistic, clean background, centered composition`;

  const response = await fetch(API_ENDPOINTS.TOGETHER_IMAGE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.IMAGE.TOGETHER,
      prompt,
      width: 1024,
      height: 1024,
      n: 1,
      response_format: "url",
      negative_prompt: "photorealistic, photograph, 3d render, digital art, computer generated, low quality, blurry, distorted, text, words, letters, numbers",
    }),
  });

  if (!response.ok) {
    const statusCode = response.status;
    let errorText = "";
    
    try {
      const errorJson = await response.json();
      errorText = JSON.stringify(errorJson);
      console.error(`Together.ai API Error (${statusCode}):`, errorJson);
    } catch (e) {
      errorText = await response.text();
      console.error(`Together.ai API Error (${statusCode}):`, errorText);
    }
    
    if (statusCode === 401 || statusCode === 403) {
      throw new Error("API key is invalid or expired. Please check your API key.");
    } else if (statusCode === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (statusCode >= 500) {
      throw new Error("Together API server error. Please try again later.");
    }
    
    throw new Error(errorText || `HTTP Error: ${statusCode}`);
  }
  
  const data = await response.json();
  if (!data.data || !data.data[0] || !data.data[0].url) {
    throw new Error("Invalid API response format");
  }
  
  return data.data[0].url;
};

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================


/**
 * Enhanced AI image generation with multiple fallback APIs
 */
export const generateImageWithAI = async (userPrompt) => {
  console.log("Starting AI image generation...");
  console.log("User prompt:", userPrompt);
  
  const apiProviders = [
    // Prefer Gemini via SDK streaming (fast + high quality)
    { name: "GeminiSDK", generator: () => generateGeminiImageStream(userPrompt) },
    // Fallback to REST endpoint in case SDK fails / model not enabled
    { name: "Gemini", generator: () => generateImageWithGemini(userPrompt) },
    // Then Together.ai as a strong fallback
    { name: "Together.ai", generator: () => generateImageWithTogetherAI(userPrompt) },
  ];

  let lastError = null;
  
  for (const provider of apiProviders) {
    try {
      console.log(`Attempting image generation with ${provider.name}...`);
      const imageUrl = await provider.generator();
      
      if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("blob:") || imageUrl.startsWith("data:"))) {
        console.log(`✅ Image generated successfully with ${provider.name}`);
        return imageUrl;
      } else {
        throw new Error("Generated URL is invalid");
      }
    } catch (error) {
      lastError = error;
      console.error(`❌ ${provider.name} failed:`, error.message);
      
      if (error.message.includes("not configured")) {
        console.log(`⏭️ Skipping ${provider.name} - API key not configured`);
        continue;
      }
      
      if (provider.name === "Together.ai" && error.message.includes("Rate limit")) {
        console.log(`⏭️ Together.ai rate limited, trying next provider...`);
        continue;
      }
      
      await wait(1000);
    }
  }
  
  throw new Error(`Failed to generate image with all providers. Last error: ${lastError?.message || "Unknown error"}`);
};


// =============================================================================
// EXPORTS
// =============================================================================

export { retryOperation };

/**
 * Gemini Imagen 3 (Fast) Image Generation
 */
const generateImageWithGemini = async (userPrompt) => {
  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  const systemPrompt = "Hand-drawn art style, sketch, drawing, pencil sketch, artistic drawing, hand-drawn illustration, sketchy style, drawing art, hand-drawn design, artistic sketch, pencil drawing, hand-drawn artwork, sketchy illustration, drawing style, hand-drawn style, artistic drawing, sketch art, hand-drawn sketch, drawing illustration";
  const prompt = `${systemPrompt}, ${userPrompt}, 1024x1024, high quality, detailed, artistic, clean background, centered composition`;

  const body = {
    prompt: { text: prompt },
    // Hints used by Imagen 3 API; fields may vary by version
    negativePrompt: "photorealistic, photograph, 3d render, digital art, computer generated, low quality, blurry, distorted, text, words, letters, numbers, watermark",
    imageFormat: "png",
    width: 1024,
    height: 1024,
    // Safety & style controls can be added here when needed
  };

  const resp = await fetch(`${API_ENDPOINTS.GEMINI_IMAGEN3_FAST}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let errText = "";
    try { errText = await resp.text(); } catch {}
    throw new Error(`Gemini API error: ${resp.status} ${errText || ""}`);
  }

  const data = await resp.json();
  // Try common shapes for Imagen 3 responses
  let base64 = null;
  try {
    base64 = data?.images?.[0]?.image?.bytesBase64Encoded
      || data?.images?.[0]?.image?.base64
      || data?.images?.[0]?.base64
      || data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      || null;
  } catch {}

  if (!base64) {
    throw new Error("Gemini returned no image data");
  }

  // Return a data URL to be pinned by our IPFS route
  return `data:image/png;base64,${base64}`;
};
