import { NextResponse } from 'next/server';
import { CoinService } from '../../../../services/coinService';

export async function GET() {
  try {
    const stats = await CoinService.getCoinStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching coin stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch coin statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 