// Script to FIX item pairing by replacing .item with .first() globally
// and fixing the Code node too.

const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const WORKFLOW_ID = "Sbf4ewHwOCdsruMv";

function apiCall(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://agentcore-n8n.8zp1cp.easypanel.host/api/v1${path}`);
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(body)); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('1. Fetching workflow...');
  const wf = await apiCall('GET', `/workflows/${WORKFLOW_ID}`);
  console.log(`   Got: "${wf.name}"`);

  let wfString = JSON.stringify(wf);

  // Replace .item. with .first().
  // Regex to find $('Node Name').item and replace with $('Node Name').first()
  // We look for $('...') then .item
  console.log('2. Replacing .item with .first() in expressions...');
  wfString = wfString.replace(/\$\(['"]([^'"]+)['"]\)\.item/g, "$('$1').first()");

  // Special case for Code node: $input.item -> $input.first()
  console.log('3. Fixing Code node input access...');
  wfString = wfString.replace(/\$input\.item/g, "$input.first()");

  const updatedWf = JSON.parse(wfString);

  const payload = {
    name: updatedWf.name,
    nodes: updatedWf.nodes,
    connections: updatedWf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('4. Updating workflow...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log(`   ✅ Workflow updated and paired fixed!`);
    await apiCall('POST', `/workflows/${WORKFLOW_ID}/activate`, {});
    console.log('   ✅ Workflow activated!');
  } else {
    console.log('   ❌ Error:', JSON.stringify(result).substring(0, 600));
  }
}

main().catch(console.error);
