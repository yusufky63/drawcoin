import { NextRequest, NextResponse } from "next/server";
import { generateImageWithAI } from "../../../services/aiService";


// CORS headers - izin verilen kaynaklar
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Bu '*' tüm kaynaklara izin verir, production'da daha kısıtlayıcı olmalı
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};


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
    const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
    console.log("API key exists:", !!TOGETHER_API_KEY);
    console.log(
      "API key first few chars:",
      TOGETHER_API_KEY ? TOGETHER_API_KEY.substring(0, 3) + "..." : "null"
    );

    if (!TOGETHER_API_KEY) {
      console.error("❌ Missing API key in environment variables");
      return NextResponse.json(
        { error: "Missing API key in environment variables" },
        { status: 500, headers: baseHeaders }
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

    const { action, description, userAddress } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action parameter required (text or image)" },
        { status: 400, headers: baseHeaders }
      );
    }

    console.log(`🎬 Processing ${action} action`);

    if (action === "image") {
      console.log("🖼️ Image generation requested");

      // Check AI limits if userAddress is provided
      if (userAddress) {
        try {
          const { supabaseAdmin } = await import("../../../lib/supabase");

          if (supabaseAdmin) {
            const { data: user } = await supabaseAdmin
              .from("users")
              .select("daily_ai_usage, last_reset_date")
              .eq("address", userAddress)
              .single();

            const now = new Date();
            const DAILY_LIMIT = 3; // ✅ Changed from 5 to 3

            if (user && user.last_reset_date) {
              const lastReset = new Date(user.last_reset_date);

              // Check if we need to reset (different day)
              const isDifferentDay =
                lastReset.getDate() !== now.getDate() ||
                lastReset.getMonth() !== now.getMonth() ||
                lastReset.getFullYear() !== now.getFullYear();

              if (isDifferentDay) {
                // ✅ Reset: Start fresh with usage = 1 and update reset date
                await supabaseAdmin
                  .from("users")
                  .update({
                    daily_ai_usage: 1,
                    last_reset_date: now.toISOString(),
                  })
                  .eq("address", userAddress);
              } else {
                // Same day - check limit
                const currentUsage = user.daily_ai_usage || 0;

                if (currentUsage >= DAILY_LIMIT) {
                  // Calculate time until next reset (midnight)
                  const tomorrow = new Date(now);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(0, 0, 0, 0);
                  const hoursUntilReset = Math.ceil(
                    (tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60)
                  );

                  return NextResponse.json(
                    {
                      error: `Daily AI draw limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Please try again in ${hoursUntilReset} hours.`,
                      resetTime: tomorrow.toISOString(),
                      hoursUntilReset,
                    },
                    { status: 429, headers: baseHeaders }
                  );
                }

                // ✅ Increment usage - DO NOT update last_reset_date
                await supabaseAdmin
                  .from("users")
                  .update({
                    daily_ai_usage: currentUsage + 1,
                  })
                  .eq("address", userAddress);
              }
            } else {
              // Create user record if not exists
              await supabaseAdmin.from("users").upsert({
                address: userAddress,
                daily_ai_usage: 1,
                last_reset_date: now.toISOString(),
              });
            }
          }
        } catch (limitError) {
          console.error("Error checking AI limits:", limitError);
          // Continue even if limit check fails, to avoid blocking users due to DB errors
        }
      }

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
