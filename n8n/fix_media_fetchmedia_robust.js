const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";

const EVOLUTION_URL = "https://agentcore-evolution-api.8zp1cp.easypanel.host";
const INSTANCE_NAME = "agentcore test";
const API_KEY = "465E65D048F8-42B4-B162-4CF3107E70D8";

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

  const updateNode = (name) => {
    const n = wf.nodes.find(node => node.name === name);
    if (!n) return;
    console.log(`2. Updating ${name} to /chat/fetchMedia/...`);
    n.parameters.url = `=${EVOLUTION_URL}/chat/fetchMedia/${INSTANCE_NAME}`;
    n.parameters.responseFormat = "file";
    
    // Safety check for apikey
    if (!n.parameters.headerParameters) n.parameters.headerParameters = { parameters: [] };
    if (!n.parameters.headerParameters.parameters) n.parameters.headerParameters.parameters = [];
    
    let apiKeyHeader = n.parameters.headerParameters.parameters.find(p => p.name === 'apikey');
    if (!apiKeyHeader) {
      apiKeyHeader = { name: 'apikey', value: API_KEY };
      n.parameters.headerParameters.parameters.push(apiKeyHeader);
    } else {
      apiKeyHeader.value = API_KEY;
    }
  };

  updateNode('Get Audio');
  updateNode('Get Image');

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('3. Pushing robust media fetch fix...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Media fetch updated successfully!`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
