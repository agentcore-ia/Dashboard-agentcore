const EVO_URL = 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const GLOBAL_KEY = '429683C4C977415CAAFCCE10F7D57E11'; // Correct global key from .env
const INSTANCE_NAME = 'agentcore test';
const INSTANCE_TOKEN = '465E65D048F8-42B4-B162-4CF3107E70D8';

async function resetInstance() {
  console.log(`Resetting instance: ${INSTANCE_NAME}...`);
  
  // 1. Delete instance
  try {
    const delRes = await fetch(`${EVO_URL}/instance/delete/${encodeURIComponent(INSTANCE_NAME)}`, {
      method: 'DELETE',
      headers: { apikey: GLOBAL_KEY }
    });
    console.log('Delete response:', await delRes.json());
  } catch (e) {
    console.log('Delete failed (maybe it didnt exist):', e.message);
  }

  // 2. Create instance
  try {
    const createRes = await fetch(`${EVO_URL}/instance/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': GLOBAL_KEY 
      },
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        token: INSTANCE_TOKEN,
        qrcode: true,
        pairingCode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });
    console.log('Create response:', await createRes.json());
  } catch (e) {
    console.error('Create failed:', e);
  }
}

resetInstance();
