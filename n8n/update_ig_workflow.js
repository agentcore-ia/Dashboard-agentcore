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
    const wf = await request('GET', `/api/v1/workflows/${wfId}`);
    if(!wf || !wf.nodes) {
      console.log('Error: Could not retrieve workflow', wf);
      return;
    }
    
    for (let node of wf.nodes) {
      if (node.name === 'AI Agent') {
        node.parameters.text = "=Número de Cliente: {{ $('Webhook').first().json.body.entry[0].messaging[0].sender.id }}\\nNombre: Cliente Instagram\\nMensaje: {{ $('Webhook').first().json.body.entry[0].messaging[0].message.text }}";
      }
      else if (node.name === 'Window Buffer Memory1') {
        node.parameters.sessionKey = "={{'IG_' + $('Webhook').first().json.body.entry[0].messaging[0].sender.id}}";
      }
      else if (node.name === 'HTTP Request') {
        node.parameters.jsonBody = "={\n  \"recipient\": {\n    \"id\": \"{{ $('Webhook').first().json.body.entry[0].messaging[0].sender.id }}\"\n  },\n  \"message\": {\n    \"text\": \"{{ $json.text }}\"\n  },\n  \"messaging_type\": \"RESPONSE\"\n}";
      }
      else if (node.name === 'Dividir mensaje') {
        node.parameters.jsCode = `
const texto = $('AI Correctotr').first().json.output || "";
if (!texto) return [];

const trozos = [];
let actual = "";
const oraciones = texto.split(/(?<=[.?!])\\s+/);
for(const o of oraciones) {
  if((actual + " " + o).length > 950) {
    trozos.push(actual.trim());
    actual = o;
  } else {
    actual += (actual ? " " : "") + o;
  }
}
if(actual.trim()) trozos.push(actual.trim());

if (trozos.length === 0) return [{ json: { text: texto } }];
return trozos.map(t => ({ json: { text: t } }));
`;
      }
      else if (node.name === 'Simple Memory') {
        node.parameters.sessionIdType = "customKey";
        node.parameters.sessionKey = "={{'IG_' + $('Webhook').first().json.body.entry[0].messaging[0].sender.id}}";
      }
    }
    
    const payload = {
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: {},
    };

    const updated = await request('PUT', `/api/v1/workflows/${wfId}`, payload);
    console.log("Updated workflow API Response:", updated.id ? "Success, ID: " + updated.id : updated);
  } catch (err) {
    console.error(err);
  }
})();
