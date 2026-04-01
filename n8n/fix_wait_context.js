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
  const meta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  if (!meta) throw new Error("Workflow not found");
  const wf = await apiCall('GET', `/workflows/${meta.id}`);

  // Fix If2..If5: use $json instead of $node[] so data flows through Wait correctly
  // After Wait, the $json contains the data from the node before the Wait (WhatsApp Cloud output)
  // But the WhatsApp Cloud passes through { output: { response: { part_1..4 } } }
  // So after Wait, $json should have those values if we structured it correctly.
  
  // Actually the real fix: change If2..If5 to use $json.output.response.partX
  // and change Cloud1,5,6,7 text param to $json.output.response.partX
  // so they get the value from the flowing item, not from a pinned node
  
  const ifFixes = {
    'If2': 'part_2',
    'If3': 'part_3',
    'If4': 'part_4',
    'If5': 'part_5',
  };
  
  // Fix Wait2 to also have correct unit
  const wait2 = wf.nodes.find(n => n.name === 'Wait2');
  if (wait2) {
    wait2.parameters = { amount: 2, unit: "seconds", resume: "timeInterval" };
  }

  // Fix If2..If5 conditions to use $json
  Object.entries(ifFixes).forEach(([nodeName, part]) => {
    const node = wf.nodes.find(n => n.name === nodeName);
    if (node && node.parameters && node.parameters.conditions && node.parameters.conditions.conditions) {
      node.parameters.conditions.conditions[0].leftValue = `={{ $json.output.response.${part} }}`;
      console.log(`Fixed ${nodeName} -> $json.output.response.${part}`);
    }
  });

  // Fix WhatsApp Cloud1,5,6,7 text param to use $json
  const cloudFixes = {
    'WhatsApp Business Cloud1': 'part_2',
    'WhatsApp Business Cloud5': 'part_3',
    'WhatsApp Business Cloud6': 'part_4',
    'WhatsApp Business Cloud7': 'part_5',
  };
  
  Object.entries(cloudFixes).forEach(([nodeName, part]) => {
    const node = wf.nodes.find(n => n.name === nodeName);
    if (node && node.parameters && node.parameters.bodyParameters) {
      const textParam = node.parameters.bodyParameters.parameters.find(p => p.name === 'text');
      if (textParam) {
        textParam.value = `={{ $json.output.response.${part} }}`;
        console.log(`Fixed ${nodeName} text -> $json.output.response.${part}`);
      }
    }
  });

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('✅ All If nodes and WhatsApp Cloud nodes updated to use $json (flow-through) expressions.');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
