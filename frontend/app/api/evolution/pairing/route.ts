import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const INSTANCE_TOKEN    = process.env.EVOLUTION_INSTANCE_TOKEN || '465E65D048F8-42B4-B162-4CF3107E70D8';
const INSTANCE_NAME     = process.env.EVOLUTION_INSTANCE_NAME  || 'agentcore test';

export async function POST(req: Request) {
  try {
    const { number } = await req.json();
    if (!number) return NextResponse.json({ error: 'number required' }, { status: 400 });

    const cleanNumber = number.replace(/\D/g, '');
    
    // 1. Update instance settings to prefer Pairing Code
    const updateUrl = `${EVOLUTION_API_URL}/instance/update/${encodeURIComponent(INSTANCE_NAME)}`;
    console.log('Enabling Pairing Code mode in settings:', updateUrl);
    
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': INSTANCE_TOKEN 
      },
      body: JSON.stringify({ 
        "integration": "whatsapp",
        "pairingCode": true 
      })
    }).catch(() => {});

    // 2. Request pairing code
    const connectUrl = `${EVOLUTION_API_URL}/instance/connect/${encodeURIComponent(INSTANCE_NAME)}?number=${cleanNumber}`;
    console.log('Connecting with pairing number:', connectUrl);

    const res = await fetch(connectUrl, {
      method: 'GET',
      headers: { apikey: INSTANCE_TOKEN },
      cache: 'no-store',
    });
    
    let data = await res.json();
    
    // 3. Fallback: If pairingCode is still null, try the specific pairingCode endpoint
    if (!data.pairingCode && !data.code) {
       const fallbackUrl = `${EVOLUTION_API_URL}/instance/pairingCode/${encodeURIComponent(INSTANCE_NAME)}?number=${cleanNumber}`;
       console.log('Fallback to pairingCode endpoint:', fallbackUrl);
       const fres = await fetch(fallbackUrl, {
         method: 'GET',
         headers: { apikey: INSTANCE_TOKEN },
         cache: 'no-store',
       });
       const fdata = await fres.json();
       if (fdata.code || fdata.pairingCode) data = fdata;
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to get pairing code' }, { status: 500 });
  }
}
