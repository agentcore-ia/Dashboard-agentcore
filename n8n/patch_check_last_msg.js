
const https = require('https');
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const N8N_URL = 'https://agentcore-n8n.8zp1cp.easypanel.host/api/v1';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_URL + path);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
const fs = require('fs');

const wfData = JSON.parse(fs.readFileSync('inspect_stuck_wf.json', 'utf16le').replace(/^\uFEFF/, ''));

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE";

const ATOMIC_LOGIC = `
try {
  // Use the first item from previous nodes for context
  const triggerItem = $node["WhatsApp Trigger"].first();
  const currentID = triggerItem.json.body?.data?.key?.id;
  
  const logItem = $node["Log Incoming to Supabase"].first();
  const convId = logItem.json.conversacion_id;

  if (!convId || !currentID) {
    return [{ json: { isLastMessage: true, reason: 'missing_ids' } }];
  }

  // Fetch only the absolute latest from Supabase
  const url = \`https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/mensajes?conversacion_id=eq.\${convId}&order=created_at.desc&limit=1&select=wa_message_id,external_id\`;
  
  const response = await fetch(url, {
    headers: { 'apikey': '${SUPABASE_ANON_KEY}' }
  });
  
  const data = await response.json();
  const latestID = data[0]?.wa_message_id || data[0]?.external_id;

  // Compare THIS execution's ID with what's now in the database
  const isLastMessage = (currentID === latestID);
  
  return [{ json: { isLastMessage, currentID, latestID, combinedText: logItem.json.Message_text || "" } }];
} catch (e) {
    process.exit(1);
  }
  
  console.log('Original code found. Updating...');
  node.parameters.jsCode = NEW_CODE;
  
  // SANITIZE: Narrow down to the bare minimum
  const cleanWf = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: {
        executionOrder: wf.settings.executionOrder || 'v1'
    }
  };

  console.log('Updating workflow with minimal fields...');
  const res = await apiRequest('PUT', '/workflows/Sbf4ewHwOCdsruMv', cleanWf);
  
  if (res.id) {
    console.log('Update success. Workflow updated.');
  } else {
    console.error('Update failed:', res);
  }
}

main().catch(console.error);
