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

// Build a Set node that re-stamps remaining parts from $node["Carry Parts"]
// Since Carry Parts ran BEFORE Wait2, its $node[] reference is still valid after Wait resumes.
function makeRestampNode(name, partsToInclude, position) {
  const assignments = [
    {
      id: name + "_num",
      name: "number",
      value: `={{ $node["Carry Parts"].json.number }}`,
      type: "string"
    }
  ];
  partsToInclude.forEach((part, i) => {
    assignments.push({
      id: name + "_p" + i,
      name: `output.response.${part}`,
      value: `={{ $node["Carry Parts"].json["output.response.${part}"] }}`,
      type: "string"
    });
  });
  return {
    parameters: {
      mode: "manual",
      duplicateItem: false,
      assignments: { assignments },
      options: {}
    },
    name,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position
  };
}

async function main() {
  const wfs = await apiCall('GET', '/workflows');
  const meta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  if (!meta) throw new Error("Workflow not found");
  const wf = await apiCall('GET', `/workflows/${meta.id}`);

  // Current chain:
  // Cloud1 → If5 → Wait3 → Cloud5 → If3 → Wait6 → Cloud6 → If4 → Wait7 → Cloud7
  //
  // Need to insert Restamp nodes:
  // Cloud1 → Restamp After Cloud1 → If5 → Wait3 → Cloud5 → Restamp After Cloud5 → If3 → Wait6 → Cloud6 → Restamp After Cloud6 → If4

  // Add Restamp After Cloud1 (carries part_3, part_4)
  if (!wf.nodes.find(n => n.name === 'Restamp After Cloud1')) {
    wf.nodes.push(makeRestampNode('Restamp After Cloud1', ['part_3', 'part_4'], [1100, 100]));
    console.log("Added Restamp After Cloud1");
  }

  // Add Restamp After Cloud5 (carries part_4)
  if (!wf.nodes.find(n => n.name === 'Restamp After Cloud5')) {
    wf.nodes.push(makeRestampNode('Restamp After Cloud5', ['part_4'], [1100, 300]));
    console.log("Added Restamp After Cloud5");
  }

  // Rewire connections:
  // Cloud1 → Restamp After Cloud1 → If5
  wf.connections['WhatsApp Business Cloud1'] = {
    main: [[{ node: "Restamp After Cloud1", type: "main", index: 0 }]]
  };
  wf.connections['Restamp After Cloud1'] = {
    main: [[{ node: "If5", type: "main", index: 0 }]]
  };

  // Cloud5 → Restamp After Cloud5 → If3
  wf.connections['WhatsApp Business Cloud5'] = {
    main: [[{ node: "Restamp After Cloud5", type: "main", index: 0 }]]
  };
  wf.connections['Restamp After Cloud5'] = {
    main: [[{ node: "If3", type: "main", index: 0 }]]
  };

  // If5 conditions: check $json.output.response.part_3 (will be populated by Restamp After Cloud1)
  // If3 conditions: check $json.output.response.part_4 (will be populated by Restamp After Cloud5)
  // Update If5 leftValue
  const if5 = wf.nodes.find(n => n.name === 'If5');
  if (if5 && if5.parameters.conditions && if5.parameters.conditions.conditions) {
    if5.parameters.conditions.conditions[0].leftValue = `={{ $json["output.response.part_3"] || $json.output?.response?.part_3 }}`;
    console.log("Fixed If5 condition");
  }

  // Update If3 leftValue  
  const if3 = wf.nodes.find(n => n.name === 'If3');
  if (if3 && if3.parameters.conditions && if3.parameters.conditions.conditions) {
    if3.parameters.conditions.conditions[0].leftValue = `={{ $json["output.response.part_4"] || $json.output?.response?.part_4 }}`;
    console.log("Fixed If3 condition");
  }

  // Update Cloud5 (part_3) text to use $json
  const cloud5 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud5');
  if (cloud5) {
    const textParam = cloud5.parameters.bodyParameters.parameters.find(p => p.name === 'text');
    if (textParam) textParam.value = `={{ $json["output.response.part_3"] }}`;
    const numParam = cloud5.parameters.bodyParameters.parameters.find(p => p.name === 'number');
    if (numParam) numParam.value = `={{ $json.number }}`;
    console.log("Fixed Cloud5 params");
  }

  // Update Cloud6 (part_4) text to use $json
  const cloud6 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud6');
  if (cloud6) {
    const textParam = cloud6.parameters.bodyParameters.parameters.find(p => p.name === 'text');
    if (textParam) textParam.value = `={{ $json["output.response.part_4"] }}`;
    const numParam = cloud6.parameters.bodyParameters.parameters.find(p => p.name === 'number');
    if (numParam) numParam.value = `={{ $json.number }}`;
    console.log("Fixed Cloud6 params");
  }

  // Also fix Cloud1 to use flat key notation (Set node uses dot notation as key names)
  const cloud1 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud1');
  if (cloud1) {
    const textParam = cloud1.parameters.bodyParameters.parameters.find(p => p.name === 'text');
    if (textParam) textParam.value = `={{ $json["output.response.part_2"] }}`;
    const numParam = cloud1.parameters.bodyParameters.parameters.find(p => p.name === 'number');
    if (numParam) numParam.value = `={{ $json.number }}`;
    console.log("Fixed Cloud1 params to use flat key notation");
  }

  // Also fix Carry Parts Set node to use flat key notation for part_X fields
  const carryNode = wf.nodes.find(n => n.name === 'Carry Parts');
  if (carryNode && carryNode.parameters.assignments) {
    carryNode.parameters.assignments.assignments.forEach(a => {
      if (a.name.startsWith('output.response.')) {
        // The Set node stores these as flat keys when using "." in name
        // Keep as is - N8N Set node should handle this
        console.log("Carry Parts assignment:", a.name, "=", a.value);
      }
    });
  }

  // Fix If2 to use flat key notation too
  const if2 = wf.nodes.find(n => n.name === 'If2');
  if (if2 && if2.parameters.conditions && if2.parameters.conditions.conditions) {
    if2.parameters.conditions.conditions[0].leftValue = `={{ $json["output.response.part_2"] }}`;
    console.log("Fixed If2 to flat key notation");
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('\n✅ Restamp nodes inserted. Chain: Cloud1→Restamp→If5→Wait3→Cloud5→Restamp→If3→Wait6→Cloud6');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
