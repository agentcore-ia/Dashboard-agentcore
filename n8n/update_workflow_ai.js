const fs = require('fs');

const jsonStr = fs.readFileSync('C:/Users/matii/.gemini/antigravity/brain/8ca674b5-8db5-4fc3-a7df-76392831bdfb/.system_generated/steps/1834/output.txt', 'utf8');
const workflow = JSON.parse(jsonStr);

// 1. Get the Edge Function nodes for Incoming and Outgoing messages
const incomingNode = workflow.nodes.find(n => n.name === 'Log Incoming to Supabase');
const outgoingNode = workflow.nodes.find(n => n.name === 'Log AI Response to Supabase');

if (incomingNode) {
    let body = incomingNode.parameters.jsonBody;
    if (!body.includes('wa_message_id')) {
        body = body.replace(/sender:\s*'customer'/g, "sender: 'customer',\n  wa_message_id: $('WhatsApp Trigger').first().json.body.data.key.id");
        incomingNode.parameters.jsonBody = body;
        console.log("Updated incomingNode with wa_message_id");
    }
} else {
    console.log("Warning: Log Incoming to Supabase node not found!");
}

if (outgoingNode) {
    let body = outgoingNode.parameters.jsonBody;
    if (!body.includes('wa_message_id')) {
        body = body.replace(/sender:\s*'ai'/g, "sender: 'ai',\n  wa_message_id: 'ai_' + $('WhatsApp Trigger').first().json.body.data.key.id");
        outgoingNode.parameters.jsonBody = body;
        console.log("Updated outgoingNode with wa_message_id");
    }
} else {
    console.log("Warning: Log AI Response to Supabase node not found!");
}

// 2. Add an IF node to check `ai_active` after `Log Incoming to Supabase` and before `AI Agent`
const aiAgentNode = workflow.nodes.find(n => n.name === 'AI Agent');

// Ensure we don't duplicate the if node
const existingAiIf = workflow.nodes.find(n => n.name === 'Check AI Active');

if (!existingAiIf && aiAgentNode && incomingNode) {
    console.log("Injecting Check AI Active IF Node...");
    
    // Create new IF Node
    const checkAiNode = {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "check-ai-cond",
              "leftValue": "={{ $('Log Incoming to Supabase').first().json.ai_active }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true",
                "singleValue": true
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [
        aiAgentNode.position[0] - 250,
        aiAgentNode.position[1] + 100 // offset a bit
      ],
      "id": "check-ai-active-" + Date.now(),
      "name": "Check AI Active"
    };
    
    workflow.nodes.push(checkAiNode);
    
    // In this specific flow, 'Fields' node connects to 'AI Agent'. We need to intercept that.
    const fieldsNode = 'Fields';
    if (workflow.connections[fieldsNode]) {
        for (const [outIndex, arrayConns] of workflow.connections[fieldsNode].main.entries()) {
            const aiAgentConnIndex = arrayConns.findIndex(c => c.node === 'AI Agent');
            if (aiAgentConnIndex >= 0) {
                // Point Fields -> Check AI Active
                arrayConns[aiAgentConnIndex] = {
                    node: 'Check AI Active',
                    type: 'main',
                    index: 0
                };
                console.log(`Rerouted connection from ${fieldsNode} to Check AI Active`);
            }
        }
    }
    
    // Point Check AI Active True branch to AI Agent
    if (!workflow.connections['Check AI Active']) {
        workflow.connections['Check AI Active'] = { main: [[], []] };
    }
    
    workflow.connections['Check AI Active'].main[0] = [{
        node: 'AI Agent',
        type: 'main',
        index: 0
    }];
    console.log("Pointed Check AI Active true branch to AI Agent");
} else {
    console.log("Skipping IF node injection. ALready exists or missing dependencies.");
}

fs.writeFileSync('updated_workflow_ai.json', JSON.stringify(workflow, null, 2));
console.log('Saved to updated_workflow_ai.json');
