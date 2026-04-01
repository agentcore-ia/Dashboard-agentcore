const fs = require('fs');

const data = JSON.parse(fs.readFileSync('updated_workflow_ai.json', 'utf8'));

// n8n API complains about extra properties. It usually only wants 'nodes', 'connections', 'settings' maybe 'name'.
// Wait, looking at the node module update function: it PUTs to /workflows/:id
// Usually we can just strip createdAt, updatedAt, and id from the root to be safe.
const payload = {
    name: data.name,
    nodes: data.nodes,
    connections: data.connections,
    settings: data.settings || {},
    staticData: data.staticData || null,
    pinData: data.pinData || {},
    versionId: data.versionId || null,
    triggerCount: data.triggerCount || 0,
    tags: data.tags || []
};

// Even safer, just send nodes and connections and name
const safePayload = {
    name: data.name,
    nodes: data.nodes,
    connections: data.connections,
    settings: data.settings || {}
};

fs.writeFileSync('updated_workflow_ai_clean.json', JSON.stringify(safePayload, null, 2));
console.log('Saved to updated_workflow_ai_clean.json');
