const fs = require('fs');

async function main() {
  const jsonPath = 'C:\\Users\\matii\\.gemini\\antigravity\\brain\\8ca674b5-8db5-4fc3-a7df-76392831bdfb\\.system_generated\\steps\\9248\\output.txt';
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).data || JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let nodes = data.nodes || data.data.nodes; // Depending on output format

  // 1. Add payment_method to Orden tool parameters
  const ordenTool = nodes.find(n => n.name === 'Orden' && n.type === '@n8n/n8n-nodes-langchain.toolHttpRequest');
  if (ordenTool) {
    const vals = ordenTool.parameters.parametersBody.values;
    if (!vals.find(v => v.name === 'payment_method')) {
      vals.push({ name: 'payment_method' });
    }
  }

  // 2. Update the AI Prompt so it explicitly uses payment_method for the tool
  const aiNode = nodes.find(n => n.name === 'AI Agent1');
  if (aiNode) {
    let prompt = aiNode.parameters.promptType === 'define' ? aiNode.parameters.text : aiNode.parameters.prompt;
    if (prompt && !prompt.includes('payment_method')) {
      aiNode.parameters.text = prompt.replace(
        'mandale un resumen del costo total.',
        'mandale un resumen del costo total. Llama a la herramienta Orden asegurándote de proporcionar TODOS los parámetros incluyendo `total` y `payment_method` (efectivo o transferencia).'
      );
    }
  }

  // 3. Update Supabase nodes "Insert Conversacion" or "Update / Insert Conversacion" to insert `source`
  const supabases = nodes.filter(n => n.name.includes('conversacion') || n.name.includes('Conversacion'));
  supabases.forEach(n => {
    if (n.type === 'n8n-nodes-base.supabase' && n.parameters.operation === 'upsert' && n.parameters.table === 'conversaciones') {
      const dataToSend = n.parameters.columns; // e.g., "id, restaurant_id, cliente_id, ai_active"
      // Wait, 'columns' in supabase node upsert dictates what we are sending. 
      // The values come from input or can be defined fields.
      // Easiest is to change the mapping or simply use another Postgres update node, 
      // but let's see how columns are mapped. Usually it's in `dataToSend: 'defineInNode'` or `dataToSend: 'autoMapInputData'`
    }
  });

  fs.writeFileSync('C:\\Users\\matii\\Documents\\Agentcore\\n8n\\wf_main_modified.json', JSON.stringify({ data }, null, 2), 'utf8');
  console.log('Modified workflow JSON saved successfully!');
}

main().catch(console.error);
