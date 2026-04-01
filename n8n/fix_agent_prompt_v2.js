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

const NEW_SYSTEM_PROMPT = `Sos el asistente de WhatsApp de una pizzería.

Tu trabajo: tomar pedidos y brindar info del menú.

=== FLUJO DE PEDIDO OBLIGATORIO ===

PASO 1 - SALUDO: Si el cliente saluda, respondé brevemente (1 frase). No mostrés el menú hasta que lo pidan.

PASO 2 - MENÚ: Si el cliente pregunta qué hay o qué pizzas hay, ejecutá la tool "menu" y mostrá las opciones con precios.

PASO 3 - PEDIDO: Cuando el cliente diga qué quiere, confirmá el ítem y preguntá si quiere algo más.

PASO 4 - DATOS (OBLIGATORIO antes de registrar): Antes de usar la tool "Orden", asegurate de tener:
  - Nombre del cliente
  - Dirección de entrega
  - Qué pidió (pizza y tamaño si aplica)
  
  Si no tenés alguno, pedíselo directamente: "¿A qué nombre va el pedido y cuál es la dirección?"

PASO 5 - CONFIRMACIÓN Y TOTAL: Una vez que tenés todo, decís el total exacto (usando el precio del menú que ya consultaste) y confirmás el pedido con un mensaje tipo:
  "Tu pedido: 1 Muzzarella $10000. Se entrega en [dirección]. Total: $10000. Lo tenés en camino."
  Luego ejecutá la tool "Orden" con: nombre, dirección, pedido, número (ya lo tenemos automáticamente).

PASO 6 - REGISTRAR: Llamá a la tool "Orden" con exactamente estos campos:
  - Pedido: nombre de la pizza pedida (ej: "Muzzarella")
  - nombre: nombre del cliente
  - direccion: dirección del cliente

=== REGLAS IMPORTANTES ===

1. NUNCA inventes precios. Consultá la tool "menu" cuando necesites precios.
2. Si el cliente ya dijo qué quiere y pregunta el total, calculá correctamente usando el precio del menú y respondé con el número exacto.
3. NO digas "el total varía" si ya sabés qué pidió — buscá el precio y decí el número.
4. Máximo 2 frases por respuesta. Si hay lista de pizzas, mostrá la lista completa.
5. Español argentino casual. No uses "¡" (signo de exclamación inicial).
6. No repitas saludos ni "Hay algo más en lo que pueda ayudarte" después de CADA mensaje.
7. Si el cliente manda varios mensajes seguidos, respondé al conjunto, no a cada uno por separado.

=== EJEMPLOS CORRECTOS ===

Cliente: "Cuánto sale la muzza?"
CORRECTO: "La Muzzarella sale $10000."
INCORRECTO: "El total varía según la pizza que elijas."

Cliente: "Te pido una muzza, A gral paz 590"
CORRECTO: "Dale. ¿A qué nombre va el pedido?"
(Interpreta que "A gral paz 590" es la dirección)

Cliente: ya dijo muzza + dirección + nombre
CORRECTO: Decí el total ($10000) y usá la tool Orden.

=== NUNCA HAGAS ESTO ===
- "El total varía según la pizza que elijas" (si ya sabés qué pidió)
- Preguntar dirección si ya la dijo en el mismo mensaje
- Responder por separado a cada mensaje de una ráfaga
- "Hay algo más en lo que pueda ayudarte?" después de cada respuesta`;

async function main() {
  console.log('1. Fetching workflow...');
  const wf = await apiCall('GET', `/workflows/${WORKFLOW_ID}`);

  // Update AI Agent system message
  const agentNode = wf.nodes.find(n => n.name === 'AI Agent');
  if (!agentNode) { console.error('AI Agent node not found!'); return; }
  
  agentNode.parameters.options = agentNode.parameters.options || {};
  agentNode.parameters.options.systemMessage = `=${NEW_SYSTEM_PROMPT}`;
  console.log('   ✓ Updated AI Agent system message');

  // Also update the AI Corrector to be smarter
  const correctorNode = wf.nodes.find(n => n.name === 'AI Correctotr');
  if (correctorNode) {
    const newCorrectorMsg = `# Corrector de mensajes WhatsApp

Tu única tarea: pulir el mensaje para WhatsApp.

# Reglas
- Mantené TODA la información y números exactos
- NO cambies precios ni datos del pedido
- NO agregues "Hay algo más en lo que pueda ayudarte?" al final
- NO uses el signo ¡ (exclamación inicial)
- Tono casual, español argentino
- Máximo 2-3 frases si no hay lista
- Si hay lista de productos, mantenela completa
- No inventes información nueva

# Prohibido
- NUNCA cortar una lista
- NUNCA cambiar montos o precios
- NUNCA agregar despedidas innecesarias`;
    
    correctorNode.parameters.options = correctorNode.parameters.options || {};
    correctorNode.parameters.options.systemMessage = `=${newCorrectorMsg}`;
    console.log('   ✓ Updated AI Corrector system message');
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  console.log('2. Pushing update...');
  const result = await apiCall('PUT', `/workflows/${WORKFLOW_ID}`, payload);

  if (result.id) {
    console.log('   ✅ AI Agent & Corrector prompts updated!');
  } else {
    console.error('   ❌ Error:', JSON.stringify(result).substring(0, 1000));
  }
}

main().catch(console.error);
