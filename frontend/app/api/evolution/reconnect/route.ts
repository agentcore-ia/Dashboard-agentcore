import { NextResponse } from 'next/server';

const EVOLUTION_API_URL  = process.env.EVOLUTION_API_URL       || 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const GLOBAL_API_KEY     = process.env.EVOLUTION_API_KEY        || '429683C4C977415CAAFCCE10F7D57E11';
// INSTANCE TOKEN for connect/QR endpoints (what Evolution Manager uses)
const INSTANCE_TOKEN     = process.env.EVOLUTION_INSTANCE_TOKEN || '465E65D048F8-42B4-B162-4CF3107E70D8';
const INSTANCE_NAME      = process.env.EVOLUTION_INSTANCE_NAME  || 'agentcore test';
const INSTANCE_ID        = process.env.EVOLUTION_INSTANCE_ID    || '93ff69ee-e4b3-445f-bc1b-73a6315e0cf9';

const baseUrl = `${EVOLUTION_API_URL}/instance`;
const name = encodeURIComponent(INSTANCE_NAME);

export async function POST() {
  try {
    // Step 1: Restart the instance (clean state) using global key
    await fetch(`${baseUrl}/restart/${name}`, {
      method: 'PUT',
      headers: { apikey: GLOBAL_API_KEY, 'Content-Type': 'application/json' },
      cache: 'no-store',
    }).catch(() => {});

    // Step 2: Wait for restart
    await new Promise(r => setTimeout(r, 2500));

    // Step 3: Get QR using INSTANCE TOKEN (matching exactly what Evolution Manager does)
    const res = await fetch(`${baseUrl}/connect/${name}`, {
      headers: { apikey: INSTANCE_TOKEN },
      cache: 'no-store',
    });
    const data = await res.json();

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reconnect' }, { status: 500 });
  }
}
