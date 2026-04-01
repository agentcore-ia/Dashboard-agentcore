const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";
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

  // Remove all old debounce check nodes
  wf.nodes = wf.nodes.filter(n => 
    n.name !== 'Debounce Check' &&
    n.name !== 'Check Last Message' && 
    n.name !== 'Get Recent Messages' &&
    n.name !== 'Count Recent Messages' &&
    n.name !== 'Is Last Message'
  );

  // Position reference
  const waitNode = wf.nodes.find(n => n.name === 'Debounce Wait');
  const pos = waitNode ? waitNode.position : [-13408, 304];

  // ── STRATEGY: Compare WA message IDs ─────────────────────────────────────
  // 1. HTTP GET: last customer message in this conversation (order by created_at DESC limit 1)
  // 2. Code node: compare wa_message_id of that latest message with 
  //    $('WhatsApp Trigger').first().json.body.data.key.id
  //    If they match → this execution IS the last message → true
  //    If not → an older message is checking, skip it → false
  //
  // This is more reliable than time-based queries because:
  //   - No timestamp encoding issues
  //   - No timezone problems
  //   - Works even if Wait runs a little slower than expected
  // ─────────────────────────────────────────────────────────────────────────

  const HTTP_NAME = 'Get Latest Message';
  const httpNode = {
    "id": "http-get-latest-msg",
    "name": HTTP_NAME,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [pos[0] + 320, pos[1]],
    "alwaysOutputData": true,
    "parameters": {
      "method": "GET",
      "url": `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&select=id,wa_message_id,created_at&order=created_at.desc&limit=1`,
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          { "name": "apikey", "value": SUPABASE_ANON_KEY },
          { "name": "Content-Type", "value": "application/json" }
        ]
      },
      "options": {}
    }
  };

  // Code node: compare IDs
  const CODE_NAME = 'Check Is Last Message';
  const codeNode = {
    "id": "code-check-is-last-msg",
    "name": CODE_NAME,
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [pos[0] + 640, pos[1]],
    "parameters": {
      "mode": "runOnceForAllItems",
      "jsCode": `
// The HTTP node returns a single item: the most recent customer message in this convo.
// We compare its wa_message_id with the current WhatsApp message being processed.

const latestItem = items[0];
const latestWaId = latestItem?.json?.wa_message_id || null;

// Current message WA ID from the webhook trigger
const currentWaId = $('WhatsApp Trigger').first().json.body.data.key.id;

// If the latest message in DB == current message -> we are the last -> proceed
const isLastMessage = (latestWaId === currentWaId) || (latestWaId === null);

return [{ 
  json: { 
    isLastMessage,
    latestWaId,
    currentWaId,
    match: latestWaId === currentWaId
  } 
}];
`
    }
  };

  // IF node
  const IF_NAME = 'Is Last Message';
  const ifNode = {
    "id": "if-is-last-msg-v4",
    "name": IF_NAME,
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [pos[0] + 960, pos[1]],
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
            "id": "if-last-v4",
            "leftValue": "={{ $json.isLastMessage }}",
            "rightValue": true,
            "operator": {
              "type": "boolean",
              "operation": "true",
              "singleValue": true
            }
          }
        ],
        "combinator": "and"
      },
      "options": {}
    }
  };

  wf.nodes.push(httpNode, codeNode, ifNode);

  // Update connections
  wf.connections['Debounce Wait'] = {
    "main": [[{ "node": HTTP_NAME, "type": "main", "index": 0 }]]
  };
  wf.connections[HTTP_NAME] = {
    "main": [[{ "node": CODE_NAME, "type": "main", "index": 0 }]]
  };
  wf.connections[CODE_NAME] = {
    "main": [[{ "node": IF_NAME, "type": "main", "index": 0 }]]
  };
  wf.connections[IF_NAME] = {
    "main": [
      [{ "node": "Check AI Active", "type": "main", "index": 0 }],
      []
    ]
  };

  // Clean stale
  delete wf.connections['Debounce Check'];
  delete wf.connections['Check Last Message'];
  delete wf.connections['Get Recent Messages'];
  delete wf.connections['Count Recent Messages'];

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Done! New flow: Wait → GET latest msg → Code(compare IDs) → IF → AI`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
