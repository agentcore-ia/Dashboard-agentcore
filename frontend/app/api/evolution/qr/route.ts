import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://agentcore-evolution-api.8zp1cp.easypanel.host';

// IMPORTANT: Use the INSTANCE TOKEN (not global key) for /instance/connect
// This is how the Evolution API Manager does it and is required for valid QR generation
const INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN || '465E65D048F8-42B4-B162-4CF3107E70D8';
const INSTANCE_NAME  = process.env.EVOLUTION_INSTANCE_NAME  || 'agentcore';

export async function GET() {
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(INSTANCE_NAME)}`,
      {
        headers: { apikey: INSTANCE_TOKEN },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get QR' }, { status: 500 });
  }
}
