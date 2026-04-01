const fs = require('fs');
const workflows = JSON.parse(fs.readFileSync('all_workflows.json', 'utf8'));
const targetName = "agente ia restaurante - evolution api";

const found = workflows.data.find(w => w.name.toLowerCase().includes("restaurante"));

if (found) {
    console.log(`Found: ${found.name} (ID: ${found.id})`);
} else {
    console.log("Not found");
}
