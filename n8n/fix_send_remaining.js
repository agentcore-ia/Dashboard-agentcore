const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

function apiCall(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const options = {
      method, hostname: url.hostname, path: url.pathname,
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let body = ''; res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); } });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Fixed Code: no sleep (causes timeout), correct httpRequest format
const SEND_PARTS_CODE = `
const EVOLUTION_URL = "https://agentcore-evolution-api.8zp1cp.easypanel.host/message/sendText/agentcore%20test";
const EVOLUTION_KEY = "465E65D048F8-42B4-B162-4CF3107E70D8";

const remoteJid = $node["WhatsApp Trigger"].json.body.data.key.remoteJid;
const resp = $node["Dividir mensaje"].json.output.response;

const parts = [resp.part_2, resp.part_3, resp.part_4]
  .filter(p => p && p.trim().length > 0);

for (const text of parts) {
  await $helpers.httpRequest({
    method: "POST",
    url: EVOLUTION_URL,
    headers: { "apikey": EVOLUTION_KEY },
    body: { number: remoteJid, text },
    json: true
  });
}

return [{ json: { sent: parts.length + 1 } }];
`;

async function main() {
  const wfs = await apiCall('GET', '/workflows');
  const meta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  const wf = await apiCall('GET', `/workflows/${meta.id}`);

  const node = wf.nodes.find(n => n.name === 'Send Remaining Parts');
  if (!node) throw new Error("'Send Remaining Parts' node not found");
  
  node.parameters.jsCode = SEND_PARTS_CODE;
  console.log("✅ Updated 'Send Remaining Parts' - removed sleep, fixed httpRequest format");

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: "v1" } };
  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('✅ Done!');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
