// Script to LINERARIZE the workflow to fix item pairing
// Flow will be: Fields -> Log Incoming -> AI Agent
// And: Dividir mensaje -> Log AI Response -> WhatsApp Business Cloud

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
  console.log(`   Got: "${wf.name}" with ${wf.nodes.length} nodes`);

  // Ensure Log nodes have continueOnFail to avoid blocking
  const logIncoming = wf.nodes.find(n => n.name === 'Log Incoming to Supabase');
  if (logIncoming) {
    logIncoming.onError = 'continueErrorOutput';
    logIncoming.alwaysOutputData = true;
  }

  const logOutgoing = wf.nodes.find(n => n.name === 'Log AI Response to Supabase');
  if (logOutgoing) {
    logOutgoing.onError = 'continueErrorOutput';
    logOutgoing.alwaysOutputData = true;
  }

  // FIX CONNECTIONS: Linearize
  
  // 1. Fields -> Log Incoming -> AI Agent
  // Current: Fields -> [AI Agent, Log Incoming]
  // Update: Fields -> [Log Incoming], Log Incoming -> [AI Agent]
  
  // Clean Fields outputs
  wf.connections["Fields"].main[0] = [
    {
      node: "Log Incoming to Supabase",
      type: "main",
      index: 0
    }
  ];
  
  // Connect Log Incoming to AI Agent
  wf.connections["Log Incoming to Supabase"] = {
    main: [
      [
        {
          node: "AI Agent",
          type: "main",
          index: 0
        }
      ]
    ]
  };

  // 2. Dividir mensaje -> Log AI Response -> WhatsApp Business Cloud
  // Current: Dividir mensaje -> [WhatsApp Business Cloud, Log AI Response]
  // Update: Dividir mensaje -> [Log AI Response], Log AI Response -> [WhatsApp Business Cloud]
  
  // Clean Dividir mensaje outputs
  wf.connections["Dividir mensaje"].main[0] = [
    {
      node: "Log AI Response to Supabase",
      type: "main",
      index: 0
    }
  ];
  
  // Connect Log AI Response to WhatsApp Business Cloud
  wf.connections["Log AI Response to Supabase"] = {
    main: [
      [
        {
          node: "WhatsApp Business Cloud",
          type: "main",
          index: 0
        }
      ]
    ]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Updating workflow (Linear Flow)...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Linearized!`);
    await apiCall('POST', `/workflows/${WORKFLOW_ID}/activate`, {});
    console.log('   ✅ Workflow activated!');
  } else {
    console.log('   ❌ Error:', JSON.stringify(result).substring(0, 600));
  }
}

main().catch(console.error);
