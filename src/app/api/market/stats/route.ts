import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { tokens } = await request.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ data: {} });
    }
    
    const { data, error } = await supabase
      .from('watchlists')
      .select('token_address')
      .in('token_address', tokens);

    if (error) {
      throw error;
    }

    // Group and count
    const counts: Record<string, number> = {};
    
    // Initialize all to 0
    tokens.forEach(t => counts[t] = 0);

    data?.forEach((item) => {
      const addr = item.token_address;
      counts[addr] = (counts[addr] || 0) + 1;
    });

    return NextResponse.json({ data: counts });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
