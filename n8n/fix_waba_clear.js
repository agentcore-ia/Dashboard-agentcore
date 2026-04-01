const https = require('https');
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';

async function fetchN8n(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://agentcore-n8n.8zp1cp.easypanel.host/api/v1' + path);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const { data: wfs } = await fetchN8n('GET', '/workflows');
  let activeWfMeta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  
  const { data: wfBody } = await fetchN8n('GET', '/workflows/' + activeWfMeta.id);
  
  let clearIndex = wfBody.nodes.findIndex(n => n.name === 'WABA Confirm Clear');
  
  if (clearIndex !== -1) {
    let clearNode = wfBody.nodes[clearIndex];
    
    // Change from POST to Supabase to POST to Evolution API
    clearNode.parameters = {
      "method": "POST",
      "url": "https://agentcore-evolution-api.8zp1cp.easypanel.host/message/sendText/agentcore%20test",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          { "name": "apikey", "value": "465E65D048F8-42B4-B162-4CF3107E70D8" },
          { "name": "Content-Type", "value": "application/json" }
        ]
      },
      "sendBody": true,
      "bodyParameters": {
        "parameters": [
          { "name": "number", "value": "={{ $('WhatsApp Trigger').first().json.body.data.key.remoteJid }}" },
          { "name": "text", "value": "✅ *Memoria borrada.* El agente olvidó toda la conversación anterior. Puedes comenzar un nuevo pedido de prueba." }
        ]
      },
      "options": {}
    };
    
    // Clean up settings to avoid 400 bad request
    delete wfBody.settings.callerPolicy;
    delete wfBody.settings.errorWorkflow;
    let safeSettings = {}; 
    if (wfBody.settings.executionOrder) safeSettings.executionOrder = wfBody.settings.executionOrder;
    
    const result = await fetchN8n('PUT', '/workflows/' + activeWfMeta.id, {
        name: wfBody.name,
        nodes: wfBody.nodes,
        connections: wfBody.connections,
        settings: safeSettings
    });
    console.log('Update Status:', result.status);
    if (result.status !== 200) console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log('WABA Confirm Clear node not found');
  }
}
run();
