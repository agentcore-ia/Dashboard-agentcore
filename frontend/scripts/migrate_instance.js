
const EVO_URL = 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const GLOBAL_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const NEW_NAME = 'agentcore';
const TOKEN = '465E65D048F8-42B4-B162-4CF3107E70D8';

async function migrate() {
  console.log("Migrating to a clean, no-space instance name...");
  
  // Cleanup any old instances (logout first to clear session)
  for (const name of [NEW_NAME, 'agentcore test']) {
     console.log(`Cleaning up: ${name}...`);
     await fetch(`${EVO_URL}/instance/logout/${encodeURIComponent(name)}`, { 
        method: 'POST', headers: { apikey: GLOBAL_KEY } }).catch(() => {});
     await fetch(`${EVO_URL}/instance/delete/${encodeURIComponent(name)}`, { 
        method: 'DELETE', headers: { apikey: GLOBAL_KEY } }).catch(() => {});
  }

  // 3. Create fresh with STABLE WEB_VERSION
  const res = await fetch(`${EVO_URL}/instance/create`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'apikey': GLOBAL_KEY 
    },
    body: JSON.stringify({
      instanceName: NEW_NAME,
      token: TOKEN,
      qrcode: true,
      pairingCode: true,
      integration: 'WHATSAPP-BAILEYS',
      config: {
        webVersion: '2.3000.1017835105' // Stable version that often fixes scan issues
      }
    })
  });
  
  console.log('Migration response:', await res.json());
}

migrate();
