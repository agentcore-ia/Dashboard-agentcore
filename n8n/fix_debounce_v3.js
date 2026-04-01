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

  // Remove old problematic nodes
  wf.nodes = wf.nodes.filter(n => 
    n.name !== 'Debounce Check' &&
    n.name !== 'Check Last Message' && 
    n.name !== 'Is Last Message'
  );

  // Find position of Debounce Wait node
  const waitNode = wf.nodes.find(n => n.name === 'Debounce Wait');
  const pos = waitNode ? waitNode.position : [-13408, 304];

  // ── NODE 1: HTTP Request to get recent messages from Supabase ─────────────
  // Returns an array of message objects; N8N outputs 1 item per object.
  // We'll use alwaysOutputData so even 0 results returns 1 empty item.
  const HTTP_CHECK_NAME = 'Get Recent Messages';
  const httpCheckNode = {
    "id": "http-get-recent-msgs",
    "name": HTTP_CHECK_NAME,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [pos[0] + 320, pos[1]],
    "alwaysOutputData": true,
    "parameters": {
      "method": "GET",
      "url": `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&created_at=gte.{{ $now.minus(6000).toISO() }}&select=id&order=created_at.desc&limit=5`,
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          { "name": "apikey", "value": SUPABASE_ANON_KEY },
          { "name": "Content-Type", "value": "application/json" }
        ]
      },
      "options": {
        "response": {
          "response": {
            "responseFormat": "json"
          }
        }
      }
    }
  };

  // ── NODE 2: Code node — counts all input items, returns isLastMessage ─────
  // N8N HTTP Request outputs 1 item per array element.
  // We run this Code node "Once for all items" to count them.
  const COUNT_CHECK_NAME = 'Count Recent Messages';
  const countCheckNode = {
    "id": "count-recent-msgs",
    "name": COUNT_CHECK_NAME,
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [pos[0] + 640, pos[1]],
    "parameters": {
      "mode": "runOnceForAllItems",
      "jsCode": `
// items[] contains one entry per recent message returned by Supabase.
// If items has 1 or 0 entries → we are the last/only message → proceed to AI.
// If items has 2+ entries → another message exists after ours → skip AI.

// Also handle the alwaysOutputData case where it might return empty object
const validMessages = items.filter(item => item.json && item.json.id);
const count = validMessages.length;

return [{ json: { isLastMessage: count <= 1, messageCount: count } }];
`
    }
  };

  // ── NODE 3: IF node — clean boolean check ─────────────────────────────────
  const IS_LAST_NAME = 'Is Last Message';
  const isLastNode = {
    "id": "is-last-msg-v3",
    "name": IS_LAST_NAME,
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
            "id": "is-last-check-v3",
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

  wf.nodes.push(httpCheckNode, countCheckNode, isLastNode);

  // Wire connections
  wf.connections['Debounce Wait'] = {
    "main": [[{ "node": HTTP_CHECK_NAME, "type": "main", "index": 0 }]]
  };
  wf.connections[HTTP_CHECK_NAME] = {
    "main": [[{ "node": COUNT_CHECK_NAME, "type": "main", "index": 0 }]]
  };
  wf.connections[COUNT_CHECK_NAME] = {
    "main": [[{ "node": IS_LAST_NAME, "type": "main", "index": 0 }]]
  };
  wf.connections[IS_LAST_NAME] = {
    "main": [
      [{ "node": "Check AI Active", "type": "main", "index": 0 }], // TRUE
      [] // FALSE → stop
    ]
  };

  // Remove old/stale connections
  delete wf.connections['Debounce Check'];
  delete wf.connections['Check Last Message'];

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing fix...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Fixed! Flow: Log → Wait 4s → HTTP(Supabase) → Code(count) → IF(isLast) → AI`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
