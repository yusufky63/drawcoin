import { NextRequest, NextResponse } from "next/server";
import {
  generateImageWithAI,
} from "../../../services/aiService";

// Rate limiting variables
const apiCalls = new Map<string, { count: number; lastReset: number }>();
const MAX_CALLS_PER_MINUTE = 10; // Increase rate limit
const MINUTE = 60 * 1000;

// Timeout for API requests
const API_TIMEOUT = 60000; // 60 seconds (1 dakika)

// CORS headers - izin verilen kaynaklar
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Bu '*' tüm kaynaklara izin verir, production'da daha kısıtlayıcı olmalı
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// Helper function to handle timeouts
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  }) as Promise<T>;
};

// Rate limiting function
function isRateLimited(action: string): boolean {
  const now = Date.now();
  const key = action;

  if (!apiCalls.has(key)) {
    apiCalls.set(key, { count: 1, lastReset: now });
    return false;
  }

  const record = apiCalls.get(key)!;

  // Reset counter if a minute has passed
  if (now - record.lastReset > MINUTE) {
    record.count = 1;
    record.lastReset = now;
    return false;
  }

  // Check if rate limit exceeded
  if (record.count >= MAX_CALLS_PER_MINUTE) {
    return true;
  }

  // Increment count
  record.count++;
  return false;
}


// OPTIONS method handler for CORS preflight requests
export async function OPTIONS() {
  console.log("Handling OPTIONS request for CORS preflight");
  return new NextResponse(null, {
    status: 204, // No content
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  console.log("🔄 AI API route called");

  try {
    // Add CORS headers to all responses
    const baseHeaders = { ...corsHeaders };

    // Get API key
    const TOGETHER_API_KEY = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
    console.log("API key exists:", !!TOGETHER_API_KEY);
    console.log(
      "API key first few chars:",
      TOGETHER_API_KEY ? TOGETHER_API_KEY.substring(0, 3) + "..." : "null"
    );

    if (!TOGETHER_API_KEY) {
      console.error("❌ Missing API key in environment variables");

      // Attempt to use fallback mockup data
      return NextResponse.json(
        {
          error: "API key missing. Using fallback data.",
          name: "RetroToken",
          symbol: "RTK",
          description:
            "A throwback token with retro styling features for the cryptocurrency enthusiasts who appreciate classic aesthetics.",
        },
        { status: 200, headers: baseHeaders }
      );
    }

    // Parse body
    let body;
    try {
      body = await request.json();
      console.log("📦 Request body:", body);
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400, headers: baseHeaders }
      );
    }

    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400, headers: baseHeaders }
      );
    }

    const { action, description } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter required (text or image)" },
        { status: 400, headers: baseHeaders }
      );
    }

    console.log(`🎬 Processing ${action} action`);

    // Rate limiting kaldırıldı - daha esnek istek yönetimi için
    // if (isRateLimited(action)) {
    //   console.warn("⚠️ Rate limit exceeded for action:", action);
    //   return NextResponse.json(
    //     { error: "Rate limit exceeded. Please try again later." },
    //     { status: 429, headers: baseHeaders }
    //   );
    // }

    if (action === "image") {
      console.log("🖼️ Image generation requested");
      try {
        if (!description) {
          return NextResponse.json(
            { error: "Description parameter required for image generation" },
            { status: 400, headers: baseHeaders }
          );
        }

        console.log("🔄 Starting image generation with prompt:", description);

        // Generate image with AI using user prompt directly
        const result = await generateImageWithAI(description);

        console.log("✅ Image generation result:", result);

        // Verify result is a proper string
        if (!result || typeof result !== "string") {
          throw new Error("Invalid image URL returned from generation service");
        }

        // Simply return the image URL without any processing
        // Let the client handle it directly without proxies
        return NextResponse.json(
          { imageUrl: result },
          { headers: baseHeaders }
        );
      } catch (imageError) {
        console.error("❌ Image generation error:", imageError);

        // Provide more detailed error based on type
        const errorMessage =
          imageError instanceof Error
            ? imageError.message
            : "Unknown error during image generation";

        // Check for specific error types to provide better user feedback
        const userFriendlyMessage = errorMessage.includes("timed out")
          ? "The image generation service took too long to respond. Please try again."
          : `Image generation failed: ${errorMessage}`;

        return NextResponse.json(
          { error: userFriendlyMessage },
          {
            status: errorMessage.includes("timed out") ? 504 : 500,
            headers: baseHeaders,
          }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid action value (must be image)" },
        { status: 400, headers: baseHeaders }
      );
    }
  } catch (error) {
    console.error("❌ AI service error:", error);

    // Provide detailed error message with status code
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during API processing";

    return NextResponse.json(
      { error: `An error occurred: ${errorMessage}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
