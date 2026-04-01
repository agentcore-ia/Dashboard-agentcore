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

  // 1. UPDATE Get Audio to download binary directly
  const getAudioNode = wf.nodes.find(n => n.name === 'Get Audio');
  if (getAudioNode) {
    console.log('2. Updating Get Audio to direct binary download...');
    // Endpoint for raw media BLOB
    getAudioNode.parameters.url = `=${EVOLUTION_URL}/chat/getMediaMessage/${INSTANCE_NAME}`;
    getAudioNode.parameters.responseFormat = "file";
    
    // API KEY
    const apiKeyHeader = getAudioNode.parameters.headerParameters.parameters.find(p => p.name === 'apikey');
    if (apiKeyHeader) apiKeyHeader.value = API_KEY;
  }

  // 2. UPDATE Get Image to direct binary download
  const getImageNode = wf.nodes.find(n => n.name === 'Get Image');
  if (getImageNode) {
    console.log('3. Updating Get Image to direct binary download...');
    getImageNode.parameters.url = `=${EVOLUTION_URL}/chat/getMediaMessage/${INSTANCE_NAME}`;
    getImageNode.parameters.responseFormat = "file";
    
    const apiKeyHeader = getImageNode.parameters.headerParameters.parameters.find(p => p.name === 'apikey');
    if (apiKeyHeader) apiKeyHeader.value = API_KEY;
  }

  // 3. REWIRE: Skip the "Download" nodes entirely
  // Get Audio -> OpenAI1
  // Get Image -> OpenAI2
  wf.connections['Get Audio'] = {
    "main": [[{ "node": "OpenAI1", "type": "main", "index": 0 }]]
  };
  wf.connections['Get Image'] = {
    "main": [[{ "node": "OpenAI2", "type": "main", "index": 0 }]]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('4. Pushing media flow optimization...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Media flow optimized! Audio/Image are now downloaded directly to OpenAI nodes.`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
