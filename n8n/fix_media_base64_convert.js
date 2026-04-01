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

const CONVERT_CODE = `
const base64 = $input.item.json.base64;
if (!base64) throw new Error("No base64 data received from server");

return {
  json: {},
  binary: {
    data: { // "data" is the default binary property read by OpenAI
      data: base64,
      mimeType: $input.item.json.mimetype || 'application/octet-stream',
      fileName: 'media_file'
    }
  }
};
`;

async function main() {
  console.log('1. Fetching workflow...');
  const wf = await apiCall('GET', `/workflows/${WORKFLOW_ID}`);

  // REVERT Get Audio to JSON base 64 endpoint
  const getAudioNode = wf.nodes.find(n => n.name === 'Get Audio');
  if (getAudioNode) {
    getAudioNode.parameters.url = `=${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`;
    getAudioNode.parameters.responseFormat = "json";
  }

  // REVERT Get Image to JSON base 64 endpoint
  const getImageNode = wf.nodes.find(n => n.name === 'Get Image');
  if (getImageNode) {
    getImageNode.parameters.url = `=${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`;
    getImageNode.parameters.responseFormat = "json";
  }

  // ADD Convert Audio Node
  wf.nodes = wf.nodes.filter(n => n.name !== 'Convert Audio' && n.name !== 'Convert Image');

  const convertAudioNode = {
    "parameters": {
      "jsCode": CONVERT_CODE
    },
    "id": "convert-audio-node",
    "name": "Convert Audio",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [getAudioNode.position[0] + 200, getAudioNode.position[1]]
  };

  const convertImageNode = {
    "parameters": {
      "jsCode": CONVERT_CODE
    },
    "id": "convert-image-node",
    "name": "Convert Image",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [getImageNode.position[0] + 200, getImageNode.position[1]]
  };

  wf.nodes.push(convertAudioNode, convertImageNode);

  // REWIRE Connections
  // 1. Get Audio -> Convert Audio
  wf.connections['Get Audio'] = {
    "main": [[{ "node": "Convert Audio", "type": "main", "index": 0 }]]
  };
  // 2. Convert Audio -> OpenAI1
  wf.connections['Convert Audio'] = {
    "main": [[{ "node": "OpenAI1", "type": "main", "index": 0 }]]
  };

  // 3. Get Image -> Convert Image
  wf.connections['Get Image'] = {
    "main": [[{ "node": "Convert Image", "type": "main", "index": 0 }]]
  };
  // 4. Convert Image -> OpenAI2
  wf.connections['Convert Image'] = {
    "main": [[{ "node": "OpenAI2", "type": "main", "index": 0 }]]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing base64 conversion architecture...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Media workflow returned to stable base64 conversion.`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
