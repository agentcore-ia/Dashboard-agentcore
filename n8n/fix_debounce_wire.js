const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

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
  const wfs = await apiCall('GET', '/workflows');
  const syncWfMeta = wfs.data.find(w => w.name.includes('Sync Order SubWorkflow (Webhook)'));
  if (!syncWfMeta) throw new Error("Sync Order SubWorkflow not found");

  const wf = await apiCall('GET', `/workflows/${syncWfMeta.id}`);

  // The workflow has these nodes:
  // Webhook -> Post Pedido Supabase -> Google Sheets Append
  // + Deduplicate 15min -> If Not Duplicate (added by us, but hanging)

  // The "Execute Workflow Trigger" path is what the AI Agent calls.
  // Flow should be: Execute Workflow Trigger -> Deduplicate -> If Not Duplicate
  //   [true]  -> Post Pedido Supabase -> Google Sheets Append
  //   [false] -> (nothing, silently dropped)

  wf.connections['Execute Workflow Trigger'] = {
    main: [[{ node: "Deduplicate 15min", type: "main", index: 0 }]]
  };

  wf.connections['Deduplicate 15min'] = {
    main: [[{ node: "If Not Duplicate", type: "main", index: 0 }]]
  };

  wf.connections['If Not Duplicate'] = {
    main: [
      [{ node: "Post Pedido Supabase", type: "main", index: 0 }],  // true -> proceed
      []                                                              // false -> stop (duplicate)
    ]
  };

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${syncWfMeta.id}`, payload);
  if (result.id) {
    console.log('✅ Debounce wired correctly: Execute Trigger -> Deduplicate -> If -> Post Pedido Supabase');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
