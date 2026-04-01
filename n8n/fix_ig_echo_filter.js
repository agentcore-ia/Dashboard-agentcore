const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const host = 'agentcore-n8n.8zp1cp.easypanel.host';
const headers = { 'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json', 'Content-Type': 'application/json' };
const wfId = 'Im7A2yhhNTWFu05r';

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
    
    // Add an IF node
    if (!wf.nodes.find(n => n.name === 'Filtro Echo')) {
      wf.nodes.push({
        "parameters": {
          "jsCode": "const msg = $input.item.json.body.entry[0].messaging[0].message;\nif (msg.is_echo || msg.is_self || !msg.text) {\n  return [];\n}\nreturn $input.item;"
        },
        "id": "e2baaef2-2b63-471a-8260-cb7127e997f0",
        "name": "Filtro Echo",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          1400,
          -60
        ]
      });
      
      // Update connections
      if (wf.connections["Webhook"]) {
        wf.connections["Webhook"] = {
          "main": [
            [
              {
                "node": "Filtro Echo",
                "type": "main",
                "index": 0
              }
            ]
          ]
        };
      }
      
      wf.connections["Filtro Echo"] = {
        "main": [
          [
            {
              "node": "AI Agent",
              "type": "main",
              "index": 0
            }
          ]
        ]
      };
    }

    // Also we need to ensure the variables in HTTP Request stay accurate but we can just leave it since the IF node passes exactly what came in.
    
    // Clean to avoid API error
    delete wf.settings?.availableInMCP;

    const payload = {
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: {},
    };

    const updated = await request('PUT', '/api/v1/workflows/' + wfId, payload);
    console.log("Updated workflow:", updated.id);
  } catch (err) {
    console.error(err);
  }
})();
