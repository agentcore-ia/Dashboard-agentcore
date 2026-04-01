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
  let activeWfMeta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  
  const { data: wfBody } = await fetchN8n('GET', '/workflows/' + activeWfMeta.id);
  
  let menuIndex = wfBody.nodes.findIndex(n => n.name === 'Menu');
  
  if (menuIndex !== -1) {
    let menuNode = wfBody.nodes[menuIndex];
    
    // Change tool type to http request tool
    menuNode.type = '@n8n/n8n-nodes-langchain.toolHttpRequest';
    menuNode.typeVersion = 1.1; // Commonly 1 or 1.1
    delete menuNode.credentials; // Remove oauth
    
    menuNode.parameters = {
      "method": "GET",
      "url": "https://docs.google.com/spreadsheets/d/1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4/export?format=csv&gid=2042150241",
      "sendHeaders": true,
      "headerParameters": { "parameters": [{ "name": "Accept", "value": "text/csv" }] },
      "sendBody": false,
      "name": "Menu",
      "description": "Usá obligatoriamente esta herramienta cuando el cliente pregunte qué hay para pedir, cuáles son las variedades o el menú. Responde leyendo el archivo CSV que la herramienta te devuelve (campos: Producto,Tipo,Disponible,Precio,Ingredientes). Solo sugerí artículos bajo la columna Disponible=Sí."
    };
    
    // Clean up settings to avoid 400 bad request
    delete wfBody.settings.callerPolicy;
    delete wfBody.settings.errorWorkflow;
    let safeSettings = {}; 
    if (wfBody.settings.executionOrder) safeSettings.executionOrder = wfBody.settings.executionOrder;
    
    const result = await fetchN8n('PUT', '/workflows/' + activeWfMeta.id, {
        name: wfBody.name,
        nodes: wfBody.nodes,
        connections: wfBody.connections,
        settings: safeSettings
    });
    console.log('Update Status:', result.status);
    if (result.status !== 200) console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log('Menu node not found');
  }
}
run();
