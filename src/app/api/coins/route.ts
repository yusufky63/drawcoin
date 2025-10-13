import { NextRequest, NextResponse } from 'next/server';
import { CoinService } from '../../../services/coinService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category');
    const creator = searchParams.get('creator');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const params = {
      ...(category && { category }),
      ...(creator && { creator_address: creator }),
      ...(search && { search }),
      ...(limit && { limit: parseInt(limit) }),
      ...(offset && { offset: parseInt(offset) }),
    };

    const coins = await CoinService.getCoins(params);

    return NextResponse.json({
      success: true,
      data: coins,
      total: coins.length,
    });
  } catch (error) {
    console.error('Error fetching coins:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch coins',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'symbol', 'description', 'contract_address', 'image_url', 'category', 'creator_address', 'tx_hash'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          missingFields 
        },
        { status: 400 }
      );
    }

    // Check if coin already exists
    const existingCoin = await CoinService.coinExists(body.contract_address);
    if (existingCoin) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Coin with this contract address already exists' 
        },
        { status: 409 }
      );
    }

    const coin = await CoinService.saveCoin(body);

    if (!coin) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save coin' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: coin,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating coin:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create coin',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 