const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const MAIN_WORKFLOW_ID = "Sbf4ewHwOCdsruMv";
const SUPABASE_URL = "https://eqnjyygokjinmsfvogxi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE";

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
  
  const gSheetsTool = mainWf.nodes.find(n => n.name === 'Orden');
  if (!gSheetsTool) throw new Error("Google Sheets Tool 'Orden' not found in Main Workflow");

  const subWorkflow = {
    name: "Sync Order SubWorkflow (Execute Tool)",
    nodes: [
      {
        "parameters": {},
        "id": "trigger-node",
        "name": "Execute Workflow Trigger",
        "type": "n8n-nodes-base.executeWorkflowTrigger",
        "typeVersion": 1,
        "position": [ 0, 0 ]
      },
      {
        "parameters": {
          "operation": "append",
          // documentId might be inside gSheetsTool or fallback to a hardcoded one if currently missing
          // but let's reuse the exact ID we know from earlier: "1_bH6nbGBJ9RHcvS13pmxUljWHCZfSyu_oDIcZqhtfsA"
          "documentId": {
              "__rl": true, "value": "1_bH6nbGBJ9RHcvS13pmxUljWHCZfSyu_oDIcZqhtfsA", "mode": "list", "cachedResultName": "PEDIDOS"
          },
          "sheetName": {
              "__rl": true, "value": "gid=0", "mode": "list", "cachedResultName": "Hoja 1"
          },
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "Pedido": "={{ $json.pedido }}",
              "nombre": "={{ $json.nombre }}",
              "direccion": "={{ $json.direccion }}",
              "numero": "={{ $json.numero }}",
              "hora": "={{ new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) }}",
              "fecha": "={{ new Date().toLocaleDateString('es-AR') }}"
            },
            "matchingColumns": [],
            "schema": [
              { "id": "Pedido", "displayName": "Pedido" },
              { "id": "nombre", "displayName": "nombre" },
              { "id": "direccion", "displayName": "direccion" },
              { "id": "numero", "displayName": "numero" },
              { "id": "hora", "displayName": "hora" },
              { "id": "fecha", "displayName": "fecha" }
            ]
          }
        },
        "id": "gsheets-node",
        "name": "Google Sheets Append",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [ 200, 0 ],
        "credentials": {
            "googleSheetsOAuth2Api": {
                "id": "VIUbLm4ucKWx8jEh",
                "name": "Google Sheets account"
            }
        }
      },
      {
        "parameters": {
          "url": `=${SUPABASE_URL}/rest/v1/clientes?phone=eq.{{ $json.numero }}&select=id`,
          "sendHeaders": true,
          "headerParameters": { "parameters": [ { "name": "apikey", "value": SUPABASE_KEY } ] },
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
          "jsonBody": "={{ JSON.stringify({ cliente_id: $json[0]?.id || null, notes: $('Execute Workflow Trigger').first().json.pedido || 'N/A', address: $('Execute Workflow Trigger').first().json.direccion || 'N/A', status: 'new', delivery_type: 'delivery', payment_method: 'cash', total: 0 }) }}",
          "options": {}
        },
        "id": "supabase-post",
        "name": "Post Pedido",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [ 600, 0 ]
      }
    ],
    "connections": {
      "Execute Workflow Trigger": {
        "main": [[{ "node": "Google Sheets Append", "type": "main", "index": 0 }]]
      },
      "Google Sheets Append": {
        "main": [[{ "node": "Get Cliente ID", "type": "main", "index": 0 }]]
      },
      "Get Cliente ID": {
        "main": [[{ "node": "Post Pedido", "type": "main", "index": 0 }]]
      }
    },
    settings: { executionOrder: "v1", saveDataErrorExecution: "all", saveDataSuccessExecution: "all" }
  };

  console.log('2. Creating Execute Workflow tool...');
  const createSubWfRes = await apiCall('POST', `/workflows`, subWorkflow);
  
  if (!createSubWfRes.id) {
    throw new Error("Failed to create webhook workflow: " + JSON.stringify(createSubWfRes));
  }
  
  const subWfId = createSubWfRes.id;
  console.log('   ✅ SubWorkflow created. ID:', subWfId);

  // Replace Orden tool in main workflow
  const mainOrdenIndex = mainWf.nodes.findIndex(n => n.name === 'Orden');
  
  if (mainOrdenIndex >= 0) {
    const position = mainWf.nodes[mainOrdenIndex].position;
    
    mainWf.nodes[mainOrdenIndex] = {
      "parameters": {
        "name": "Orden",
        "descriptionType": "manual",
        "toolDescription": "Guarda el pedido confirmado del cliente en la base de datos y la planilla. Usar SOLO cuando se tengan todos los datos requeridos. Parámetros requeridos: nombre (del cliente), direccion (de entrega), pedido (detalle completo de pizzas).",
        "workflowId": {
          "__rl": true,
          "value": subWfId,
          "mode": "id"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "pedido": "={{$fromAI('pedido')}}",
            "nombre": "={{$fromAI('nombre')}}",
            "direccion": "={{$fromAI('direccion')}}",
            "numero": "={{$('Fields').first().json.From}}" // Main workflow variable injection
          },
          "matchingColumns": [],
          "schema": [
            { "id": "pedido", "displayName": "pedido", "required": true, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "nombre", "displayName": "nombre", "required": true, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "direccion", "displayName": "direccion", "required": true, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true },
            { "id": "numero", "displayName": "numero", "required": false, "defaultMatch": false, "display": true, "type": "string", "canBeUsedToMatch": true }
          ]
        }
      },
      "id": "e31a15ad-e7a6-432e-b0fb-45b4a5451e4d",
      "name": "Orden",
      "type": "n8n-nodes-langchain.toolWorkflow",
      "typeVersion": 1,
      "position": position
    };
    
    console.log('3. Updating Main Workflow to use Call Workflow Tool...');
    
    // Minimal allowed fields for N8N PUT
    const payload = {
        name: mainWf.name,
        nodes: mainWf.nodes,
        connections: mainWf.connections,
        settings: { executionOrder: "v1" } // Stripped meta/tags
    };

    const updateMainRes = await apiCall('PUT', `/workflows/${MAIN_WORKFLOW_ID}`, payload);
    
    if (updateMainRes.id) {
      console.log('   ✅ Main workflow updated to use Tool Workflow sync.');
    } else {
      console.error('   ❌ Failed to update main workflow:', updateMainRes);
    }
  } else {
    console.log('   ❌ Could not find original Orden tool to replace.');
  }
}

main().catch(console.error);
