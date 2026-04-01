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

// Note: the actual upstream node name is "AI Correctotr" (that's the typo in n8n itself)
const newCode = `
const texto = $('AI Correctotr').first().json.output || "";

// Normalizar saltos de línea dobles -> separador de frase
const limpio = texto.replace(/\\n{2,}/g, '. ').trim();

// Dividir por punto/pregunta/exclamación seguido de espacios y mayúscula (incluyendo ¿ y ¡)
const oraciones = limpio
  .split(/(?<=[.?!])\\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

// Agrupar en hasta 4 partes
const partes = ["", "", "", ""];
for (let i = 0; i < Math.min(4, oraciones.length); i++) {
  partes[i] = oraciones[i];
}

return [{ json: { output: { response: {
  part_1: partes[0],
  part_2: partes[1],
  part_3: partes[2],
  part_4: partes[3]
} } } }];
`;

async function main() {
  const wfs = await apiCall('GET', '/workflows');
  const meta = wfs.data.find(w => w.name === 'Agente IA Restaurante - Evolution API');
  if (!meta) throw new Error("Workflow not found");

  const wf = await apiCall('GET', `/workflows/${meta.id}`);

  const node = wf.nodes.find(n => n.name === 'Dividir mensaje');
  if (!node) throw new Error("Nodo 'Dividir mensaje' no encontrado");
  
  node.parameters.jsCode = newCode;

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" }
  };

  const result = await apiCall('PUT', `/workflows/${meta.id}`, payload);
  if (result.id) {
    console.log('✅ Fixed: referencia correcta a "AI Correctotr", hasta 4 partes.');
  } else {
    console.error('❌ Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(console.error);
