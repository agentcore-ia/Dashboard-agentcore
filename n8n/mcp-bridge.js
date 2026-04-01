const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const https = require("https");

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const BASE_URL = "https://agentcore-n8n.8zp1cp.easypanel.host/api/v1";

const server = new Server({ name: "n8n-bridge", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { 
      name: "list_workflows", 
      description: "Lista todos los workflows de n8n" 
    },
    { 
      name: "get_workflow", 
      description: "Obtiene el JSON de un workflow específico", 
      inputSchema: { 
        type: "object", 
        properties: { id: { type: "string", description: "El ID del workflow" } }, 
        required: ["id"] 
      } 
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const path = name === "list_workflows" ? "/workflows" : `/workflows/${args.id}`;
  
  return new Promise((resolve) => {
    https.get(`${BASE_URL}${path}`, { headers: { "X-N8N-API-KEY": API_KEY } }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          // Si es list_workflows, devolvemos un resumen legible
          const parsed = JSON.parse(data);
          resolve({ content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }] });
        } catch (e) {
          resolve({ content: [{ type: "text", text: data }], isError: true });
        }
      });
    }).on("error", (e) => {
      resolve({ content: [{ type: "text", text: e.message }], isError: true });
    });
  });
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
