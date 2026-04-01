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

  // Update the query to filter by the last 5 minutes (300,000ms)
  const httpNode = wf.nodes.find(n => n.name === 'Get Latest Message');
  if (httpNode) {
    console.log('2. Updating Get Latest Message node to filter for last 5 minutes...');
    // Add created_at=gte.{{ $now.minus(300000).toISO() }}
    httpNode.parameters.url = `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&select=id,wa_message_id,created_at,content&order=created_at.desc&limit=10&created_at=gte.{{ $now.minus(300000).toISO() }}`;
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('3. Pushing update...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ 5-minute memory window applied successfully!`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
