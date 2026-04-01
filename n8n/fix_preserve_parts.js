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

  // Check if "Preserve Parts" set node already exists
  if (!wf.nodes.find(n => n.name === 'Preserve Parts')) {
    // Add a "Set" node that copies parts from Dividir mensaje into the flowing item
    // This goes BETWEEN "Dividir mensaje" and "Log AI Response to Supabase"
    const setNode = {
      parameters: {
        mode: "manual",
        duplicateItem: false,
        assignments: {
          assignments: [
            {
              id: "pp1",
              name: "output.response.part_1",
              value: "={{ $json.output.response.part_1 }}",
              type: "string"
            },
            {
              id: "pp2",
              name: "output.response.part_2",
              value: "={{ $json.output.response.part_2 }}",
              type: "string"
            },
            {
              id: "pp3",
              name: "output.response.part_3",
              value: "={{ $json.output.response.part_3 }}",
              type: "string"
            },
            {
              id: "pp4",
              name: "output.response.part_4",
              value: "={{ $json.output.response.part_4 }}",
              type: "string"
            }
          ]
        },
        options: {}
      },
      name: "Preserve Parts",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [200, 300]
    };
    wf.nodes.push(setNode);
    console.log("Set node added");
  }

  // Rewire: Dividir mensaje -> Preserve Parts -> Log AI Response
  // And: Preserve Parts -> WhatsApp Business Cloud (part_1)
  // Find what Dividir mensaje used to connect to
  const dividirConn = wf.connections['Dividir mensaje'];
  console.log('Dividir mensaje connections was:', JSON.stringify(dividirConn));

  // Dividir mensaje -> Preserve Parts
  wf.connections['Dividir mensaje'] = {
    main: [[{ node: "Preserve Parts", type: "main", index: 0 }]]
  };

  // Preserve Parts -> Log AI Response to Supabase (to keep logging)
  //   AND -> WhatsApp Business Cloud (part_1)
  // N8N only supports one output branch per output index
  // So: Preserve Parts -> Log AI Response, and Log AI response was already -> WhatsApp Cloud
  wf.connections['Preserve Parts'] = {
    main: [[{ node: "Log AI Response to Supabase", type: "main", index: 0 }]]
  };

  // Keep Log AI Response -> WhatsApp Cloud unchanged
  // (it was already: "Log AI Response to Supabase" -> "WhatsApp Business Cloud")
  console.log('Log AI -> WA connection:', JSON.stringify(wf.connections['Log AI Response to Supabase']));

  // Now the chain is: Dividir -> Preserve Parts -> Log AI -> WA Cloud -> Wait2 -> If2 -> Cloud1...
  // But the Issue: Log AI Response REPLACES $json with Supabase response
  // We need to make WhatsApp Cloud grab data from Dividir mensaje via $node[] since Preserve Parts
  // just copies the same keys, the real fix is to keep $node["Dividir mensaje"] ref in WA Cloud 1
  // But after Wait, $node is lost...
  
  // BETTER APPROACH: Fix "Log AI Response to Supabase" node to use "keepOnlySet: false" 
  // by checking if there's a way to merge, OR change the WhatsApp Cloud node (part_1) 
  // to NOT receive from Log AI but directly from Dividir mensaje
  
  // Let's check: what does WA Cloud (part_1) currently use for text?
  const waCloud = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud');
  const textParam = waCloud.parameters.bodyParameters.parameters.find(p => p.name === 'text');
  console.log('WA Cloud part_1 text:', textParam.value);

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('✅ Preserve Parts node inserted between Dividir mensaje and Log AI');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
