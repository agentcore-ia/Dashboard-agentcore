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

  // FIX 1: Enable "Merge Response" on Log AI Response (HTTP Request node)
  // This makes the node keep input data AND add response data
  const logNode = wf.nodes.find(n => n.name === 'Log AI Response to Supabase');
  if (logNode) {
    if (!logNode.parameters.options) logNode.parameters.options = {};
    // fullResponse: false, response: merge input with response
    logNode.parameters.options.response = {
      response: { responseFormat: "json" }
    };
    // Most importantly: use "merge" mode which keeps input item properties
    logNode.parameters.options.batching = undefined;
    // For HTTP Request v4.1+: add response data to existing item
    logNode.parameters.options.mergeResponse = true;
    console.log("Log AI: set mergeResponse = true");
  }

  // FIX 2: WhatsApp Cloud part_1 - change to use $json (same as others now)
  const waCloud = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud');
  if (waCloud) {
    const textParam = waCloud.parameters.bodyParameters.parameters.find(p => p.name === 'text');
    if (textParam) {
      textParam.value = "={{ $json.output.response.part_1 }}";
      console.log("Fixed WA Cloud part_1 text -> $json");
    }
    const numParam = waCloud.parameters.bodyParameters.parameters.find(p => p.name === 'number');
    if (numParam) {
      // Also fix number param if it uses $node
      if (numParam.value.includes('$node')) {
        numParam.value = "={{ $json.number || $json.body?.data?.key?.remoteJid }}";
        console.log("Fixed WA Cloud part_1 number -> $json");
      }
    }
  }

  // FIX 3: The Preserve Parts Set node - update it to also carry the remoteJid
  const setNode = wf.nodes.find(n => n.name === 'Preserve Parts');
  if (setNode && setNode.parameters.assignments) {
    setNode.parameters.assignments.assignments.push({
      id: "ppnum",
      name: "number",
      value: "={{ $node[\"WhatsApp Trigger\"].json.body.data.key.remoteJid }}",
      type: "string"
    });
    console.log("Preserve Parts: added number field");
  }

  // FIX 4: Fix WhatsApp number param on all Cloud nodes to use $json.number
  ['WhatsApp Business Cloud1', 'WhatsApp Business Cloud5', 'WhatsApp Business Cloud6', 'WhatsApp Business Cloud7'].forEach(nodeName => {
    const node = wf.nodes.find(n => n.name === nodeName);
    if (node) {
      const numParam = node.parameters.bodyParameters.parameters.find(p => p.name === 'number');
      if (numParam) {
        numParam.value = "={{ $json.number }}";
        console.log(`Fixed ${nodeName} number -> $json.number`);
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
    console.log('\n✅ All fixes applied. Flow: Dividir -> Preserve Parts (copies all fields) -> Log AI (merges) -> WA Cloud (uses $json)');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
