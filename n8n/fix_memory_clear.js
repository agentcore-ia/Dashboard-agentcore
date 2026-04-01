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

  // Position reference
  const triggerNode = wf.nodes.find(n => n.name === 'WhatsApp Trigger');
  const tx = triggerNode ? triggerNode.position[0] : -16600;
  const ty = triggerNode ? triggerNode.position[1] : 304;

  // 1. ADD Memory Manager Code Node
  // It reads Global Static Data to persist memory versions per phone number.
  const MEMORY_MANAGER_NAME = 'Memory Manager';
  wf.nodes = wf.nodes.filter(n => n.name !== MEMORY_MANAGER_NAME);

  const memoryManagerNode = {
    "id": "memory-manager-node",
    "name": MEMORY_MANAGER_NAME,
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [tx + 250, ty],
    "parameters": {
      "mode": "runOnceForAllItems",
      "jsCode": `
const staticData = $getWorkflowStaticData('global');
const triggerPhone = $('WhatsApp Trigger').first().json.body?.data?.key?.remoteJid;

// Extract message text safely
let text = "";
const msg = $('WhatsApp Trigger').first().json.body?.data?.message;
if (msg) {
  text = msg.conversation || msg.extendedTextMessage?.text || "";
}

staticData[triggerPhone] = staticData[triggerPhone] || 1;

let isClearCommand = false;
if (text.trim().toLowerCase() === '/clear') {
    staticData[triggerPhone] += 1;
    isClearCommand = true;
}

return [{
    json: {
        memorySessionId: triggerPhone + "_v" + staticData[triggerPhone],
        isClearCommand: isClearCommand,
        text: text
    }
}];`
    }
  };

  // 2. ADD IF Node to route /clear command
  const IF_CLEAR_NAME = 'If Clear Command';
  wf.nodes = wf.nodes.filter(n => n.name !== IF_CLEAR_NAME);

  const ifClearNode = {
    "id": "if-clear-cmd-node",
    "name": IF_CLEAR_NAME,
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [tx + 500, ty],
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
            "id": "is-clear-cond",
            "leftValue": "={{ $json.isClearCommand }}",
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

  // 3. Wires for Clear node (Sends WhatsApp confirmation)
  const WABA_CLEAR_NAME = 'WABA Confirm Clear';
  wf.nodes = wf.nodes.filter(n => n.name !== WABA_CLEAR_NAME);
  const evolutionNodeExample = wf.nodes.find(n => n.name.startsWith('WhatsApp Business Cloud') && n.type === 'n8n-nodes-base.httpRequest');
  
  // We'll use a direct HTTP request identical to Evolution API send message
  const waClearNode = {
    "parameters": {
      "method": "POST",
      "url": "https://eqnjyygokjinmsfvogxi.supabase.co/functions/v1/send-whatsapp-message", // Route through our edge function for safety
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          { "name": "Content-Type", "value": "application/json" },
          { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE" }
        ]
      },
      "sendBody": true,
      "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ \n  number: $('WhatsApp Trigger').first().json.body.data.key.remoteJid, \n  message: \"✅ *Memoria borrada.* El agente olvidó toda la conversación anterior. Puedes comenzar un nuevo pedido de prueba.\"\n}) }}",
      "options": {}
    },
    "id": "waba-clear-confirm",
    "name": WABA_CLEAR_NAME,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [tx + 750, ty - 200]
  };

  wf.nodes.push(memoryManagerNode, ifClearNode, waClearNode);

  // 4. FIX existing memory nodes to use memorySessionId
  const memNodes = wf.nodes.filter(n => n.type === 'n8n-nodes-langchain.memoryBufferWindow' || n.name === 'memoria');
  for (const m of memNodes) {
    if (m.parameters) {
      m.parameters.sessionId = "={{ $('Memory Manager').first().json.memorySessionId }}";
    }
  }

  // 5. UPDATE Connections
  // Trigger -> Memory Manager -> If Clear Command
  //    TRUE -> WABA Confirm Clear
  //    FALSE -> Google Sheets (where Trigger used to go)

  // Disconnect Trigger from Google Sheets
  delete wf.connections['WhatsApp Trigger'];

  wf.connections['WhatsApp Trigger'] = {
    "main": [[{ "node": MEMORY_MANAGER_NAME, "type": "main", "index": 0 }]]
  };

  wf.connections[MEMORY_MANAGER_NAME] = {
    "main": [[{ "node": IF_CLEAR_NAME, "type": "main", "index": 0 }]]
  };

  wf.connections[IF_CLEAR_NAME] = {
    "main": [
      [{ "node": WABA_CLEAR_NAME, "type": "main", "index": 0 }], // TRUE branch
      [{ "node": "Google Sheets", "type": "main", "index": 0 }]  // FALSE branch (resume old flow)
    ]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing memory manager update...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Memory manager node applied. /clear command implemented!`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
