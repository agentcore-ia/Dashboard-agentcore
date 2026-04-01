const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

function apiCall(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const opts = {
      method, hostname: url.hostname, path: url.pathname,
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(opts, res => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(new Error(body)); } });
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

  const TRIGGER = 'WhatsApp Trigger';
  const DIVIDIR = 'Dividir mensaje';
  const EVOLUTION_URL = '=https://agentcore-evolution-api.8zp1cp.easypanel.host/message/sendText/agentcore%20test';
  const EVOLUTION_KEY = '465E65D048F8-42B4-B162-4CF3107E70D8';
  const NUM_EXPR = `={{ $node["${TRIGGER}"].json.body.data.key.remoteJid }}`;

  // ── Fix WA Cloud (part_1): restore direct $node["Dividir mensaje"] refs ──
  const waCloud = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud');
  if (waCloud) {
    const p = waCloud.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = NUM_EXPR;
    p.find(x => x.name === 'text').value    = `={{ $node["${DIVIDIR}"].json.output.response.part_1 }}`;
    console.log('✅ WA Cloud (part_1): $node refs restored');
  }

  // ── Rewire WA Cloud → Wait2 (remove Send Remaining Parts from chain) ──
  wf.connections['WhatsApp Business Cloud'] = {
    main: [[{ node: 'Wait2', type: 'main', index: 0 }]]
  };
  console.log('✅ WA Cloud → Wait2 (direct, no intermediate nodes)');

  // ── Fix If2: check $node["Dividir"] part_2 ──
  const if2 = wf.nodes.find(n => n.name === 'If2');
  if (if2) {
    if2.parameters.conditions.conditions[0].leftValue = `={{ $node["${DIVIDIR}"].json.output.response.part_2 }}`;
    console.log('✅ If2: $node["Dividir"].part_2');
  }

  // ── Fix WA Cloud1 (part_2) ──
  const waCloud1 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud1');
  if (waCloud1) {
    const p = waCloud1.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = NUM_EXPR;
    p.find(x => x.name === 'text').value   = `={{ $node["${DIVIDIR}"].json.output.response.part_2 }}`;
    console.log('✅ WA Cloud1 (part_2): $node refs');
  }

  // Cloud1 → If5
  wf.connections['WhatsApp Business Cloud1'] = {
    main: [[{ node: 'If5', type: 'main', index: 0 }]]
  };

  // ── Fix If5: check $node["Dividir"] part_3 ──
  const if5 = wf.nodes.find(n => n.name === 'If5');
  if (if5) {
    if5.parameters.conditions.conditions[0].leftValue = `={{ $node["${DIVIDIR}"].json.output.response.part_3 }}`;
    console.log('✅ If5: $node["Dividir"].part_3');
  }

  // If5 true → Wait3
  wf.connections['If5'] = {
    main: [
      [{ node: 'Wait3', type: 'main', index: 0 }],  // true
      [{ node: 'If3',   type: 'main', index: 0 }]   // false → skip to If3 (check part_4)
    ]
  };

  // ── Fix WA Cloud5 (part_3) ──
  const waCloud5 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud5');
  if (waCloud5) {
    const p = waCloud5.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = NUM_EXPR;
    p.find(x => x.name === 'text').value   = `={{ $node["${DIVIDIR}"].json.output.response.part_3 }}`;
    console.log('✅ WA Cloud5 (part_3): $node refs');
  }

  // Cloud5 → If3
  wf.connections['WhatsApp Business Cloud5'] = {
    main: [[{ node: 'If3', type: 'main', index: 0 }]]
  };

  // ── Fix If3: check $node["Dividir"] part_4 ──
  const if3 = wf.nodes.find(n => n.name === 'If3');
  if (if3) {
    if3.parameters.conditions.conditions[0].leftValue = `={{ $node["${DIVIDIR}"].json.output.response.part_4 }}`;
    console.log('✅ If3: $node["Dividir"].part_4');
  }

  // If3 true → Wait6
  wf.connections['If3'] = {
    main: [
      [{ node: 'Wait6', type: 'main', index: 0 }],  // true
      []                                               // false → end
    ]
  };

  // ── Fix WA Cloud6 (part_4) ──
  const waCloud6 = wf.nodes.find(n => n.name === 'WhatsApp Business Cloud6');
  if (waCloud6) {
    const p = waCloud6.parameters.bodyParameters.parameters;
    p.find(x => x.name === 'number').value = NUM_EXPR;
    p.find(x => x.name === 'text').value   = `={{ $node["${DIVIDIR}"].json.output.response.part_4 }}`;
    console.log('✅ WA Cloud6 (part_4): $node refs');
  }

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } };
  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('\n✅ Restored clean native chain:');
    console.log('WA Cloud(p1) → Wait2 → If2 → Cloud1(p2) → If5 → Wait3 → Cloud5(p3) → If3 → Wait6 → Cloud6(p4)');
    console.log('All using $node["Dividir mensaje"] directly — works across Wait nodes.');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
