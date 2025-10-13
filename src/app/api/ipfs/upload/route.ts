import { NextRequest, NextResponse } from 'next/server';
import { processImageAndUploadToIPFS } from '../../../../services/imageUtils';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  });
}

export async function POST(request: NextRequest) {
  try {
    // Parse JSON request body
    const data = await request.json();
    const { imageUrl, name, symbol, description } = data;
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log("⬆️ IPFS Upload requested:", {
      imageUrl: typeof imageUrl === 'string' ? `${imageUrl.substring(0, 30)}...` : 'Invalid URL',
      name,
      symbol
    });
    
    // Process the image and upload it to IPFS
    const { ipfsUrl, displayUrl } = await processImageAndUploadToIPFS(imageUrl, name, symbol, description);
    
    console.log("✅ IPFS Upload successful:", {
      ipfsUrl,
      displayUrl: displayUrl || 'No display URL'
    });
    
    // Return the IPFS URL and HTTP gateway URL for display
    return NextResponse.json({
      ipfsUrl,
      displayUrl,
      success: true
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error("❌ IPFS Upload error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error during IPFS upload";
      
    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500, headers: corsHeaders }
    );
  }
} 