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
  console.log('1. Fetching Main Workflow...');
  const mainWf = await apiCall('GET', `/workflows/${MAIN_WORKFLOW_ID}`);
  
  // Replace Orden tool in main workflow
  const mainOrdenIndex = mainWf.nodes.findIndex(n => n.name === 'Orden');
  
  if (mainOrdenIndex >= 0) {
    const position = mainWf.nodes[mainOrdenIndex].position;
    
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
    
    console.log('2. Updating Main Workflow to use HTTP Request Tool for Orders...');
    
    // Create clean payload for update
    const payload = {
        name: mainWf.name,
        nodes: mainWf.nodes,
        connections: mainWf.connections,
        settings: mainWf.settings,
        meta: mainWf.meta,
        tags: mainWf.tags
    };

    const updateMainRes = await apiCall('PUT', `/workflows/${MAIN_WORKFLOW_ID}`, payload);
    
    if (updateMainRes.id) {
      console.log('   ✅ Main workflow updated to use HTTP Sync Tool.');
    } else {
      console.error('   ❌ Failed to update main workflow:', updateMainRes);
    }
  } else {
    console.log('   ❌ Could not find original Orden tool to replace.');
  }
}

main().catch(console.error);
