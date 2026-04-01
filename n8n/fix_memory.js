const fs = require('fs');
let wf = JSON.parse(fs.readFileSync('tmp_ai_workflow.json', 'utf8'));

// Update Memory Manager Code
const mmNode = wf.nodes.find(n => n.name === 'Memory Manager');
mmNode.parameters.jsCode = `
const staticData = $getWorkflowStaticData('global');
const triggerPhone = $('WhatsApp Trigger').first().json.body?.data?.key?.remoteJid;
const now = Date.now();

let text = "";
const msg = $('WhatsApp Trigger').first().json.body?.data?.message;
if (msg) { text = msg.conversation || msg.extendedTextMessage?.text || ""; }

if (typeof staticData[triggerPhone] !== 'object') {
    staticData[triggerPhone] = { v: 1, resetAt: "1970-01-01T00:00:00Z", lastMsg: now };
}

if (now - (staticData[triggerPhone].lastMsg || 0) > 4 * 60 * 60 * 1000) {
    staticData[triggerPhone].v += 1;
    staticData[triggerPhone].resetAt = new Date().toISOString();
}

let isClearCommand = false;
if (text.trim().toLowerCase() === '/clear') {
    staticData[triggerPhone].v += 1;
    staticData[triggerPhone].resetAt = new Date().toISOString();
    isClearCommand = true;
}

staticData[triggerPhone].lastMsg = now;

return [{
    json: {
        memorySessionId: triggerPhone + "_v" + staticData[triggerPhone].v,
        resetAt: staticData[triggerPhone].resetAt || "1970-01-01T00:00:00Z",
        isClearCommand: isClearCommand,
        text: text
    }
}];`;

// Update Memory Node back to original
const memoryNode = wf.nodes.find(n => n.name === 'memoria');
memoryNode.parameters.sessionKey = "={{ $('Memory Manager').first().json.memorySessionId }}";

// Update AI Agent Tool Description
const toolNode = wf.nodes.find(n => n.name === 'Orden');
if (toolNode) {
  toolNode.parameters.description = "🚨 REGLA ESTRICTA: Llamar a esta herramienta ÚNICAMENTE UNA VEZ por pedido, y SOLO cuando el cliente haya confirmado TODO: detalle, forma de entrega, dirección y forma de pago. NUNCA la llames de manera preliminar ni varias veces para el mismo pedido. Si ya la llamaste, no la vuelvas a llamar a menos que quiera un segundo pedido.";
}

const updatePayload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: {
    saveDataErrorExecution: "all",
    saveDataSuccessExecution: "all"
  }
};

const https = require('https');
const options = {
  method: 'PUT',
  hostname: 'agentcore-n8n.8zp1cp.easypanel.host',
  path: '/api/v1/workflows/Sbf4ewHwOCdsruMv',
  headers: {
    'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, res => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => console.log('UPDATE STATUS:', res.statusCode, d));
});
req.on('error', console.error);
req.write(JSON.stringify(updatePayload));
req.end();
