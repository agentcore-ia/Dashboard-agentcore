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
  const syncOrderWf = wfs.data.find(w => w.name === 'Sync Order SubWorkflow (Webhook)');
  
  console.log('Fetching workflow...');
  const { data: wfBody } = await fetchN8n('GET', '/workflows/' + syncOrderWf.id);
  
  let gsNodeIndex = wfBody.nodes.findIndex(n => n.name === 'Google Sheets Append');
  
  if (gsNodeIndex !== -1) {
    let mapping = wfBody.nodes[gsNodeIndex].parameters.columns.value;
    // Map ID Pedido to Supabase output
    mapping['ID Pedido'] = "{{ Post Pedido Supabase.first().json.id || Post Pedido Supabase.first().json[0]?.id || '' }}";
    wfBody.nodes[gsNodeIndex].parameters.columns.value = mapping;
    
    console.log('Sending update to N8N...');
    const result = await fetchN8n('PUT', '/workflows/' + syncOrderWf.id, {
        name: wfBody.name,
        nodes: wfBody.nodes,
        connections: wfBody.connections,
        settings: wfBody.settings
    });
    console.log('Update Status:', result.status);
  } else {
    console.log('Google Sheets node not found');
  }
}
run();
