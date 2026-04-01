const fs = require('fs');
const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

async function apiCall(method, path, body = null) {
  const url = 'https://agentcore-n8n.8zp1cp.easypanel.host/api/v1' + path;
  const options = {
    method,
    headers: { 
      'X-N8N-API-KEY': N8N_API_KEY, 
      'accept': 'application/json',
      'content-type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, body: data };
}

async function fixWebhook() {
  const { body: wfs } = await apiCall('GET', '/workflows');
  const syncOrderWf = wfs.data.find(w => w.name === 'Sync Order SubWorkflow (Webhook)');
  const { body: wfData } = await apiCall('GET', '/workflows/' + syncOrderWf.id);
  
  const supabaseNode = wfData.nodes.find(n => n.name === 'Post Pedido Supabase');
  if (supabaseNode) {
    // Replace incorrectly formatted .body. with $json.body.
    supabaseNode.parameters.jsonBody = supabaseNode.parameters.jsonBody.replace(/\.body\./g, '$json.body.');
  }

  const updatePayload = {
    name: wfData.name,
    nodes: wfData.nodes,
    connections: wfData.connections,
    settings: wfData.settings || {}
  };
  
  const res = await apiCall('PUT', '/workflows/' + syncOrderWf.id, updatePayload);
  console.log('Webhook Fix Status:', res.status);
}

async function fixAiTool() {
  let wf = JSON.parse(fs.readFileSync('tmp_ai_workflow.json', 'utf8'));
  
  const toolNode = wf.nodes.find(n => n.name === 'Orden');
  if (toolNode) {
    toolNode.parameters.description = "🚨 REGLA ESTRICTA: Llamá a esta herramienta ÚNICAMENTE UNA VEZ por pedido, y SOLO cuando el cliente haya confirmado TODO: el detalle del pedido, la forma de entrega, la dirección (si es delivery) y la forma de pago. NUNCA la llames de manera preliminar ni varias veces para el mismo pedido. Si ya la llamaste, no la vuelvas a llamar a menos que sea un pedido totalmente nuevo.";
  }

  const updatePayload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {}
  };
  
  const res = await apiCall('PUT', '/workflows/' + wf.id, updatePayload);
  console.log('AI Tool Fix Status:', res.status);
}

async function run() {
  await fixWebhook();
  await fixAiTool();
}

run();
