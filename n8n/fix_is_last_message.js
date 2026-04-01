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

// Fixed code: actually checks if the current message is truly the last one in the DB.
// The debounce waits 4s. If another message arrived in those 4s, it will be newer in the DB.
// We compare the current WhatsApp message ID with the latest DB entry's external_id.
const FIXED_CHECK_CODE = `
const messages = $input.all();

let texts = [];
for (const m of messages) {
    const content = (m.json.content || m.json.message || '').trim();
    if (!content) continue;
    if (content.toLowerCase() === '/clear') break;
    texts.push(content);
}

const combinedText = texts.reverse().join('\\n\\n');
const latestMsg = messages.length > 0 ? messages[0].json : {};

// Get the WhatsApp message ID of the CURRENT execution's incoming message
const currentWAMsgId = (
  $node["WhatsApp Trigger"]?.json?.body?.data?.key?.id || 
  $node["Edit Fields"]?.json?.messageId ||
  ''
);

// The latest DB message's wa_message_id (stored when we log incoming messages)
const latestDbMsgId = (latestMsg.wa_message_id || latestMsg.external_id || '');

// Current message content (fallback for ID-based comparison)
const currentContent = (
  $node["Edit Fields"]?.json?.message ||
  $node["Fields"]?.json?.message ||
  $node["WhatsApp Trigger"]?.json?.body?.data?.message?.conversation ||
  $node["WhatsApp Trigger"]?.json?.body?.data?.message?.extendedTextMessage?.text ||
  ''
).trim();
const latestContent = (latestMsg.content || '').trim();

// isLastMessage = true ONLY if no newer message exists in DB
// Preference: compare by ID. Fallback: compare by content.
let isLastMessage;
if (currentWAMsgId && latestDbMsgId) {
  isLastMessage = currentWAMsgId === latestDbMsgId;
} else {
  // Fallback: if the latest DB message content matches current content, it's the last
  isLastMessage = latestContent === currentContent || currentContent === '';
}

return [{
  json: {
    ...latestMsg,
    isLastMessage,
    combinedText: combinedText || latestMsg.content || ''
  }
}];
`;

async function main() {
  const wfs = await apiCall('GET', '/workflows');
  const meta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  const wf = await apiCall('GET', `/workflows/${meta.id}`);

  const node = wf.nodes.find(n => n.name === 'Check Is Last Message');
  if (!node) throw new Error('Node not found');
  
  node.parameters.jsCode = FIXED_CHECK_CODE;
  console.log("✅ Fixed 'Check Is Last Message': now actually compares current msg ID with latest DB entry");

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } };
  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('✅ Updated! The debounce will now correctly drop old executions when a newer message arrived.');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
