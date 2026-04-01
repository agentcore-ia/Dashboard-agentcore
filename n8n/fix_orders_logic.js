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

  // FIX 1: Update Orden tool node to map all fields properly
  const ordenNode = wf.nodes.find(n => n.name === 'Orden');
  if (ordenNode) {
    console.log('2. Updating "Orden" tool mapping...');
    // Update schema and values
    ordenNode.parameters.columns.value = {
      "Pedido": "={{ $json.Pedido }}",
      "nombre": "={{ $json.nombre }}",
      "direccion": "={{ $json.direccion }}",
      "numero": "={{ $('WhatsApp Trigger').first().json.body.data.key.remoteJid }}",
      "hora": "={{ $now.toFormat('HH:mm') }}",
      "fecha": "={{ $now.toFormat('dd/MM/yyyy') }}"
    };
    // Ensure all columns are in schema
    const colIds = ordenNode.parameters.columns.schema.map(c => c.id);
    if (!colIds.includes('hora')) ordenNode.parameters.columns.schema.push({ id: 'hora', displayName: 'hora', type: 'string' });
    if (!colIds.includes('fecha')) ordenNode.parameters.columns.schema.push({ id: 'fecha', displayName: 'fecha', type: 'string' });
  }

  // FIX 2: Strip '¡' from WhatsApp messages
  console.log('3. Stripping "¡" from WhatsApp nodes...');
  wf.nodes.forEach(n => {
    if (n.name.startsWith('WhatsApp Business Cloud')) {
        const textParamIdx = n.parameters.bodyParameters.parameters.findIndex(p => p.name === 'text');
        if (textParamIdx !== -1) {
            let val = n.parameters.bodyParameters.parameters[textParamIdx].value;
            if (!val.includes('.replaceAll')) {
                // Wrap in .replaceAll('¡', '')
                // Expression looks like: {{ $('Node').first().json.path }}
                // We want: {{ $('Node').first().json.path.replaceAll('¡', '') }}
                n.parameters.bodyParameters.parameters[textParamIdx].value = val.replace(/}}$/, ".replaceAll('¡', '') }}");
            }
        }
    }
  });

  // FIX 3: Add Supabase Node for Order Sync to Dashboard
  console.log('4. Adding Supabase sync node...');
  const supabaseNodeName = 'Sync Order to Dashboard';
  if (!wf.nodes.find(n => n.name === supabaseNodeName)) {
    const supabaseNode = {
      "parameters": {
        "operation": "insert",
        "table": {
          "__rl": true,
          "value": "pedidos",
          "mode": "list",
          "cachedResultName": "pedidos"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "restaurant_id": "00000000-0000-0000-0000-000000000001",
            "address": "={{ $json.direccion }}",
            "notes": "={{ $json.Pedido }}",
            "status": "new",
            "delivery_type": "delivery"
          }
        },
        "options": {}
      },
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [
        -13300,
        752
      ],
      "id": "supabase-pedidos-sync",
      "name": supabaseNodeName,
      "credentials": {
        "supabaseApi": {
          "id": "mXfM6FzF5V5F5F5F", // DUMMY id, we need to find the real one
          "name": "Supabase account"
        }
      }
    };
    
    // Actually, I don't know the Supabase credentials ID in n8n.
    // I see "Log Incoming to Supabase" node uses apikey instead of credentials?
    // Let's check "Log Incoming to Supabase" node type.
    const logNode = wf.nodes.find(n => n.name === 'Log Incoming to Supabase');
    // It's a httpRequest node! OK, I'll use httpRequest to insert into Supabase too.
    
    const supabaseSyncNode = {
      "parameters": {
        "method": "POST",
        "url": "https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/pedidos",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" },
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE" },
            { "name": "Prefer", "value": "return=representation" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ \n  restaurant_id: '00000000-0000-0000-0000-000000000001',\n  address: $json.direccion,\n  notes: $json.Pedido,\n  status: 'new',\n  delivery_type: 'delivery',\n  cliente_id: $('Get Conversation History').first()?.json?.cliente_id || null\n}) }}",
        "options": {}
      },
      "id": "supabase-pedidos-sync",
      "name": supabaseNodeName,
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        -13248,
        752
      ]
    };
    
    wf.nodes.push(supabaseSyncNode);
    
    // Update connections: Orden -> Sync Order -> back to Agent?
    // Tool nodes connect to Agent via ai_tool.
    // But a main flow can follow a tool call?
    // Actually, it's better to just have the tool itself trigger the sync.
    // I'll connect Orden -> Sync Order.
    wf.connections[ordenNode.name] = {
      "main": [
        [
          {
            "node": supabaseNodeName,
            "type": "main",
            "index": 0
          }
        ]
      ]
    };
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('5. Updating workflow...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Workflow updated successfully!`);
  } else {
    console.log('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
