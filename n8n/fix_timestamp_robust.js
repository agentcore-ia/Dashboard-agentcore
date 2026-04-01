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

  // 1. ROBUST Memory Manager
  const mmNode = wf.nodes.find(n => n.name === 'Memory Manager');
  if (mmNode) {
    mmNode.parameters.jsCode = `
const staticData = $getWorkflowStaticData('global');
const triggerPhone = $('WhatsApp Trigger').first().json.body?.data?.key?.remoteJid;

let text = "";
const msg = $('WhatsApp Trigger').first().json.body?.data?.message;
if (msg) { text = msg.conversation || msg.extendedTextMessage?.text || ""; }

// Handle migration from old number format to new object format
if (typeof staticData[triggerPhone] !== 'object') {
    const oldV = staticData[triggerPhone] || 1;
    staticData[triggerPhone] = { v: oldV, resetAt: "1970-01-01T00:00:00Z" };
}

let isClearCommand = false;
if (text.trim().toLowerCase() === '/clear') {
    staticData[triggerPhone].v += 1;
    staticData[triggerPhone].resetAt = new Date().toISOString();
    isClearCommand = true;
}

// Fallback to avoid empty output
const finalResetAt = staticData[triggerPhone].resetAt || "1970-01-01T00:00:00Z";

return [{
    json: {
        memorySessionId: triggerPhone + "_v" + staticData[triggerPhone].v,
        resetAt: finalResetAt,
        isClearCommand: isClearCommand,
        text: text
    }
}];`;
  }

  // 2. Ensure Get Latest Message node has a safe default as well in expression
  const getLatestNode = wf.nodes.find(n => n.name === 'Get Latest Message');
  if (getLatestNode) {
    // Correct URL with encodeURIComponent for the timestamp if needed? No, PostgREST handles it if clean ISO.
    getLatestNode.parameters.url = `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&select=id,wa_message_id,created_at,content&order=created_at.desc&limit=10&created_at=gt.{{ $('Memory Manager').first().json.resetAt || '1970-01-01T00:00:00Z' }}`;
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing robust reset fix...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Robust reset logic applied! No more empty timestamps.`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
