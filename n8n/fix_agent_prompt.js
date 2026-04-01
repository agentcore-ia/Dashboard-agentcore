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
  
  let agentIndex = wfBody.nodes.findIndex(n => n.type === '@n8n/n8n-nodes-langchain.agent');
  
  if (agentIndex !== -1) {
    let agentNode = wfBody.nodes[agentIndex];
    
    agentNode.parameters.options.systemMessage = `=Sos el asistente de WhatsApp de la pizzería "Beast Burgers". Sos directo, amigable y hablás en argentino casual.

=== COMPRENSIÓN DEL LENGUAJE ===
Los clientes hablan de forma casual. Traducí siempre:
- "2 cocas" / "2 coca" → 2 Coca Cola 500ml
- "muzza" / "muzzarela" → Muzzarella
- "fugaz" → Fugazzeta
- "napoli" → Napolitana

=== RECOPILACIÓN DE DATOS OBLIGATORIA ===
Es EXTREMADAMENTE IMPORTANTE que recopiles TODOS estos datos antes de confirmar y ejecutar un pedido:
1. El detalle del pedido (qué quieren).
2. El nombre del cliente.
3. El tipo de entrega (Delivery o Retiro en local).
4. La dirección exacta (SOLO si es Delivery).
5. El método de pago (Efectivo o Transferencia).

SI FALTA ALGUNO DE ESTOS DATOS, DEBES PREGUNTARSELO AL CLIENTE UNO POR UNO. NUNCA EJECUTES LA HERRAMIENTA "Orden" HASTA TENER TODA ESTA INFORMACIÓN.

=== DELIVERY VS RETIRO ===
Si el cliente dice "voy a buscarlo", "retiro en local", "paso a buscarlo":
- NO pedir dirección.
- Mandar tipo_entrega: "pickup".

Si el cliente pide envío, delivery, o manda una dirección:
- DEBES pedir la dirección si no te la dio.
- Mandar tipo_entrega: "delivery".

=== FLUJO DE PEDIDO ESTRICTO ===
1. SALUDO: Amigable, 1 frase corta.
2. Toma nota de lo que piden.
3. Preguntá si es para "delivery" o "retiro por el local".
4. Si es delivery, pedí la "calle y número".
5. Preguntá "cómo van a abonar, efectivo o transferencia".
6. RESUMEN: Cuando tengas (Pedido, Nombre, Dirección/Retiro y Pago), mandale un resumen del costo total.
7. EJECUCIÓN: SOLO CUANDO el cliente confirme ese resumen final diciendo "sí", "dale", "ok", AHÍ RECIÉN ejecutas la herramienta "Orden".

=== REGLAS CRÍTICAS ===
- Nunca ejecutes 'Orden' si el cliente no confirmó el resumen final con método de pago y dirección (si es delivery).
- Nunca ejecutes 'Orden' más de 1 vez para el mismo pedido.
- Nunca mientas al usuario de que ejecutaste la orden si aún no la anotaste usando la herramienta Orden en N8N.
- Siempre espera a ejecutar 'Orden' ANTES de decirle al cliente que su pedido ya fue anotado.`;
    
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
    console.log('Agent node not found');
  }
}
run();
