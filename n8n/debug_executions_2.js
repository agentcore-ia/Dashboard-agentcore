const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";

function apiCall(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname,
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
  console.log('Fetching recent executions...');
  const res = await apiCall('GET', `/executions?limit=3`);
  
  if (!res.data || res.data.length === 0) {
    console.log('No recent executions found.');
    return;
  }
  
  // Just check the top 3
  const top = res.data.slice(0, 3);
  
  for (const exec of top) {
    if (exec.workflowId !== WORKFLOW_ID) continue;
    
    console.log(`\nExecution ID: ${exec.id} (Status: ${exec.status})`);
    
    // Fetch full execution data
    const details = await apiCall('GET', `/executions/${exec.id}`);
    if (!details.data || !details.data.resultData || !details.data.resultData.runData) continue;
    
    const runData = details.data.resultData.runData;
    
    if (runData['Check Is Last Message']) {
      const msgs = runData['Check Is Last Message'][0].data.main[0];
      if (msgs && msgs.length > 0 && msgs[0].json) {
        console.log('  [Check Is Last Message] Output:', JSON.stringify(msgs[0].json, null, 2));
      } else {
         console.log('  [Check Is Last Message] Output: ', msgs);
      }
    } else {
      console.log('  [Check Is Last Message] Did not run.');
    }
  }
}

main().catch(console.error);
