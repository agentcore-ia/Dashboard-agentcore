const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

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

const codeLogic = `
const staticData = $getWorkflowStaticData('global');
if (!staticData.lastOrders) staticData.lastOrders = {};

const now = new Date().getTime();

// Cleanup older than 15 mins
for (let key in staticData.lastOrders) {
  if (now - staticData.lastOrders[key] > 15 * 60 * 1000) {
    delete staticData.lastOrders[key];
  }
}

// Check current order
const val = $json.numero + "_" + $json.total; 
let isDuplicate = false;

if (staticData.lastOrders[val]) {
  isDuplicate = true;
} else {
  staticData.lastOrders[val] = now;
}

return [{
  json: {
    ...$json,
    is_duplicate: isDuplicate
  }
}];
`;

async function main() {
  const wfs = await apiCall('GET', '/workflows');
  const syncWfMeta = wfs.data.find(w => w.name.includes('Sync Order SubWorkflow (Webhook)'));
  
  if(!syncWfMeta) throw new Error("Workflow not found");
  
  const wf = await apiCall('GET', `/workflows/${syncWfMeta.id}`);

  // Create Deduplicator Code Node
  const codeNode = {
    parameters: {
      language: "javaScript",
      jsCode: codeLogic
    },
    name: "Deduplicate 15min",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [150, 200]
  };

  // Create If Node
  const ifNode = {
    parameters: {
      conditions: {
        boolean: [
          {
            value1: "={{ $json.is_duplicate }}",
            value2: false
          }
        ]
      }
    },
    name: "If Not Duplicate",
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: [350, 200]
  };

  // Only add if not already present
  if (!wf.nodes.find(n => n.name === 'Deduplicate 15min')) {
    wf.nodes.push(codeNode);
    wf.nodes.push(ifNode);

    // Get trigger connections
    const triggerOuts = wf.connections['Execute Workflow Trigger'] ? wf.connections['Execute Workflow Trigger'].main[0] : [];
    
    // Reroute trigger to deduplicator
    if (!wf.connections['Execute Workflow Trigger']) wf.connections['Execute Workflow Trigger'] = { main: [[]] };
    wf.connections['Execute Workflow Trigger'].main[0] = [{ "node": "Deduplicate 15min", "type": "main", "index": 0 }];

    // Route Deduplicator to If Node
    wf.connections['Deduplicate 15min'] = { main: [[{ "node": "If Not Duplicate", "type": "main", "index": 0 }]] };

    // Route If Node (True) to whatever the Trigger used to connect to
    wf.connections['If Not Duplicate'] = { main: [ triggerOuts, [] ] }; // Index 0 is true, Index 1 is false (empty)
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${syncWfMeta.id}`, payload);
  if (result.id) {
    console.log(`✅ N8N Webhook Debounce protection installed successfully!`);
  } else {
    console.error('❌ Error updating workflow:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
