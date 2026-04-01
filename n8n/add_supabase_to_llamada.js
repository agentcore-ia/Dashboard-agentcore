const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const WORKFLOW_ID = '02S4OKCSNTJU4w62';
const BASE_URL = 'agentcore-n8n.8zp1cp.easypanel.host';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE';
const SUPABASE_URL = 'https://eqnjyygokjinmsfvogxi.supabase.co/rest/v1/pedidos';

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('Fetching workflow "Llamada"...');
  const wf = await apiRequest('GET', `/workflows/${WORKFLOW_ID}`);
  console.log(`Got workflow: ${wf.name} (${wf.nodes.length} nodes)`);

  // 1. Update AI Agent prompt to output JSON at the end
  const agentNode = wf.nodes.find(n => n.name === 'AI Agent');
  if (!agentNode) throw new Error('AI Agent node not found!');
  
  agentNode.parameters.text = `=A partir de la siguiente transcripción de un pedido por voz realizado por un agente de toma de pedidos, extrae la siguiente información y guardala en una hoja de calculo:

- Fecha y hora en formato YYYY-MM-DD HH-MM
- Nombre del cliente
- Lista de productos
- Precio final
- Dirección de envio
- Método de pago 

Importante:
Si no es posible obtener información suficiente o confiable para alguno de los campos, no lo registres (déjalo en blanco).

Después de guardar en la hoja de cálculo, responde ÚNICAMENTE con un bloque JSON con este formato exacto (sin texto adicional antes ni después):
\`\`\`json
{
  "customer_name": "nombre del cliente o vacío",
  "notes": "lista completa de productos pedidos",
  "total": 0,
  "address": "dirección de envío, o vacío si es retiro en local",
  "payment_method": "efectivo, tarjeta o transferencia",
  "delivery_type": "delivery o retiro"
}
\`\`\`

La fecha y hora actual es: {{ $now }}

Transcripción:
{{ JSON.stringify($json.conversacion) }}`;

  console.log('✓ Updated AI Agent prompt');

  // 2. Add "Parse Pedido" Code node
  const parseNode = {
    id: 'parse-pedido-001',
    name: 'Parse Pedido',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [560, 304],
    parameters: {
      jsCode: `const output = $input.first().json.output || '';

// Extract JSON from markdown code block or raw JSON
let parsed = {};
try {
  const codeBlockMatch = output.match(/\`\`\`json\\s*([\\s\\S]*?)\`\`\`/);
  const rawJsonMatch = output.match(/(\\{[\\s\\S]*\\})/);
  const match = codeBlockMatch || rawJsonMatch;
  if (match) {
    parsed = JSON.parse(match[1]);
  }
} catch(e) {
  parsed = { notes: output };
}

const total = parseFloat(String(parsed.total || '0').replace(/[^0-9.]/g, '')) || 0;
const hasAddress = parsed.address && parsed.address.trim().length > 3;

return [{
  json: {
    customer_name: parsed.customer_name || 'Cliente llamada',
    customer_phone: 'llamada',
    notes: parsed.notes || '',
    total: total,
    subtotal: total,
    delivery_fee: 0,
    address: parsed.address || null,
    payment_method: parsed.payment_method || 'efectivo',
    delivery_type: hasAddress ? 'delivery' : 'retiro',
    status: 'nuevo',
    restaurant_id: '00000000-0000-0000-0000-000000000001'
  }
}];`
    }
  };

  // 3. Add "Guardar en Supabase" HTTP Request node
  const supabaseNode = {
    id: 'supabase-insert-001',
    name: 'Guardar en Supabase',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [760, 304],
    parameters: {
      method: 'POST',
      url: SUPABASE_URL,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: SUPABASE_KEY },
          { name: 'Authorization', value: `Bearer ${SUPABASE_KEY}` },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({
  customer_name: $json.customer_name,
  customer_phone: $json.customer_phone,
  notes: $json.notes,
  total: $json.total,
  subtotal: $json.subtotal,
  delivery_fee: $json.delivery_fee,
  address: $json.address,
  payment_method: $json.payment_method,
  delivery_type: $json.delivery_type,
  status: $json.status,
  restaurant_id: $json.restaurant_id
}) }}`,
      options: {}
    }
  };

  // Check if nodes already exist (avoid duplicates)
  if (!wf.nodes.find(n => n.name === 'Parse Pedido')) {
    wf.nodes.push(parseNode);
    console.log('✓ Added Parse Pedido node');
  } else {
    console.log('⚠ Parse Pedido already exists, skipping');
  }

  if (!wf.nodes.find(n => n.name === 'Guardar en Supabase')) {
    wf.nodes.push(supabaseNode);
    console.log('✓ Added Guardar en Supabase node');
  } else {
    console.log('⚠ Guardar en Supabase already exists, skipping');
  }

  // 4. Add connections: AI Agent → Parse Pedido → Guardar en Supabase
  if (!wf.connections['AI Agent']) {
    wf.connections['AI Agent'] = { main: [[]] };
  }
  // Make sure the main output exists
  if (!wf.connections['AI Agent'].main) {
    wf.connections['AI Agent'].main = [[]];
  }
  if (!wf.connections['AI Agent'].main[0]) {
    wf.connections['AI Agent'].main[0] = [];
  }
  
  // Add AI Agent → Parse Pedido connection (if not already there)
  const alreadyConnected = wf.connections['AI Agent'].main[0].find(c => c.node === 'Parse Pedido');
  if (!alreadyConnected) {
    wf.connections['AI Agent'].main[0].push({ node: 'Parse Pedido', type: 'main', index: 0 });
    console.log('✓ Connected AI Agent → Parse Pedido');
  }

  // Parse Pedido → Guardar en Supabase
  if (!wf.connections['Parse Pedido']) {
    wf.connections['Parse Pedido'] = { main: [[{ node: 'Guardar en Supabase', type: 'main', index: 0 }]] };
    console.log('✓ Connected Parse Pedido → Guardar en Supabase');
  }

  // 5. PUT the updated workflow (only send allowed fields)
  console.log('Saving workflow...');
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: {
      executionOrder: wf.settings && wf.settings.executionOrder ? wf.settings.executionOrder : 'v1'
    },
    staticData: wf.staticData || null
  };
  const updated = await apiRequest('PUT', `/workflows/${WORKFLOW_ID}`, payload);
  console.log('✅ Workflow updated successfully!');
  console.log(`Nodes: ${updated.nodes.length}`);
  console.log('Done! Phone orders will now appear in the dashboard.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
