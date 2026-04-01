const fs = require('fs');
const jsonStr = fs.readFileSync('C:/Users/matii/.gemini/antigravity/brain/8ca674b5-8db5-4fc3-a7df-76392831bdfb/.system_generated/steps/1654/output.txt', 'utf8');
const workflow = JSON.parse(jsonStr);

// Find supabase-incoming-http node
const supabaseNode = workflow.nodes.find(n => n.id === 'supabase-incoming-http');
if (supabaseNode) {
    const jsonBody = supabaseNode.parameters.jsonBody;
    if (jsonBody.includes('wa_message_id')) {
        console.log('supabase-incoming-http already has wa_message_id');
    } else {
        supabaseNode.parameters.jsonBody = jsonBody.replace(/sender: 'customer'/g, "sender: 'customer',\n  wa_message_id: $('WhatsApp Trigger').first().json.body.data.key.id");
        console.log('Updated supabase-incoming-http');
    }
}

// Find supabase-outgoing-http node
const supabaseAI = workflow.nodes.find(n => n.id === 'supabase-outgoing-http');
if (supabaseAI) {
    const jsonBody = supabaseAI.parameters.jsonBody;
    if (jsonBody.includes('wa_message_id')) {
        console.log('supabase-outgoing-http already has wa_message_id');
    } else {
        supabaseAI.parameters.jsonBody = jsonBody.replace(/sender: 'ai'/g, "sender: 'ai',\n  wa_message_id: 'ai_' + $('WhatsApp Trigger').first().json.body.data.key.id");
        console.log('Updated supabase-outgoing-http');
    }
}

// Find Fields node to ensure wa_message_id is NOT needed there yet but if we want to be safe we can
// Actually the AI Agent is fine.

fs.writeFileSync('C:/Users/matii/Documents/Agentcore/n8n/workflow_deduplicated.json', JSON.stringify(workflow, null, 2));
