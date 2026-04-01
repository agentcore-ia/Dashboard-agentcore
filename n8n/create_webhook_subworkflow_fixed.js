const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const MAIN_WORKFLOW_ID = "Sbf4ewHwOCdsruMv";
const SUPABASE_URL = "https://eqnjyygokjinmsfvogxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE";
const N8N_PUBLIC_URL = "https://agentcore-n8n.8zp1cp.easypanel.host";

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
  console.log('1. Fetching Main Workflow to copy Google Sheets Tool...');
  const mainWf = await apiCall('GET', `/workflows/${MAIN_WORKFLOW_ID}`);
  
  const gSheetsTool = mainWf.nodes.find(n => n.name === 'Orden' && n.type === 'n8n-nodes-base.googleSheetsTool');
  if (!gSheetsTool) throw new Error("Google Sheets Tool 'Orden' not found in Main Workflow");

  const subWorkflow = {
    name: "Sync Order SubWorkflow (Webhook)",
    active: true,
    nodes: [
      {
        "parameters": {
          "httpMethod": "POST",
          "path": "save-order",
          "responseMode": "lastNode",
          "options": {}
        },
        "id": "webhook-node",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1.1,
        "position": [ 0, 0 ],
        "webhookId": "cb48aa82-7ea9-42b7-872f-5b76686300cc"
      },
      {
        "parameters": {
          "operation": "append",
          "documentId": gSheetsTool.parameters.documentId,
          "sheetName": gSheetsTool.parameters.sheetName,
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "Pedido": "={{ $json.body.pedido }}",
              "nombre": "={{ $json.body.nombre }}",
              "direccion": "={{ $json.body.direccion }}",
              "numero": "={{ $json.body.numero }}",
              "hora": "={{ new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) }}",
              "fecha": "={{ new Date().toLocaleDateString('es-AR') }}"
            },
            "matchingColumns": [],
            "schema": gSheetsTool.parameters.columns.schema
          }
        },
        "id": "gsheets-node",
        "name": "Google Sheets Append",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [ 200, 0 ],
        "credentials": gSheetsTool.credentials
      },
      {
        "parameters": {
          "url": `=${SUPABASE_URL}/rest/v1/clientes?phone=eq.{{ $('Webhook').first().json.body.numero }}&select=id`,
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              { "name": "apikey", "value": SUPABASE_KEY }
            ]
          },
          "options": {}
        },
        "id": "supabase-get",
        "name": "Get Cliente ID",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [ 400, 0 ]
      },
      {
        "parameters": {
          "method": "POST",
          "url": `=${SUPABASE_URL}/rest/v1/pedidos`,
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              { "name": "apikey", "value": SUPABASE_KEY },
              { "name": "Content-Type", "value": "application/json" },
              { "name": "Prefer", "value": "return=representation" }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={{ JSON.stringify({ cliente_id: $json[0]?.id || null, notes: $('Webhook').first().json.body.pedido, address: $('Webhook').first().json.body.direccion, status: 'new', delivery_type: 'delivery', payment_method: 'cash', total: 0 }) }}",
          "options": {}
        },
        "id": "supabase-post",
        "name": "Post Pedido",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [ 600, 0 ]
      },
      {
        "parameters": {
          "respondWith": "json",
          "responseBody": "{\n  \"success\": true,\n  \"message\": \"Orden guardada correctamente en Sheets y Supabase.\"\n}",
          "options": {}
        },
        "id": "respond-to-webhook",
        "name": "Respond to Webhook",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [ 800, 0 ]
      }
    ],
    "connections": {
      "Webhook": {
        "main": [[{ "node": "Google Sheets Append", "type": "main", "index": 0 }]]
      },
      "Google Sheets Append": {
        "main": [[{ "node": "Get Cliente ID", "type": "main", "index": 0 }]]
      },
      "Get Cliente ID": {
        "main": [[{ "node": "Post Pedido", "type": "main", "index": 0 }]]
      },
      "Post Pedido": {
        "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]]
      }
    },
    settings: { executionOrder: "v1", saveDataErrorExecution: "all", saveDataSuccessExecution: "all" }
  };

  console.log('2. Creating Webhook Sync Order Workflow...');
  const createSubWfRes = await apiCall('POST', `/workflows`, subWorkflow);
  
  if (!createSubWfRes.id) {
    throw new Error("Failed to create webhook workflow: " + JSON.stringify(createSubWfRes));
  }
  
  console.log('   ✅ Webhook Workflow created. ID:', createSubWfRes.id);

  // Instead of toolHttpRequest (which might not exist in old N8N), we use the universally compatible toolWorkflow!
  const mainOrdenIndex = mainWf.nodes.findIndex(n => n.name === 'Orden');
  
  if (mainOrdenIndex >= 0) {
    const position = mainWf.nodes[mainOrdenIndex].position;
    
    // Convert Orden tool into a simple HTTP tool. Wait, n8n-nodes-langchain.toolHttpRequest has existed for a year. 
    // Let's use custom tool + http request as best practice if we are unsure, OR just HTTP tool.
    mainWf.nodes[mainOrdenIndex] = {
      "parameters": {
        "name": "Orden",
        "description": "Guarda el pedido confirmado del cliente. Usar SOLO cuando se tengan todos los datos requeridos. Parámetros requeridos: nombre (del cliente), direccion (de entrega), pedido (detalle completo de pizzas).",
        "method": "POST",
        "url": `${N8N_PUBLIC_URL}/webhook/save-order`,
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ pedido: $fromAI('pedido'), nombre: $fromAI('nombre'), direccion: $fromAI('direccion'), numero: $('Fields').first().json.From }) }}"
      },
      "id": "e31a15ad-e7a6-432e-b0fb-45b4a5451e4d", 
      "name": "Orden",
      "type": "n8n-nodes-langchain.toolHttpRequest",
      "typeVersion": 1.1,
      "position": position
    };
    
    console.log('3. Updating Main Workflow to use HTTP Request Tool for Orders...');
    const updateMainRes = await apiCall('PUT', `/workflows/${MAIN_WORKFLOW_ID}`, mainWf);
    
    if (updateMainRes.id) {
      console.log('   ✅ Main workflow updated to use HTTP Sync Tool.');
    } else {
      console.error('   ❌ Failed to update main workflow:', JSON.stringify(updateMainRes));
    }
  } else {
    console.log('   ❌ Could not find original Orden tool to replace.');
  }
}

main().catch(console.error);
