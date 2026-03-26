import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'agentcore test';

export async function GET() {
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(INSTANCE_NAME)}`,
      { headers: { apikey: EVOLUTION_API_KEY }, cache: 'no-store' }
    );
    const data = await res.json();
    // If already connected, data.instance.state === 'open' and no QR
    // If disconnected, data will have base64 QR and pairingCode
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get QR' }, { status: 500 });
  }
}
