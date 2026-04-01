const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";

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

const AUDIO_CONVERT_CODE = `
const base64 = $input.item.json.base64;
if (!base64) throw new Error("No base64 data received from server");

// OpenAI requires a valid file extension. WhatsApp uses .ogg natively.
return {
  json: {},
  binary: {
    data: {
      data: base64,
      mimeType: 'audio/ogg',
      fileName: 'voicenote.ogg'
    }
  }
};
`;

const IMAGE_CONVERT_CODE = `
const base64 = $input.item.json.base64;
if (!base64) throw new Error("No base64 data received from server");

return {
  json: {},
  binary: {
    data: {
      data: base64,
      mimeType: 'image/jpeg',
      fileName: 'image.jpg'
    }
  }
};
`;

async function main() {
  console.log('1. Fetching workflow...');
  const wf = await apiCall('GET', `/workflows/${WORKFLOW_ID}`);

  const convertAudioNode = wf.nodes.find(n => n.name === 'Convert Audio');
  if (convertAudioNode) {
    convertAudioNode.parameters.jsCode = AUDIO_CONVERT_CODE;
  }

  const convertImageNode = wf.nodes.find(n => n.name === 'Convert Image');
  if (convertImageNode) {
    convertImageNode.parameters.jsCode = IMAGE_CONVERT_CODE;
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing media extension fix...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Media file extensions (voicenote.ogg) applied successfully.`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
