// Replace complex Code nodes with simple HTTP Request nodes calling the Edge Function
const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";
const EDGE_FN_URL = "https://eqnjyygokjinmsfvogxi.supabase.co/functions/v1/log-whatsapp-message";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE";

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
  console.log(`   Got: "${wf.name}" with ${wf.nodes.length} nodes`);

  // Remove all our Supabase nodes (both old Code node versions)
  wf.nodes = wf.nodes.filter(n =>
    n.name !== 'Log Incoming to Supabase' &&
    n.name !== 'Log AI Response to Supabase'
  );

  // Clean up connections to old nodes
  if (wf.connections["Fields"] && wf.connections["Fields"].main) {
    wf.connections["Fields"].main[0] = wf.connections["Fields"].main[0].filter(
      c => c.node !== "Log Incoming to Supabase"
    );
  }
  if (wf.connections["Dividir mensaje"] && wf.connections["Dividir mensaje"].main) {
    wf.connections["Dividir mensaje"].main[0] = wf.connections["Dividir mensaje"].main[0].filter(
      c => c.node !== "Log AI Response to Supabase"
    );
  }

  console.log(`   After cleanup: ${wf.nodes.length} nodes`);

  // NEW: Simple HTTP Request nodes — no Code, no complex logic.
  // n8n's HTTP Request node is rock-solid and never hangs.
  const logIncomingNode = {
    id: "supabase-incoming-http",
    name: "Log Incoming to Supabase",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-14050, 300],
    onError: "continueErrorOutput",
    parameters: {
      method: "POST",
      url: EDGE_FN_URL,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "apikey", value: SUPABASE_ANON_KEY }
        ]
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={{ JSON.stringify({
  phone: $('WhatsApp Trigger').item.json.body.data.key.remoteJid,
  name: $('WhatsApp Trigger').item.json.body.data.pushName || 'Sin nombre',
  messageText: $('Fields').item.json.Message_text || '',
  messageType: $('Fields').item.json.Message_type || 'text',
  sender: 'customer'
}) }}`,
      options: {
        timeout: 8000
      }
    }
  };

  const logOutgoingNode = {
    id: "supabase-outgoing-http",
    name: "Log AI Response to Supabase",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-13400, 300],
    onError: "continueErrorOutput",
    parameters: {
      method: "POST",
      url: EDGE_FN_URL,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "apikey", value: SUPABASE_ANON_KEY }
        ]
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={{ JSON.stringify({
  phone: $('WhatsApp Trigger').item.json.body.data.key.remoteJid,
  name: $('WhatsApp Trigger').item.json.body.data.pushName || 'Sin nombre',
  messageText: [$('Dividir mensaje').item.json.output.response.part_1, $('Dividir mensaje').item.json.output.response.part_2, $('Dividir mensaje').item.json.output.response.part_3, $('Dividir mensaje').item.json.output.response.part_4].filter(p => p && p.trim()).join('\\n'),
  messageType: 'text',
  sender: 'ai'
}) }}`,
      options: {
        timeout: 8000
      }
    }
  };

  wf.nodes.push(logIncomingNode);
  wf.nodes.push(logOutgoingNode);

  // Add connections (parallel to existing flow)
  if (wf.connections["Fields"] && wf.connections["Fields"].main) {
    wf.connections["Fields"].main[0].push({
      node: "Log Incoming to Supabase",
      type: "main",
      index: 0
    });
  }

  if (wf.connections["Dividir mensaje"] && wf.connections["Dividir mensaje"].main) {
    wf.connections["Dividir mensaje"].main[0].push({
      node: "Log AI Response to Supabase",
      type: "main",
      index: 0
    });
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Updating workflow...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Updated! Now has ${result.nodes.length} nodes.`);
    await apiCall('POST', `/workflows/${WORKFLOW_ID}/activate`, {});
    console.log('   ✅ Workflow activated!');
  } else {
    console.log('   ❌ Error:', JSON.stringify(result).substring(0, 600));
  }
}

main().catch(console.error);
