const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

function apiCall(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const res = await apiCall('GET', `/executions?limit=3`);
  for (const info of res.data) {
    const details = await apiCall('GET', `/executions/${info.id}`);
    const runData = details.data?.resultData?.runData;
    if (!runData) continue;
    
    console.log(`\n=== EXECUTION ${info.id} ===`);
    
    if (runData['Check Is Last Message']) {
      try {
        const out = runData['Check Is Last Message'][0].data.main[0][0].json;
        console.log('[Check Is Last Message] JSON Output:');
        console.log(JSON.stringify(out, null, 2));
      } catch(e) { console.log('Error parsing Code node output', e.message); }
    } else {
      console.log('Node [Check Is Last Message] did not run.');
    }
  }
}
main().catch(console.error);
