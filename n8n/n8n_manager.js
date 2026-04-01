const https = require('https');
const fs = require('fs');

const baseUrl = (process.env.N8N_BASE_URL || '').replace(/\/$/, '');
const apiKey = process.env.N8N_API_KEY || '';

if (!baseUrl || !apiKey) {
    console.error('Error: Define N8N_BASE_URL y N8N_API_KEY');
    process.exit(1);
}

const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': apiKey
};

function apiRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(`${baseUrl}/api/v1${endpoint}`);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`HTTP Error ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];

    try {
        if (cmd === 'list') {
            const res = await apiRequest('GET', '/workflows');
            console.log(JSON.stringify(res, null, 2));
        } else if (cmd === 'get') {
            const res = await apiRequest('GET', `/workflows/${args[1]}`);
            console.log(JSON.stringify(res, null, 2));
        } else if (cmd === 'create') {
            const data = JSON.parse(fs.readFileSync(args[1], 'utf8'));
            const res = await apiRequest('POST', '/workflows', data);
            console.log('Creado con ID:', res.id);
        } else if (cmd === 'update') {
            const data = JSON.parse(fs.readFileSync(args[2], 'utf8'));
            await apiRequest('PUT', `/workflows/${args[1]}`, data);
            console.log('Actualizado exitosamente.');
        } else if (cmd === 'activate') {
            const wf = await apiRequest('GET', `/workflows/${args[1]}`);
            wf.active = true;
            await apiRequest('PUT', `/workflows/${args[1]}`, wf);
            console.log('Workflow activado.');
        } else if (cmd === 'deactivate') {
            const wf = await apiRequest('GET', `/workflows/${args[1]}`);
            wf.active = false;
            await apiRequest('PUT', `/workflows/${args[1]}`, wf);
            console.log('Workflow desactivado.');
        } else {
            console.log('Usage: node n8n_manager.js <list|get|create|update|activate|deactivate> [args]');
        }
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

main();
