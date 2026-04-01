const https = require('https');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";

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
  console.log('1. Fetching workflows...');
  const wfs = await apiCall('GET', '/workflows');
  const activeWfMeta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  
  if(!activeWfMeta) throw new Error("Workflow not found");
  
  const wf = await apiCall('GET', `/workflows/${activeWfMeta.id}`);

  // FIX: Update 'Orden' tool description
  const ordenNode = wf.nodes.find(n => n.name === 'Orden');
  if (ordenNode) {
    console.log('2. Updating Orden Tool description...');
    ordenNode.parameters.description = "EJECUTA ESTA HERRAMIENTA UNA SOLA Y ÚNICA VEZ CUANDO EL CLIENTE HAYA CONFIRMADO EL RESUMEN FINAL. Llamá a esta herramienta para guardar el pedido definitivamente en la Base de Datos. NUNCA la vuelvas a ejecutar para el mismo cliente si solo te está haciendo preguntas como 'cuál es el total'. El parámetro 'total' debe ser un string con el precio exacto matemáticamente calculado mirando los valores obtenidos previamente con la herramienta Menu. Ejemplo de total: '$14000'. Siempre incluye todo el texto validado del formato.";
  }

  // FIX: Update AI Agent prompt
  const agentNode = wf.nodes.find(n => n.name === 'AI Agent');
  if (agentNode && agentNode.parameters && agentNode.parameters.options) {
    console.log('3. Updating AI Agent system message...');
    let sysMsg = agentNode.parameters.options.systemMessage || '';
    
    // Check if the fix is already there, if not, append or replace
    const overrideRules = `
=== REGLAS CRÍTICAS Y ESTRICTAS DE CÁLCULO DE PRECIOS ===
1. NUNCA INVENTES PRECIOS.
2. Si un cliente pide X cantidad de un producto, DEBES SIEMPRE revisar la herramienta 'Menu' para saber el precio base.
3. Multiplica (Cantidad * Precio Base) para cada producto de forma precisa. 
4. El envío siempre cuesta $2000 (Solo sumar si 'tipo_entrega' es 'delivery').
5. EJECUCIÓN ÚNICA: La herramienta 'Orden' SE EJECUTA SÓLO UNA VEZ en toda la conversación, JUSTO DESPUÉS de que el cliente diga "SÍ" al resumen. NUNCA la ejecutes más de una vez, incluso si el cliente luego te hace una pregunta como "¿cuánto es el total?". Ya lo anotaste, NO lo anotes dos veces. Usa tu memoria.`;

    if (!sysMsg.includes('NUNCA INVENTES PRECIOS')) {
        agentNode.parameters.options.systemMessage = sysMsg + "\n" + overrideRules;
    }
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('4. Updating workflow...');
  const result = await apiCall('PUT', `/workflows/${activeWfMeta.id}`, payload);

  if (result.id) {
    console.log(`✅ AI Agent & Orden tool instructions updated successfully!`);
  } else {
    console.error('❌ Error updating workflow:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
