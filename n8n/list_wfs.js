const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const options = {
  hostname: 'agentcore-n8n.8zp1cp.easypanel.host',
  path: '/api/v1/workflows',
  method: 'GET',
  headers: { 'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json' }
};
const req = https.request(options, res => {
  let d = '';
  res.on('data', chunk => { d += chunk; });
  res.on('end', () => {
    try {
      const resp = JSON.parse(d);
      const wfs = resp.data.map(w => ({id: w.id, name: w.name}));
      console.log(JSON.stringify(wfs, null, 2));
    } catch(e) {
      console.error('Error parsing:', e.message);
    }
  });
});
req.on('error', e => console.error(e.message));
req.end();
