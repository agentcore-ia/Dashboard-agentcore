const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

function apiCall(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const options = {
      method, hostname: url.hostname, path: url.pathname,
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let body = ''; res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); } });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  const wfs = await apiCall('GET', '/workflows');
  const meta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  const wf = await apiCall('GET', `/workflows/${meta.id}`);

  // SIMPLIFIED APPROACH: Use flat variable names (p1, p2, p3, p4, num) throughout entire chain
  // This avoids any nested/dot-notation confusion in N8N Set nodes

  // ── Fix Preserve Parts ── store as p1, p2, p3, p4, num (simple flat keys)
  const preserveNode = wf.nodes.find(n => n.name === 'Preserve Parts');
  if (preserveNode) {
    preserveNode.parameters.assignments.assignments = [
      { id: "pp_num", name: "num", value: `={{ $node["WhatsApp Trigger"].json.body.data.key.remoteJid }}`, type: "string" },
      { id: "pp1", name: "p1", value: `={{ $json.output.response.part_1 }}`, type: "string" },
      { id: "pp2", name: "p2", value: `={{ $json.output.response.part_2 }}`, type: "string" },
      { id: "pp3", name: "p3", value: `={{ $json.output.response.part_3 }}`, type: "string" },
      { id: "pp4", name: "p4", value: `={{ $json.output.response.part_4 }}`, type: "string" }
    ];
    console.log("✅ Preserve Parts: simplified to p1..p4, num");
  }

  // ── Fix Carry Parts ── re-stamp from Preserve Parts using $node[] 
  const carryNode = wf.nodes.find(n => n.name === 'Carry Parts');
  if (carryNode) {
    carryNode.parameters.assignments.assignments = [
      { id: "cp_num", name: "num", value: `={{ $node["Preserve Parts"].json.num }}`, type: "string" },
      { id: "cp2", name: "p2", value: `={{ $node["Preserve Parts"].json.p2 }}`, type: "string" },
      { id: "cp3", name: "p3", value: `={{ $node["Preserve Parts"].json.p3 }}`, type: "string" },
      { id: "cp4", name: "p4", value: `={{ $node["Preserve Parts"].json.p4 }}`, type: "string" }
    ];
    console.log("✅ Carry Parts: simplified to p2..p4, num using $node[Preserve Parts]");
  }

  // ── Fix Restamp After Cloud1 ── re-stamp p3, p4 from Carry Parts (pre-Wait2 node)
  const restamp1 = wf.nodes.find(n => n.name === 'Restamp After Cloud1');
  if (restamp1) {
    restamp1.parameters.assignments.assignments = [
      { id: "r1_num", name: "num", value: `={{ $node["Carry Parts"].json.num }}`, type: "string" },
      { id: "r1_p3", name: "p3", value: `={{ $node["Carry Parts"].json.p3 }}`, type: "string" },
      { id: "r1_p4", name: "p4", value: `={{ $node["Carry Parts"].json.p4 }}`, type: "string" }
    ];
    console.log("✅ Restamp After Cloud1: simplified to p3..p4, num using $node[Carry Parts]");
  }

  // ── Fix Restamp After Cloud5 ── re-stamp p4 from Restamp After Cloud1
  const restamp2 = wf.nodes.find(n => n.name === 'Restamp After Cloud5');
  if (restamp2) {
    restamp2.parameters.assignments.assignments = [
      { id: "r2_num", name: "num", value: `={{ $node["Restamp After Cloud1"].json.num }}`, type: "string" },
      { id: "r2_p4", name: "p4", value: `={{ $node["Restamp After Cloud1"].json.p4 }}`, type: "string" }
    ];
    console.log("✅ Restamp After Cloud5: simplified to p4, num using $node[Restamp After Cloud1]");
  }

  // ── Fix WA Cloud (part_1) ── use $node["Preserve Parts"] (pre-Log AI, still accessible)
  const waCloud = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud');
  if (waCloud) {
    const p = waCloud.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = `={{ $node["Preserve Parts"].json.num }}`;
    p.find(x => x.name === 'text').value = `={{ $node["Preserve Parts"].json.p1 }}`;
    console.log("✅ WA Cloud part_1: uses $node[Preserve Parts].json.p1");
  }

  // ── Fix WA Cloud1 (part_2) ── receives from Carry Parts via Wait2 → If2
  const waCloud1 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud1');
  if (waCloud1) {
    const p = waCloud1.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = `={{ $json.num }}`;
    p.find(x => x.name === 'text').value = `={{ $json.p2 }}`;
    console.log("✅ WA Cloud1 part_2: uses $json.p2");
  }

  // ── Fix WA Cloud5 (part_3) ── receives from Restamp After Cloud1 via Wait3
  const waCloud5 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud5');
  if (waCloud5) {
    const p = waCloud5.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = `={{ $json.num }}`;
    p.find(x => x.name === 'text').value = `={{ $json.p3 }}`;
    console.log("✅ WA Cloud5 part_3: uses $json.p3");
  }

  // ── Fix WA Cloud6 (part_4) ── receives from Restamp After Cloud5 via Wait6
  const waCloud6 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud6');
  if (waCloud6) {
    const p = waCloud6.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = `={{ $json.num }}`;
    p.find(x => x.name === 'text').value = `={{ $json.p4 }}`;
    console.log("✅ WA Cloud6 part_4: uses $json.p4");
  }

  // ── Fix If2 ── check $json.p2
  const if2 = wf.nodes.find(n => n.name === 'If2');
  if (if2) { if2.parameters.conditions.conditions[0].leftValue = `={{ $json.p2 }}`; console.log("✅ If2: $json.p2"); }

  // ── Fix If5 ── check $json.p3
  const if5 = wf.nodes.find(n => n.name === 'If5');
  if (if5) { if5.parameters.conditions.conditions[0].leftValue = `={{ $json.p3 }}`; console.log("✅ If5: $json.p3"); }

  // ── Fix If3 ── check $json.p4
  const if3 = wf.nodes.find(n => n.name === 'If3');
  if (if3) { if3.parameters.conditions.conditions[0].leftValue = `={{ $json.p4 }}`; console.log("✅ If3: $json.p4"); }

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: "v1" } };
  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('\n✅ All simplified! Using flat keys p1..p4, num throughout entire chain.');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
