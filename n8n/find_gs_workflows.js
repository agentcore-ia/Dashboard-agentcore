const https = require('https');
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const N8N_URL = 'https://agentcore-n8n.8zp1cp.easypanel.host/api/v1';

async function apiRequest(method, path) {
    return new Promise((resolve, reject) => {
        const url = new URL(N8N_URL + path);
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
    const wfsRes = await apiRequest('GET', '/workflows');
    if (!wfsRes.data) return console.error('Error listando workflows');

    for (const wfSummary of wfsRes.data) {
        const wf = await apiRequest('GET', '/workflows/' + wfSummary.id);
        const gsNodes = wf.nodes.filter(n => n.type.includes('googleSheets'));
        if (gsNodes.length > 0) {
            console.log(`Workflow: ${wf.name} (${wf.id})`);
            gsNodes.forEach(n => {
                console.log(`  - Node: ${n.name}, Creds: ${JSON.stringify(n.credentials)}`);
            });
        }
    }
}

run();
