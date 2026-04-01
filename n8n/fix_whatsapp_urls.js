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
  
  // Update WhatsApp Business Cloud nodes to URL-encode the space
  ['WhatsApp Business Cloud', 'WhatsApp Business Cloud1', 'WhatsApp Business Cloud5', 'WhatsApp Business Cloud6', 'WhatsApp Business Cloud7'].forEach(nodeName => {
    let idx = wfBody.nodes.findIndex(n => n.name === nodeName);
    if (idx !== -1) {
      if (wfBody.nodes[idx].parameters && wfBody.nodes[idx].parameters.url) {
        wfBody.nodes[idx].parameters.url = wfBody.nodes[idx].parameters.url.replace('agentcore test', 'agentcore%20test');
      }
    }
  });
  
  // Apply update
  let safeSettings = {}; 
  if (wfBody.settings && wfBody.settings.executionOrder) safeSettings.executionOrder = wfBody.settings.executionOrder;
  
  const result = await fetchN8n('PUT', '/workflows/' + activeWfMeta.id, {
      name: wfBody.name,
      nodes: wfBody.nodes,
      connections: wfBody.connections,
      settings: safeSettings
  });
  console.log('Update Status URL space fix:', result.status);
}
run();
