const https = require('https');
const fs = require('fs');
const path = require('path');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const N8N_URL = 'https://agentcore-n8n.8zp1cp.easypanel.host/api/v1';
const OUTPUT_DIR = 'c:/Users/matii/Documents/Agentcore/dashboard/n8n';

async function apiRequest(method, endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_URL + endpoint);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const workflows = [
    { id: 'Sbf4ewHwOCdsruMv', filename: 'main-agent-ia.json' },
    { id: 'QCVo6a4w9fCAvxRp', filename: 'sync-order-webhook.json' },
    { id: '7kr1KF5RFLcZIuCr', filename: 'sync-order-tool.json' }
  ];

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const wfInfo of workflows) {
    console.log(`Exportando ${wfInfo.id}...`);
    const wf = await apiRequest('GET', `/workflows/${wfInfo.id}`);
    
    // Clean unnecessary metadata for the repo
    delete wf.id;
    delete wf.createdAt;
    delete wf.updatedAt;
    delete wf.active;
    
    fs.writeFileSync(path.join(OUTPUT_DIR, wfInfo.filename), JSON.stringify(wf, null, 2));
    console.log(`Guardado ${wfInfo.filename}`);
  }
}

run();
