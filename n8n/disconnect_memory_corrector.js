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
    
    // Sever all ai_memory connections to AI Correctotr1
    if (wf.connections) {
      Object.keys(wf.connections).forEach(sourceNode => {
        const outputs = wf.connections[sourceNode];
        if (outputs['ai_memory']) {
          const oldLen = outputs['ai_memory'].length;
          // Filter out connections targeting "AI Correctotr1"
          outputs['ai_memory'] = outputs['ai_memory'].map(arr => {
            return arr.filter(conn => conn.node !== 'AI Correctotr1' && conn.node !== 'AI Correctotr');
          }).filter(arr => arr.length > 0);
          
          if (outputs['ai_memory'].length === 0) {
            delete outputs['ai_memory'];
          }
          if (oldLen !== (outputs['ai_memory'] ? outputs['ai_memory'].length : 0)) {
            changed = true;
          }
        }
      });
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
      console.log("No memory connections to AI Correctotr algorithms found.");
    }
  } catch (err) {
    console.error(err);
  }
})();
