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

  // ── FIX 1: WhatsApp Business Cloud (part_1) ──
  // Before Wait, $node[] still works. Use Preserve Parts node ref.
  const waCloud = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud');
  if (waCloud) {
    const params = waCloud.parameters.bodyParameters.parameters;
    const numParam = params.find(p => p.name === 'number');
    const textParam = params.find(p => p.name === 'text');
    if (numParam) numParam.value = `={{ $node["WhatsApp Trigger"].json.body.data.key.remoteJid }}`;
    if (textParam) textParam.value = `={{ $node["Preserve Parts"].json.output.response.part_1 }}`;
    console.log("✅ WA Cloud part_1: fixed to use $node references (pre-Wait)");
  }

  // ── FIX 2: Insert "Carry Parts" Set node between WA Cloud and Wait2 ──
  // This node re-stamps all data from Preserve Parts into the flowing $json
  // so Wait2 can transport it to If2, Cloud1, etc.
  if (!wf.nodes.find(n => n.name === 'Carry Parts')) {
    const carryNode = {
      parameters: {
        mode: "manual",
        duplicateItem: false,
        assignments: {
          assignments: [
            {
              id: "cp_number",
              name: "number",
              value: `={{ $node["WhatsApp Trigger"].json.body.data.key.remoteJid }}`,
              type: "string"
            },
            {
              id: "cp1",
              name: "output.response.part_2",
              value: `={{ $node["Preserve Parts"].json.output.response.part_2 }}`,
              type: "string"
            },
            {
              id: "cp2",
              name: "output.response.part_3",
              value: `={{ $node["Preserve Parts"].json.output.response.part_3 }}`,
              type: "string"
            },
            {
              id: "cp3",
              name: "output.response.part_4",
              value: `={{ $node["Preserve Parts"].json.output.response.part_4 }}`,
              type: "string"
            }
          ]
        },
        options: {}
      },
      name: "Carry Parts",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [900, 300]
    };
    wf.nodes.push(carryNode);
    console.log("✅ Carry Parts Set node added");
  }

  // ── FIX 3: Rewire WA Cloud -> Carry Parts -> Wait2 ──
  // Show current connection from WA Cloud
  const waConn = wf.connections['WhatsApp Business Cloud'];
  console.log("WA Cloud was ->", JSON.stringify(waConn));

  wf.connections['WhatsApp Business Cloud'] = {
    main: [[{ node: "Carry Parts", type: "main", index: 0 }]]
  };
  wf.connections['Carry Parts'] = {
    main: [[{ node: "Wait2", type: "main", index: 0 }]]
  };
  console.log("✅ WA Cloud -> Carry Parts -> Wait2 wired");

  // ── FIX 4: If2..If5 and Cloud1,5,6,7 reference $json now (already done) ──
  // (these already use $json.output.response.partX and $json.number from previous fixes)

  // ── FIX 5: Preserve Parts node - fix number to use $node (correct reference at that stage) ──
  const preserveNode = wf.nodes.find(n => n.name === 'Preserve Parts');
  if (preserveNode && preserveNode.parameters.assignments) {
    const numAssign = preserveNode.parameters.assignments.assignments.find(a => a.name === 'number');
    if (numAssign) {
      numAssign.value = `={{ $node["WhatsApp Trigger"].json.body.data.key.remoteJid }}`;
      console.log("✅ Preserve Parts number ref fixed");
    }
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('\n✅ Architecture fixed!');
    console.log('Flow: Dividir -> Preserve Parts -> Log AI -> WA Cloud($node) -> Carry Parts -> Wait2 -> If2($json) -> Cloud1($json)');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
