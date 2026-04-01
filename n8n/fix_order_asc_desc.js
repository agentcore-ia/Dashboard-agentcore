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

  // 1. Update the HTTP node that fetches recent messages 
  const httpNode = wf.nodes.find(n => n.name === 'Get Latest Message');
  if (httpNode) {
    // IMPORTANT FIX: order=created_at.desc gets the 10 NEWEST.
    // ASC + limit=10 was getting the 10 OLDEST, meaning the AI
    // never actually saw the newest message if the convo > 10 msgs!
    httpNode.parameters.url = `=https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.{{ $('Log Incoming to Supabase').first().json.conversacion_id }}&sender=eq.customer&select=id,wa_message_id,created_at,content&order=created_at.desc&limit=10`;
  }

  // 2. Update Code node to reverse the DESC array and evaluate correctly
  const codeNode = wf.nodes.find(n => n.name === 'Check Is Last Message');
  if (codeNode) {
    codeNode.parameters.jsCode = `
// Current message WA ID from the webhook trigger
const currentWaId = $('WhatsApp Trigger').first().json.body.data.key.id;

// The HTTP node returns an array of the most recent customer messages IN DESCENDING ORDER.
// That means items[0] is the absolute newest message in the database.
const latestItem = items.length > 0 ? items[0] : null;
const latestWaId = latestItem?.json?.wa_message_id || null;

// Determine if we are the last execution
const isLastMessage = (latestWaId === currentWaId) || (latestWaId === null);

// Combine text of all messages in correctly ordered chronology (oldest to newest)
// Since items is DESC, we read it backwards:
const recentMessagesText = [...items].reverse()
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

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing fix...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Query order fixed! Using .desc and JS Array.reverse()`);
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
