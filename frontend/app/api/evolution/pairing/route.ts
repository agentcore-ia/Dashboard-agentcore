import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const GLOBAL_API_KEY    = process.env.EVOLUTION_API_KEY  || '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_TOKEN    = process.env.EVOLUTION_INSTANCE_TOKEN || '465E65D048F8-42B4-B162-4CF3107E70D8';
const INSTANCE_NAME     = process.env.EVOLUTION_INSTANCE_NAME  || 'agentcore test';

export async function POST(req: Request) {
  try {
    const { number } = await req.json();
    if (!number) return NextResponse.json({ error: 'number required' }, { status: 400 });

    const url = `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(INSTANCE_NAME)}?number=${encodeURIComponent(number)}`;
    console.log('Fetching Pairing Code from:', url);

    // Request pairing code from Evolution API
    const res = await fetch(url, {
        method: 'GET',
        headers: { apikey: INSTANCE_TOKEN },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    console.log('Evolution API Response:', data);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get pairing code' }, { status: 500 });
  }
}
