const https = require('https');
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

function apiCall(id) {
  return new Promise((resolve) => {
    https.request({
      hostname: 'agentcore-n8n.8zp1cp.easypanel.host',
      path: '/api/v1/executions/' + id + '?includeData=true',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Accept': 'application/json' }
    }, res => {
      let b=''; res.on('data', c=>b+=c); res.on('end', ()=>resolve(JSON.parse(b)));
    }).end();
  });
}

async function main() {
  const listParams = {
    hostname: 'agentcore-n8n.8zp1cp.easypanel.host',
    path: '/api/v1/executions?limit=3',
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Accept': 'application/json' }
  };
  
  const b = await new Promise(res => {
    https.request(listParams, r => {
      let buf=''; r.on('data', c=>buf+=c); r.on('end', ()=>res(JSON.parse(buf)))
    }).end();
  });
  
  for (const info of b.data) {
    if (info.workflowId !== "Sbf4ewHwOCdsruMv") continue;
    const ex = await apiCall(info.id);
    const rd = ex.data?.resultData?.runData;
    if (!rd) continue;
    if (rd['Memory Manager']) {
      console.log('EXEC', info.id);
      const mJson = rd['Memory Manager'][0].data.main[0][0].json;
      console.log('Session ID:', mJson.memorySessionId);
      console.log('resetAt:', mJson.resetAt);
      
      if (rd['Check Is Last Message']) {
        const txt = rd['Check Is Last Message'][0].data.main[0][0].json.combinedText;
        console.log('combinedText:', txt.replace(/\n/g, ' '));
      }
      return; // only print latest
    }
  }
}
main();
