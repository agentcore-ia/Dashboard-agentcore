const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const host = 'agentcore-n8n.8zp1cp.easypanel.host';
const headers = { 'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json' };

const req = https.request({
  hostname: host,
  path: '/api/v1/executions?workflowId=Im7A2yhhNTWFu05r&limit=1',
  method: 'GET',
  headers
}, res => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => {
    const execs = JSON.parse(d).data;
    if (execs && execs.length > 0) {
      const execId = execs[0].id;
      https.request({
        hostname: host,
        path: '/api/v1/executions/' + execId,
        method: 'GET',
        headers
      }, res2 => {
        let d2 = '';
        res2.on('data', c => d2+=c);
        res2.on('end', () => {
          const detail = JSON.parse(d2);
          console.log(JSON.stringify(detail, null, 2));
        });
      }).end();
    }
  });
});
req.end();
