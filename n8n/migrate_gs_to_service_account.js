const https = require('https');

// SET THESE AS ENVIRONMENT VARIABLES OR IN YOUR DASHBOARD SETTINGS
const N8N_API_KEY = process.env.N8N_API_KEY; 
const N8N_URL = process.env.N8N_BASE_URL || 'https://agentcore-n8n.8zp1cp.easypanel.host/api/v1';

const SERVICE_ACCOUNT_KEY = {
  "client_email": "dashboard@agent-core-490803.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY----- ... [HIDDEN] ... -----END PRIVATE KEY-----\n",
};

async function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_URL + path);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sanitizeSettings(settings) {
    if (!settings) return {};
    const allowed = [
        'executionOrder',
        'saveExecutionProgress',
        'saveManualExecutions',
        'saveDataErrorExecution',
        'saveDataSuccessExecution',
        'errorWorkflow',
        'timezone',
        'callerPolicy'
    ];
    const sanitized = {};
    for (const key of allowed) {
        if (settings.hasOwnProperty(key)) {
            sanitized[key] = settings[key];
        }
    }
    return sanitized;
}

async function run() {
  if (!N8N_API_KEY) {
      console.error('Error: N8N_API_KEY environment variable not set.');
      process.exit(1);
  }

  console.log('--- Creando/Buscando Credencial de Service Account ---');
  const existingCreds = await apiRequest('GET', '/credentials');
  let newCredId = existingCreds.data?.find(c => c.name === 'Google Sheets Service Account (Agentcore)')?.id;

  if (!newCredId) {
    console.error('Credencial no encontrada. Créala en n8n manualmente o provee el JSON completo.');
    return;
  }
  console.log('Credencial ID:', newCredId);

  console.log('\n--- Buscando Workflows para Migrar ---');
  const wfsRes = await apiRequest('GET', '/workflows');
  if (!wfsRes.data) return console.error('Error listando workflows');

  for (const wfSummary of wfsRes.data) {
    const wfRes = await apiRequest('GET', '/workflows/' + wfSummary.id);
    const wfFull = wfRes.data || wfRes;
    let modified = false;

    if (wfFull.nodes) {
      for (let node of wfFull.nodes) {
        if (node.type.includes('googleSheets')) {
          console.log(`Migrando nodo "${node.name}" en workflow "${wfFull.name}" (${wfFull.id})`);
          if (!node.credentials) node.credentials = {};
          delete node.credentials.googleSheetsOAuth2Api;
          delete node.credentials.googleSheetsServiceAccountApi;
          node.credentials.googleApi = { id: newCredId };
          if (!node.parameters) node.parameters = {};
          node.parameters.authentication = 'serviceAccount';
          modified = true;
        }
      }
    }

    if (modified) {
      const updatePayload = {
        name: wfFull.name,
        nodes: wfFull.nodes,
        connections: wfFull.connections,
        settings: sanitizeSettings(wfFull.settings),
        staticData: wfFull.staticData
      };
      
      const result = await apiRequest('PUT', '/workflows/' + wfFull.id, updatePayload);
      if (result.id) {
          console.log(`Update ${wfFull.name}: OK`);
      } else {
          console.error(`Update ${wfFull.name}: FAIL`, JSON.stringify(result));
      }
    }
  }

  console.log('\n--- Migración Finalizada ---');
}

run();
