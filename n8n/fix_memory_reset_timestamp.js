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

  // 1. Update Memory Manager to track 'resetDate' instead of just version
  const mmNode = wf.nodes.find(n => n.name === 'Memory Manager');
  if (mmNode) {
    mmNode.parameters.jsCode = `
const staticData = $getWorkflowStaticData('global');
const triggerPhone = $('WhatsApp Trigger').first().json.body?.data?.key?.remoteJid;

// Extract message text safely
let text = "";
const msg = $('WhatsApp Trigger').first().json.body?.data?.message;
if (msg) {
  text = msg.conversation || msg.extendedTextMessage?.text || "";
}

// Memory Version (current v)
staticData[triggerPhone] = staticData[triggerPhone] || { v: 1, resetAt: "1970-01-01T00:00:00Z" };

let isClearCommand = false;
if (text.trim().toLowerCase() === '/clear') {
    staticData[triggerPhone].v += 1;
    staticData[triggerPhone].resetAt = new Date().toISOString();
    isClearCommand = true;
}

return [{
    json: {
        memorySessionId: triggerPhone + "_v" + staticData[triggerPhone].v,
        resetAt: staticData[triggerPhone].resetAt,
        isClearCommand: isClearCommand,
        text: text
    }
}];`;
  }

  // 2. Update 'Get Latest Message' Supabase query to filter created_at > resetAt
  const getLatestNode = wf.nodes.find(n => n.name === 'Get Latest Message');
  if (getLatestNode) {
    // Current query: ...&created_at=gte.{{ $now.minus(300000).toISO() }}
    // New query: compare both 5-mins-ago and resetAt, pick the newest.
    // Logic: created_at=gte.{{ 
    //   new Date(Math.max(new Date($now.minus(300000).toISO()).getTime(), new Date($('Memory Manager').first().json.resetAt).getTime())).toISOString() 
    // }}
    
    // Actually, n8n expression handles this better:
    getLatestNode.parameters.url = `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&select=id,wa_message_id,created_at,content&order=created_at.desc&limit=10&created_at=gt.{{ $('Memory Manager').first().json.resetAt }}`;
    // We already have a 5-min window in the agent prompt logic, but let's just use the resetAt which is cleaner.
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing "resetAt" logic...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ /clear logic now respects database history with resetAt timestamps.`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
