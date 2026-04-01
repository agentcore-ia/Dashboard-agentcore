const https = require('https');
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

function apiCall() {
  return new Promise((resolve) => {
    https.request({
      hostname: 'agentcore-n8n.8zp1cp.easypanel.host',
      path: '/api/v1/node-types',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Accept': 'application/json' }
    }, res => {
      let b=''; res.on('data', c=>b+=c); res.on('end', ()=>resolve(JSON.parse(b)));
    }).end();
  });
}

async function main() {
    const res = await apiCall();
    const arr = Array.isArray(res) ? res : res.data;
    if (!arr) return console.log('No data', res);
    
    const tools = arr.map(t => t.name).filter(n => n.toLowerCase().includes('tool'));
    console.log(tools.join('\n'));
}

main();
