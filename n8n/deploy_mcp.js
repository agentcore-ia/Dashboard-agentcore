const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA";
const BASE_URL = "https://agentcore-n8n.8zp1cp.easypanel.host/api/v1/workflows";

const workflowData = {
  "name": "Antigravity MCP Server API",
  "settings": {},
  "nodes": [
    {
      "parameters": {
        "options": {
          "authentication": "header",
          "headerName": "authorization"
        },
        "tools": {
          "tool": [
            { "name": "list_workflows", "description": "Lista workflows" },
            { "name": "get_workflow", "description": "Obtiene workflow (pasando id)" },
            { "name": "create_workflow", "description": "Crea workflow (pasando workflow_data)" },
            { "name": "update_workflow", "description": "Actualiza workflow (pasando id, workflow_data)" },
            { "name": "activate_workflow", "description": "Activa workflow (pasando id)" },
            { "name": "deactivate_workflow", "description": "Desactiva workflow (pasando id)" },
            { "name": "execute_workflow", "description": "Ejecutar webhook (pasando webhook_url y data extra)" }
          ]
        }
      },
      "id": "mcp-server-trigger",
      "name": "MCP Server Trigger",
      "type": "n8n-nodes-base.mcpServerTrigger",
      "typeVersion": 1,
      "position": [200, 300]
    },
    {
      "parameters": {
        "method": "={{ $json.tool_name === 'create_workflow' ? 'POST' : ($json.tool_name === 'update_workflow' || $json.tool_name === 'activate_workflow' || $json.tool_name === 'deactivate_workflow' ? 'PUT' : 'GET') }}",
        "url": "={{ $env.N8N_BASE_URL || 'https://agentcore-n8n.8zp1cp.easypanel.host' }}/api/v1/workflows{{ ($json.tool_name === 'list_workflows' || $json.tool_name === 'create_workflow') ? '' : '/' + $json.id }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "X-N8N-API-KEY",
              "value": "={{ $env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA' }}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "data",
              "value": "={{ $json.tool_name === 'activate_workflow' ? { active: true } : ($json.tool_name === 'deactivate_workflow' ? { active: false } : $json.workflow_data) }}"
            }
          ]
        },
        "options": {}
      },
      "id": "http-request-api",
      "name": "n8n API Request",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [500, 300]
    }
  ],
  "connections": {
    "MCP Server Trigger": {
      "main": [
        [
          {
            "node": "n8n API Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
};

const req = https.request(BASE_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': API_KEY,
    'Accept': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${body}`);
  });
});

req.on('error', (e) => console.error(e));
req.write(JSON.stringify(workflowData));
req.end();
