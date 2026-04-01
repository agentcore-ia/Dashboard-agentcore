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

  // ── APPROACH CHANGE ──────────────────────────────────────────────────────
  //
  // The problem with using httpRequest + IF on array length is that N8N's
  // httpRequest with a JSON array response outputs MULTIPLE items (one per
  // array entry), not a single item with a length property.
  // 
  // Better approach: Replace the httpRequest + IF combo with a single
  // Code node that does everything:
  //   1. Calls Supabase REST API
  //   2. Counts messages
  //   3. Returns { isLast: true/false }
  // Then the IF node just checks isLast === true.
  //
  // Even simpler: use the Supabase ?select=count header to get just the count
  // with a prefer: count=exact header and read from the Content-Range header.
  // But that requires header parsing which is tricky.
  //
  // SIMPLEST fix: Change the "Check Last Message" node to use 
  //   &limit=2 and return jsonBody, then in the IF node check if
  //   $items("Check Last Message").length <= 1
  //   using $items() builtin which counts output items.
  //
  // ─── ACTUAL FIX ─────────────────────────────────────────────────────────

  // Replace "Check Last Message" with a Code node that:
  //  - queries Supabase for recent customer messages in that conversation
  //  - returns { isLastMessage: true } or { isLastMessage: false }
  // Then "Is Last Message" IF just checks isLastMessage === true.

  // Remove old Check Last Message node and Is Last Message
  wf.nodes = wf.nodes.filter(n => 
    n.name !== 'Check Last Message' && 
    n.name !== 'Is Last Message'
  );

  // New Code node: Check + Decide in one step
  const CHECK_DECIDE_NAME = 'Debounce Check';
  wf.nodes = wf.nodes.filter(n => n.name !== CHECK_DECIDE_NAME);

  const logNode = wf.nodes.find(n => n.name === 'Debounce Wait');
  const pos = logNode ? logNode.position : [-13728, 304];

  const checkDecideNode = {
    "id": "debounce-check-decide-node",
    "name": CHECK_DECIDE_NAME,
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [pos[0] + 320, pos[1]],
    "parameters": {
      "mode": "runOnceForAllItems",
      "jsCode": `
const convId = $('Log Incoming to Supabase').first().json.conversacion_id;

if (!convId) {
  // No conversation ID means it was a duplicate/ignored message -> skip AI
  return [{ json: { isLastMessage: false, reason: 'no_conv_id' } }];
}

// Build timestamp: 6 seconds ago
const sixSecondsAgo = new Date(Date.now() - 6000).toISOString();

// Query Supabase for customer messages in the last 6 seconds for this conversation
const url = \`https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.\${convId}&sender=eq.customer&created_at=gte.\${encodeURIComponent(sixSecondsAgo)}&select=id,created_at&order=created_at.desc&limit=5\`;

const response = await fetch(url, {
  headers: {
    'apikey': '${SUPABASE_ANON_KEY}',
    'Content-Type': 'application/json'
  }
});

const messages = await response.json();

// If there is more than 1 recent message, this is part of a burst.
// Only the LAST one in the burst should trigger the AI.
// Since each execution runs independently and waits 4s, by the time we get here,
// if there are 2+ messages in the last 6s window, this means another message 
// arrived after the current one. We check by count:
//   1 = only our message → we are last → proceed
//   2+ = burst happened → only the newest should respond
//
// To correctly identify if WE are the newest, we just check count.
// If count == 1, we're definitely last.
// If count > 1, we bail — the execution that started last will also check
// and if by then it's count==1 it proceeds.

const isLast = !Array.isArray(messages) || messages.length <= 1;

return [{ json: { isLastMessage: isLast, messageCount: Array.isArray(messages) ? messages.length : 0 } }];
`
    }
  };

  wf.nodes.push(checkDecideNode);

  // Re-add Is Last Message IF node (same as before, now checking isLastMessage)
  const IS_LAST_NAME = 'Is Last Message';
  const isLastNode = {
    "id": "is-last-message-node-v2",
    "name": IS_LAST_NAME,
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [pos[0] + 640, pos[1]],
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
            "id": "is-last-cond-v2",
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

  wf.nodes.push(isLastNode);

  // Update connections
  wf.connections['Debounce Wait'] = {
    "main": [
      [{ "node": CHECK_DECIDE_NAME, "type": "main", "index": 0 }]
    ]
  };

  wf.connections[CHECK_DECIDE_NAME] = {
    "main": [
      [{ "node": IS_LAST_NAME, "type": "main", "index": 0 }]
    ]
  };

  wf.connections[IS_LAST_NAME] = {
    "main": [
      [{ "node": "Check AI Active", "type": "main", "index": 0 }], // TRUE
      [] // FALSE → stop
    ]
  };

  // Clean up old Check Last Message connection if it still exists
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
    console.log(`   ✅ Debounce fixed! Flow: Log → Wait 4s → Code (query Supabase) → IF isLast → AI`);
    console.log(`   Nodes: ${wf.nodes.map(n => n.name).length} total`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
