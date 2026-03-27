import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'agentcore test';

const headers = { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' };
const baseUrl = `${EVOLUTION_API_URL}/instance`;
const name = encodeURIComponent(INSTANCE_NAME);

export async function POST() {
  try {
    // Step 1: Logout to clear any stale session
    await fetch(`${baseUrl}/logout/${name}`, { method: 'DELETE', headers, cache: 'no-store' })
      .catch(() => {}); // ignore if already disconnected

    // Step 2: Wait for logout to propagate
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Call connect to get a brand new QR (count should be 1)
    const res = await fetch(`${baseUrl}/connect/${name}`, { headers, cache: 'no-store' });
    const data = await res.json();

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reconnect' }, { status: 500 });
  }
}
