const https = require('https');
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';

async function fetchN8n(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://agentcore-n8n.8zp1cp.easypanel.host/api/v1' + path);
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const { data: wfs } = await fetchN8n('GET', '/workflows');
  let webhookWf = wfs.data.find(w => w.name === 'Sync Order SubWorkflow (Webhook)');
  
  if (!webhookWf) return console.log('Wf not found');
  
  const { data: wfBody } = await fetchN8n('GET', '/workflows/' + webhookWf.id);
  
  let sheetIndex = wfBody.nodes.findIndex(n => n.type.includes('googleSheets'));
  
  if (sheetIndex !== -1) {
    let sheetNode = wfBody.nodes[sheetIndex];
    let newMapping = {
      'ID Pedido': "={{ $('Post Pedido Supabase').first().json.id || $('Post Pedido Supabase').first().json[0]?.id || '' }}",
      'Nombre del Cliente': "={{ $('Webhook').first().json.body.nombre || '' }}",
      'Pedido': "={{ $('Webhook').first().json.body.pedido || '' }}",
      'Precio': "={{ $('Webhook').first().json.body.total || '0' }}",
      'Dirección': "={{ $('Webhook').first().json.body.tipo_entrega === 'pickup' ? 'Retiro en local' : ($('Webhook').first().json.body.direccion || '') }}",
      'Fecha': "={{ new Date().toLocaleDateString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires'}) }}",
      'Hora': "={{ new Date().toLocaleTimeString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }) }}",
      'Estado': "nuevo",
      'Notas': "={{ $('Webhook').first().json.body.metodo_pago || '' }}"
    };
    
    sheetNode.parameters.columns.value = newMapping;
    
    // Clean up settings to avoid 400 bad request
    delete wfBody.settings.callerPolicy;
    delete wfBody.settings.errorWorkflow;
    let safeSettings = {}; 
    if (wfBody.settings.executionOrder) safeSettings.executionOrder = wfBody.settings.executionOrder;
    
    const result = await fetchN8n('PUT', '/workflows/' + webhookWf.id, {
        name: wfBody.name,
        nodes: wfBody.nodes,
        connections: wfBody.connections,
        settings: safeSettings
    });
    console.log('Update Status:', result.status);
    if (result.status !== 200) console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log('Google Sheets node not found');
  }
}
run();
