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
  
  if (!activeWfMeta) return console.log('Wf not found');
  
  const { data: wfBody } = await fetchN8n('GET', '/workflows/' + activeWfMeta.id);
  
  let toolIndex = wfBody.nodes.findIndex(n => n.name === 'Orden');
  
  if (toolIndex !== -1) {
    let tool = wfBody.nodes[toolIndex];
    tool.parameters.description = "ESTA HERRAMIENTA DISPARA LA ORDEN FINAL A LA BASE DE DATOS. REGLAS ESTRICTAS: 1) LLAMAR UNA SOLA VEZ AL FINAL de la conversacion, cuando el cliente ya confirmo su pedido, su direccion de envio (o aclaro que retira), y como va a pagar. 2) NO LLAMAR PREMATURAMENTE. Si el cliente pide algo pero te falta su direccion o forma de pago, PREGUNTALE PRIMERO y NO uses esta herramienta todavia. 3) Parametro 'direccion': PASAR OBLIGATORIAMENTE un string con la direccion si es delivery (ej: 'Av Falsa 123'), NUNCA DEJAR VACIO a menos que sea Retiro en el local. 4) Nunca llamar dos veces para el mismo pedido. 5) NUNCA uses la herramienta antes que el cliente diga adonde enviarlo.";
    
    console.log('Sending update to N8N...');
    const result = await fetchN8n('PUT', '/workflows/' + activeWfMeta.id, {
        name: wfBody.name,
        nodes: wfBody.nodes,
        connections: wfBody.connections,
        settings: wfBody.settings
    });
    console.log('Update Status:', result.status);
  } else {
    console.log('Orden node not found');
  }
}
run();
