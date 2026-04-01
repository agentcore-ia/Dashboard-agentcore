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
          reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 300)));
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

// Fixed Parse Pedido code - status='new' (English) + normalized payment_method
const FIXED_CODE = `
const output = $input.first().json.output || '';

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

// Normalize payment method to English keys used by the dashboard
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
    restaurant_id: '00000000-0000-0000-0000-000000000001'
  }
}];
`.trim();

async function main() {
  console.log('Fetching workflow...');
  const wf = await api('GET', '/workflows/' + WF_ID);
  console.log('Nodes:', wf.nodes.map(n => n.name).join(', '));

  const parseNode = wf.nodes.find(n => n.name === 'Parse Pedido');
  if (!parseNode) {
    console.error('❌ Parse Pedido node not found!');
    return;
  }

  // Apply the fix
  parseNode.parameters.jsCode = FIXED_CODE;
  console.log('✓ Updated Parse Pedido code (status: new, payment_method normalized)');

  // Save
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: (wf.settings && wf.settings.executionOrder) || 'v1' },
    staticData: wf.staticData || null
  };

  console.log('Saving...');
  const updated = await api('PUT', '/workflows/' + WF_ID, payload);
  console.log('✅ Done! Nodes:', updated.nodes && updated.nodes.length);
  console.log('');
  console.log('Now also fixing existing pedidos with status=nuevo in Supabase...');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
