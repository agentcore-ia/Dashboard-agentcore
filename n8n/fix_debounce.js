const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";
const SUPABASE_URL = "https://eqnjyygokjinmsfvogxi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE";

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

  // Check what already exists
  const existingNames = wf.nodes.map(n => n.name);
  console.log('   Existing nodes:', existingNames.join(', '));

  // Step 1: Add Wait node (4 seconds) 
  const WAIT_NODE_NAME = 'Debounce Wait';
  const CHECK_NODE_NAME = 'Check Last Message';

  // Remove old debounce nodes if they exist (for idempotency)
  wf.nodes = wf.nodes.filter(n => n.name !== WAIT_NODE_NAME && n.name !== CHECK_NODE_NAME);

  // Get position of "Log Incoming to Supabase" for layout reference
  const logNode = wf.nodes.find(n => n.name === 'Log Incoming to Supabase');
  const logPos = logNode ? logNode.position : [-14048, 304];
  const x = logPos[0];
  const y = logPos[1];

  // Add Wait node (4 seconds debounce)
  const waitNode = {
    "parameters": {
      "resume": "timeInterval",
      "amount": 4,
      "unit": "seconds"
    },
    "type": "n8n-nodes-base.wait",
    "typeVersion": 1.1,
    "position": [x + 320, y],
    "id": "debounce-wait-node",
    "name": WAIT_NODE_NAME,
    "webhookId": "debounce-wait-webhook"
  };

  // Add "Check Last Message" HTTP node — queries Supabase to detect if a newer message exists
  // from the same conversation within the last 5 seconds.
  // If count > 1 → not the last message → skip AI (route to FALSE)
  // If count === 1 → only message → route to TRUE (proceed to Check AI Active)
  //
  // Query: GET /rest/v1/mensajes?conversacion_id=eq.{conv_id}&sender=eq.customer&created_at=gte.{5s_ago}&select=id
  const checkNode = {
    "parameters": {
      "method": "GET",
      "url": `=${SUPABASE_URL}/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&created_at=gte.{{ $now.minus(6000).toISO() }}&select=id&order=created_at.desc`,
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          { "name": "apikey", "value": SUPABASE_ANON_KEY },
          { "name": "Content-Type", "value": "application/json" }
        ]
      },
      "options": {}
    },
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [x + 640, y],
    "id": "check-last-message-node",
    "name": CHECK_NODE_NAME,
    "alwaysOutputData": true
  };

  // Add IF node: is count === 1?
  const IS_LAST_NODE_NAME = 'Is Last Message';
  wf.nodes = wf.nodes.filter(n => n.name !== IS_LAST_NODE_NAME);

  const isLastNode = {
    "parameters": {
      "conditions": {
        "options": {
          "caseSensitive": true,
          "leftValue": "",
          "typeValidation": "strict",
          "version": 2
        },
        "conditions": [
          {
            "id": "is-last-cond",
            "leftValue": "={{ $json.length }}",
            "rightValue": 1,
            "operator": {
              "type": "number",
              "operation": "lte"
            }
          }
        ],
        "combinator": "and"
      },
      "options": {}
    },
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [x + 960, y],
    "id": "is-last-message-node",
    "name": IS_LAST_NODE_NAME
  };

  wf.nodes.push(waitNode, checkNode, isLastNode);

  // Now wire up connections:
  // Old: Log Incoming to Supabase → Check AI Active
  // New: Log Incoming to Supabase → Debounce Wait → Check Last Message → Is Last Message
  //        TRUE (last) → Check AI Active
  //        FALSE (not last) → [nothing / terminate]

  // Update connection from "Log Incoming to Supabase"
  wf.connections['Log Incoming to Supabase'] = {
    "main": [
      [
        { "node": WAIT_NODE_NAME, "type": "main", "index": 0 }
      ]
    ]
  };

  // Wait → Check Last Message
  wf.connections[WAIT_NODE_NAME] = {
    "main": [
      [
        { "node": CHECK_NODE_NAME, "type": "main", "index": 0 }
      ]
    ]
  };

  // Check Last Message → Is Last Message
  wf.connections[CHECK_NODE_NAME] = {
    "main": [
      [
        { "node": IS_LAST_NODE_NAME, "type": "main", "index": 0 }
      ]
    ]
  };

  // Is Last Message: TRUE → Check AI Active, FALSE → nothing (stop)
  wf.connections[IS_LAST_NODE_NAME] = {
    "main": [
      [
        { "node": "Check AI Active", "type": "main", "index": 0 }
      ],
      [] // FALSE branch: terminate, no response
    ]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing updated workflow...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Debounce logic applied! Nodes added: "${WAIT_NODE_NAME}", "${CHECK_NODE_NAME}", "${IS_LAST_NODE_NAME}"`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
