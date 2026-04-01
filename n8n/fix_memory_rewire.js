const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";

function apiCall(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('1. Fetching workflow...');
  const wf = await apiCall('GET', `/workflows/${WORKFLOW_ID}`);

  // Position reference for Memory nodes
  const logNode = wf.nodes.find(n => n.name === 'Log Incoming to Supabase');
  const lx = logNode ? logNode.position[0] : -14048;
  const ly = logNode ? logNode.position[1] : 304;

  const mmNode = wf.nodes.find(n => n.name === 'Memory Manager');
  if (mmNode) mmNode.position = [lx + 320, ly - 100];

  const ifNode = wf.nodes.find(n => n.name === 'If Clear Command');
  if (ifNode) ifNode.position = [lx + 640, ly - 100];

  const waNode = wf.nodes.find(n => n.name === 'WABA Confirm Clear');
  if (waNode) waNode.position = [lx + 960, ly - 200];

  // 1. RE-CONNECT original start
  wf.connections['WhatsApp Trigger'] = {
    "main": [[{ "node": "Google Sheets", "type": "main", "index": 0 }]]
  };

  // 2. CONNECT Log Incoming to Supabase -> Memory Manager
  wf.connections['Log Incoming to Supabase'] = {
    "main": [[{ "node": "Memory Manager", "type": "main", "index": 0 }]]
  };

  // 3. CONNECT Memory Manager -> If Clear Command
  wf.connections['Memory Manager'] = {
    "main": [[{ "node": "If Clear Command", "type": "main", "index": 0 }]]
  };

  // 4. CONNECT If Clear Command:
  //    TRUE  -> WABA Confirm Clear
  //    FALSE -> Debounce Wait (resume AI flow)
  wf.connections['If Clear Command'] = {
    "main": [
      [{ "node": "WABA Confirm Clear", "type": "main", "index": 0 }],
      [{ "node": "Debounce Wait", "type": "main", "index": 0 }]
    ]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing rewiring correction...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Rewired! Flow: Trigger -> ... -> Log -> MemoryMgr -> (If /clear -> OK, Else -> Debounce -> AI)`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
