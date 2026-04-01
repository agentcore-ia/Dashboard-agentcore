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
  const ex = await apiCall(249);
  const rd = ex.data?.resultData?.runData;
  if (!rd) return console.log('No runData for 249');
  
  if (rd['Get Latest Message']) {
    console.log("== Get Latest Message output ==");
    console.log(JSON.stringify(rd['Get Latest Message'][0].data.main[0], null, 2));
  }
  
  if (rd['Check Is Last Message']) {
    console.log("== Check Is Last Message output ==");
    console.log(JSON.stringify(rd['Check Is Last Message'][0].data.main[0][0].json, null, 2));
  }
}
main();
