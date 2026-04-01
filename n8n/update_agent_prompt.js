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

async function main() {
  console.log('1. Fetching workflow...');
  const wf = await apiCall('GET', `/workflows/${WORKFLOW_ID}`);

  // FIX 4: Update AI Agent prompt to explicitly mention 'Orden' tool
  const agentNode = wf.nodes.find(n => n.name === 'AI Agent');
  if (agentNode) {
    console.log('2. Updating AI Agent system message...');
    const sysMsg = agentNode.parameters.options.systemMessage || '';
    if (!sysMsg.includes('tool "Orden"')) {
        agentNode.parameters.options.systemMessage = sysMsg + "\n\n5. CUANDO EL CLIENTE CONFIRME EL PEDIDO, usa la tool \"Orden\" para guardarlo. Debes pedirle al cliente su nombre y dirección si no los tienes.";
    }
  }

  // Double check stripping of exclamation marks in Corrector node as well?
  // Let's just stick to the WhatsApp nodes replacement which is final.

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('3. Updating workflow...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ AI Agent instructions updated!`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
