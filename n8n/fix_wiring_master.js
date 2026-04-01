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

  // FIX ALL MISS-WIRED CONNECTIONS MANUALLY DONE BY USER
  // Correct Flow:
  // WhatsApp Trigger -> Google Sheets -> Switch1 ... -> Fields
  // Fields -> Log Incoming to Supabase
  // Log Incoming to Supabase -> Memory Manager
  // Memory Manager -> If Clear Command
  // If Clear Command (true) -> WABA Confirm Clear
  // If Clear Command (false) -> Debounce Wait
  // Debounce Wait -> Check AI Active
  // Check AI Active (true) -> Get Latest Message
  // Get Latest Message -> Check Is Last Message
  // Check Is Last Message -> Is Last Message
  // Is Last Message (true) -> AI Agent
  // AI Agent -> AI Correctotr

  // 1. Log Incoming to Supabase -> Memory Manager OK
  wf.connections['Log Incoming to Supabase'] = {
    "main": [[{ "node": "Memory Manager", "type": "main", "index": 0 }]]
  };

  // 2. Memory Manager -> If Clear Command OK
  wf.connections['Memory Manager'] = {
    "main": [[{ "node": "If Clear Command", "type": "main", "index": 0 }]]
  };

  // 3. If Clear Command -> Debounce Wait (false)
  wf.connections['If Clear Command'] = {
    "main": [
      [{ "node": "WABA Confirm Clear", "type": "main", "index": 0 }], // TRUE branch
      [{ "node": "Debounce Wait", "type": "main", "index": 0 }]  // FALSE branch
    ]
  };

  // 4. Debounce Wait -> Check AI Active
  wf.connections['Debounce Wait'] = {
    "main": [[{ "node": "Check AI Active", "type": "main", "index": 0 }]]
  };

  // 5. Check AI Active -> Get Latest Message
  wf.connections['Check AI Active'] = {
    "main": [[{ "node": "Get Latest Message", "type": "main", "index": 0 }]]
  };

  // 6. Get Latest Message -> Check Is Last Message
  wf.connections['Get Latest Message'] = {
    "main": [[{ "node": "Check Is Last Message", "type": "main", "index": 0 }]]
  };

  // 7. Check Is Last Message -> Is Last Message
  wf.connections['Check Is Last Message'] = {
    "main": [[{ "node": "Is Last Message", "type": "main", "index": 0 }]]
  };

  // 8. Is Last Message (true) -> AI Agent
  wf.connections['Is Last Message'] = {
    "main": [
      [{ "node": "AI Agent", "type": "main", "index": 0 }], // TRUE branch
      [] // FALSE branch (stop)
    ]
  };

  // 9. Fix AI Agent -> AI Corrector
  wf.connections['AI Agent'] = {
    "main": [[{ "node": "AI Correctotr", "type": "main", "index": 0 }]]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing Master Wiring...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Master Wiring restored and fixed.`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
