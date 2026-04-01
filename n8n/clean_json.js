const fs = require('fs');

const data = JSON.parse(fs.readFileSync('updated_workflow_ai.json', 'utf8'));

// n8n expects PUT to /workflows/:id to send the workflow object directly, but let's make sure it doesn't have extra root properties that cause 400
const payload = {
    name: data.name,
    nodes: data.nodes,
    connections: data.connections,
    settings: data.settings || {},
    meta: data.meta || {}
};

fs.writeFileSync('updated_workflow_ai_clean.json', JSON.stringify(payload, null, 2));
console.log('Saved to updated_workflow_ai_clean.json');
