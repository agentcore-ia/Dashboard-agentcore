const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const host = 'agentcore-n8n.8zp1cp.easypanel.host';
const headers = { 'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' };
const wfId = 'Sbf4ewHwOCdsruMv';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = { hostname: host, path, method, headers };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d+=c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    const wf = await request('GET', '/api/v1/workflows/' + wfId);
    if(!wf || !wf.nodes) return console.log('Error', wf);
    
    let changed = false;
    for (let node of wf.nodes) {
      if (node.name === 'Filtro Echo' && node.type === 'n8n-nodes-base.code') {
        node.parameters.jsCode = `
// Verificar formato de Instagram
const entry = $input.item.json?.body?.entry;
if (!entry || !entry[0] || !entry[0].messaging || !entry[0].messaging[0].message) {
  // No es un mensaje de Instagram o no tiene el formato esperado, dejar pasar
  return $input.item;
}

const msg = entry[0].messaging[0].message;

// Filtrar si es un echo (mensaje enviado por nosotros)
if (msg.is_echo || msg.is_self) {
  return [];
}

// O si el texto viene vacio
if (!msg.text) {
  return [];
}

return $input.item;
`;
        changed = true;
      }
    }
    
    if (changed) {
      delete wf.settings?.availableInMCP;
      const payload = {
        name: wf.name,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: {},
      };
      const updated = await request('PUT', '/api/v1/workflows/' + wfId, payload);
      console.log("Updated workflow:", updated.id);
    } else {
      console.log("No Filtro Echo found or not a code node.");
    }
  } catch (err) {
    console.error(err);
  }
})();
