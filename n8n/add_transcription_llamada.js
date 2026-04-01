const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA';
const WF_ID = '02S4OKCSNTJU4w62';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'agentcore-n8n.8zp1cp.easypanel.host',
      path: '/api/v1' + path,
      method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 400)));
          return;
        }
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Parse Pedido: now also includes source='llamada' + transcription from the Transcripcion node
const NEW_PARSE_CODE = `
const output = $input.first().json.output || '';

// Get the original transcription from the earlier node
let transcription = null;
try {
  transcription = $('Transcripcion').first().json.conversacion || null;
} catch(e) {}

let parsed = {};
try {
  const codeBlockMatch = output.match(/\`\`\`json\\s*([\\s\\S]*?)\`\`\`/);
  const rawJsonMatch = output.match(/(\\{[\\s\\S]*\\})/);
  const match = codeBlockMatch || rawJsonMatch;
  if (match) parsed = JSON.parse(match[1]);
} catch(e) {
  parsed = { notes: output };
}

const total = parseFloat(String(parsed.total || '0').replace(/[^0-9.]/g, '')) || 0;
const hasAddress = parsed.address && String(parsed.address).trim().length > 3;

const pmRaw = String(parsed.payment_method || '').toLowerCase();
let paymentMethod = 'cash';
if (pmRaw.includes('tarjeta') || pmRaw.includes('card') || pmRaw.includes('credito') || pmRaw.includes('debito')) {
  paymentMethod = 'card';
} else if (pmRaw.includes('transfer')) {
  paymentMethod = 'transfer';
} else if (pmRaw.includes('pix')) {
  paymentMethod = 'pix';
}

return [{
  json: {
    customer_name: parsed.customer_name || 'Cliente llamada',
    customer_phone: 'llamada',
    notes: parsed.notes || '',
    total: total,
    subtotal: total,
    delivery_fee: 0,
    address: parsed.address || null,
    payment_method: paymentMethod,
    delivery_type: hasAddress ? 'delivery' : 'retiro',
    status: 'new',
    source: 'llamada',
    transcription: transcription,
    restaurant_id: '00000000-0000-0000-0000-000000000001'
  }
}];
`.trim();

// Guardar en Supabase: include transcription and source in the body
const NEW_SUPABASE_BODY = `={{ JSON.stringify({
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
  source: $json.source,
  transcription: $json.transcription,
  restaurant_id: $json.restaurant_id
}) }}`;

async function main() {
  console.log('Fetching workflow...');
  const wf = await api('GET', '/workflows/' + WF_ID);
  console.log('Nodes:', wf.nodes.map(n => n.name).join(', '));

  // Update Parse Pedido
  const parseNode = wf.nodes.find(n => n.name === 'Parse Pedido');
  if (!parseNode) { console.error('❌ Parse Pedido not found'); return; }
  parseNode.parameters.jsCode = NEW_PARSE_CODE;
  console.log('✓ Updated Parse Pedido (source=llamada, transcription captured)');

  // Update Guardar en Supabase
  const supabaseNode = wf.nodes.find(n => n.name === 'Guardar en Supabase');
  if (!supabaseNode) { console.error('❌ Guardar en Supabase not found'); return; }
  supabaseNode.parameters.jsonBody = NEW_SUPABASE_BODY;
  console.log('✓ Updated Guardar en Supabase (source + transcription included)');

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: (wf.settings && wf.settings.executionOrder) || 'v1' },
    staticData: wf.staticData || null
  };

  console.log('Saving...');
  const updated = await api('PUT', '/workflows/' + WF_ID, payload);
  console.log('✅ Workflow saved! Nodes:', updated.nodes && updated.nodes.length);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
