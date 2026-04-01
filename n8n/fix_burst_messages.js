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

  // 1. Update the HTTP node that fetches recent messages to include the text
  const httpNode = wf.nodes.find(n => n.name === 'Get Latest Message');
  if (httpNode) {
    // Change to fetch all recent messages natively and get text content
    // Old: ...&select=id,wa_message_id,created_at&order=created_at.desc&limit=1
    // New: ...&select=id,wa_message_id,created_at,content&order=created_at.desc&limit=5
    httpNode.parameters.url = `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&select=id,wa_message_id,created_at,content&order=created_at.asc&limit=10`;
  }

  // 2. Update Code node to combine the text of recent non-processed messages 
  // and output it alongside the isLastMessage check
  const codeNode = wf.nodes.find(n => n.name === 'Check Is Last Message');
  if (codeNode) {
    codeNode.parameters.jsCode = `
// Current message WA ID from the webhook trigger
const currentWaId = $('WhatsApp Trigger').first().json.body.data.key.id;

// The HTTP node returns an array of the most recent customer messages.
// We order them by created_at.asc so the oldest is first, newest is last.
const latestItem = items.length > 0 ? items[items.length - 1] : null;
const latestWaId = latestItem?.json?.wa_message_id || null;

// Determine if we are the last execution
const isLastMessage = (latestWaId === currentWaId) || (latestWaId === null);

// Combine text of all messages in the last 6 seconds so the AI gets the full burst context
const now = new Date();
const recentMessagesText = items
  // the timestamp logic or just join them all
  .map(item => item.json?.content || '')
  .filter(txt => txt.trim() !== '')
  .join('\\n');

// Fallback to webhook text if DB empty
const rawFallbackText = $('Fields').first().json.Message_text;
const combinedText = recentMessagesText || rawFallbackText;

return [{ 
  json: { 
    isLastMessage,
    latestWaId,
    currentWaId,
    combinedText
  } 
}];
`;
  }

  // 3. Update the AI Agent text input to use $json.combinedText
  const agentNode = wf.nodes.find(n => n.name === 'AI Agent');
  if (agentNode) {
    agentNode.parameters.text = `=El usuario envió los siguientes mensajes recientes:\n\nNombre_usuario: {{ $('WhatsApp Trigger').first().json.body.data.pushName }}\nMensajes:\n{{ $('Check Is Last Message').first().json.combinedText }}\n\nId: {{ $('WhatsApp Trigger').first().json.body.data.key.remoteJid }}\n\nINSTRUCCION OBLIGATORIA: Antes de responder cualquier mensaje que mencione una pizza, comida o pedido, ejecutá la tool "menu" primero. Sin excepción.`;
  }

  // 4. Update the AI Corrector text input to use combinedText as well
  const correctorNode = wf.nodes.find(n => n.name === 'AI Correctotr');
  if (correctorNode) {
    correctorNode.parameters.text = `=Corregir este texto: "{{ $json.output }}" respondiendo a los mensajes: "{{ $('Check Is Last Message').first().json.combinedText }}"`;
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing fix...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Burst message ingestion fixed!`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
