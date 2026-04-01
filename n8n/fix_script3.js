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
  let toolIndex = wfBody.nodes.findIndex(n => n.name === 'Orden');
  
  if (toolIndex !== -1) {
    let tool = wfBody.nodes[toolIndex];
    tool.parameters.description = "ESTA HERRAMIENTA DISPARA LA ORDEN FINAL A LA BASE DE DATOS. REGLAS: 1) LLAMA UNA VEZ SOLO AL FINAL. 2) NO LLAMES PREMATURAMENTE. 3) PIDE DIRECCION. 4) NO LLAMAR DOS VECES.";
    
    // Some n8n versions throw 400 if you don't increment the version or if meta is required but absent, etc. 
    // Wait, the API documentation for PUT /workflows/:id requires { name, nodes, connections, settings }.
    
    console.log('Sending update to N8N...');
    const result = await fetchN8n('PUT', '/workflows/' + activeWfMeta.id, {
        name: wfBody.name,
        nodes: wfBody.nodes,
        connections: wfBody.connections,
        settings: wfBody.settings
    });
    console.log('Update Status:', result.status);
    if (result.status !== 200) {
      console.log('Error Data:', JSON.stringify(result.data, null, 2));
    }
  }
}
run();
