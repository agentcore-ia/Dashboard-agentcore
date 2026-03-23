const express = require('express');
const router = express.Router();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// To authorize, we need GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY
// They should be provided in .env
// ── Hardcoded fallback credentials ───────────────────────
// These are used if env vars are empty/missing (common in Docker/Easypanel)
const FALLBACK_SHEET_ID = '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
const FALLBACK_EMAIL = 'dashboard@agent-core-490803.iam.gserviceaccount.com';
const FALLBACK_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDN+ieHM4jtT33Y\no/i2106LRKkh3bahjBa7TpJ8kMWGzFy6CmzkJk/mjweVvXfyI+OTc53FrXeXTEBt\nXsNH8MllnAcZkR1XGj9XSgtWmzZ2aRwuAdMjUVfkGNvc1OCRCBnBL1NQGdHHSQPP\nsbclIRRv7RkkoxV/UhDHdSOAtub9CJy3kI2cy/dN2EWc0OQSfqEcCMtpA8z33z0C\nmKafWuwFgYRnOgrisY9ihbCHFqen79U5ajxcMis7OnqqXWXD+kRZ3Eg0bTs4un2d\nOBR194yEZA4gw5R/MV1Bfojr1AYbyd6suX9jd46ae6GKEyf8E3JXJjJHJCG/23sn\nsUFUQKQ7AgMBAAECggEAQTbB/Brzb9s6p3Qm41Dg49QtznShhZ1SdyRF2d2GRIsA\nksCJQGTm6EMBrkWqK8Z0H7O70KH+2q7AOUCHCIhyY1LWpqAcz36Wbl8ZnuaOhEf8\nLY7TV/vBnYzHU7Asl46ehN0kfhhmpDd4VvJX35ANJfDGBKUDwedsO5JZVr/R+2uE\ns77U/V+6ScgIHWkNnycRQ5s4nDwSxQCvtGlLgVYfg4/isGx2XsnquLFQmDrBfWIC\noeLzhTEo532G0KpVh1aXaxSEN9SxUXY503Z8frXXHic0TjyT0JXTdGyMYOl30HmT\nW1ui91eKtVWDJqZd87zRKqElSdXfAIGf8k1oyhjGoQKBgQDobSdbnHjsULvZs6XO\nvS2b9HDmmTfzZDW2K17rQqnB9rUuWPN3AHytsVX57Ppz7S34tS91wDQs3eBUuQQM\nQl8eW5jRuLdYOKE7FGgqC/gPTax70hfOs+ZlXKnN4FfO8/y6DfUPc72tvwNs4ftn\nfM2TYV+cCxeyKOLLMxwcelONYQKBgQDi3kI5VV13Wzf5B49dAzBIgPSA8GJIZIIe\nItY3qx1eByGvVVUewMlYt93khBhxSuw0OeNYos52LgtWdUxeN5W5DLfHSmEn9bKO\nyoTEgQDqe3Cha/GJBFDSci7wlaZ2go71DAq9ROFjmD7DBMqdn55xr6nHis3RdBXO\nBFiA1zebGwKBgCszJo6TfbJGqzOifV34sYJ8I4Po1IprhMQwOXs2r8C6byCHLfFf\naM0L2fQTBNYJLnM8ke6r48a3EpwMq2Dv8Sf+VGAemg1OsUD+4QF3qgqGIFn/SaeE\nrn0GhRUb7pYrqTyXnYXauFWT3Dofoo+wlbEf9xpUwXm+ubCU9lOgtOjhAoBAKc3\nbRZ3PjIIUSRDlz7WZ9M5AX68L6TuOB3gTYawoC+7D+/89IV7Ua0LsQiK+L0gnSMN\ne+3L6mOfIooyYPyc+cVwg1DoGN5sMZUf3mY8M6GhJG5GcrwsKypCMSjxFMYLCzXB\nD3Vb/Mj84V26/WDa0t02vewu+e8lIiE8gMNOXlT7AoGAJKEN5COjSTmrRGW2MU9u\n31rVKKeGGijdPYWTC42RFhZ5luR2El454uefWJkN+mQxWp8Y7zMz2P4n2Efkkypi\nM9wbOR0Ha7HJWMH3uQhspitPoKtyTW7DfjaVpt0sFbu5qN8SNYJsonqexrA+g/w0\n+Gcrx4iQEicwQ7XNT7DbfcA=\n-----END PRIVATE KEY-----\n";

// Use env vars if present, otherwise use hardcoded fallbacks
function getEnvOrFallback(envVal, fallback) {
    if (!envVal || envVal.trim() === '') return fallback;
    // Strip surrounding quotes
    let val = envVal.trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    return val;
}

const SHEET_ID = getEnvOrFallback(process.env.GOOGLE_SHEETS_ID, FALLBACK_SHEET_ID);
const SERVICE_EMAIL = getEnvOrFallback(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, FALLBACK_EMAIL);
let PRIVATE_KEY = getEnvOrFallback(process.env.GOOGLE_PRIVATE_KEY, FALLBACK_KEY);
// Replace literal \n sequences with actual newlines (in case env panel stores them escaped)
PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');

console.log('── Menu Route Init ──');
console.log('SHEET_ID:', SHEET_ID ? '✅' : '❌');
console.log('SERVICE_EMAIL:', SERVICE_EMAIL ? '✅ ' + SERVICE_EMAIL : '❌ MISSING');
console.log('PRIVATE_KEY:', PRIVATE_KEY.includes('BEGIN PRIVATE KEY') ? '✅ valid format' : '❌ BAD FORMAT');
console.log('────────────────────');

// Initialize auth
const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(SHEET_ID, auth);
console.log('✅ GoogleSpreadsheet initialized');

let isReady = false;

// Middleware to ensure document loads first
async function ensureDocLoad(req, res, next) {
    if (!doc) {
        return res.status(500).json({ error: "Google Sheets client failed to initialize. Check server logs." });
    }
    if (!isReady) {
        try {
            await doc.loadInfo();
            isReady = true;
        } catch (error) {
            return res.status(500).json({ error: "Failed to connect to Google Sheets", details: error.message });
        }
    }
    next();
}

// Helper para obtener columnas sin que crashee si no existe
function safeGet(row, header) {
    try {
        return row.get(header) || '';
    } catch (e) {
        return '';
    }
}

// Helper para setear columnas solo si el header existe
function safeSet(row, header, value) {
    try {
        row.set(header, value);
    } catch (e) {
        // Ignorar si la columna no existe en el sheet
    }
}

// 1. OBTENER EL MENÚ (GET /menu)
router.get('/', ensureDocLoad, async (req, res) => {
    try {
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const menu = rows
            .filter(row => {
                const prod = safeGet(row, 'Producto');
                return prod && prod.trim() !== '';
            })
            .map(row => ({
                producto: safeGet(row, 'Producto'),
                tipo: safeGet(row, 'Tipo') || 'Otro',
                disponible: safeGet(row, 'Disponible') || 'No',
                precio: safeGet(row, 'Precio') || '0',
                ingredientes: safeGet(row, 'Ingredientes'),
                aliases: safeGet(row, 'Aliases')
            }));

        res.json(menu);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// VALIDACIONES CORE
function validateMenuData(data) {
    if (!data.producto || data.producto.trim() === '') {
        throw new Error("El nombre del Producto no puede estar vacío");
    }

    // Limpiar precio (si envían un string con $ o comas, dejar solo números)
    let rawPrice = String(data.precio).replace(/[^0-9.]/g, '');
    let numericPrice = parseFloat(rawPrice);
    if (isNaN(numericPrice) || numericPrice < 0) {
        throw new Error("El precio debe ser un número válido");
    }

    const disponible = data.disponible;
    if (disponible !== 'Sí' && disponible !== 'No') {
        throw new Error("Disponible solo puede ser 'Sí' o 'No'");
    }

    return { numericPrice };
}

// 2. AGREGAR UN PRODUCTO NUEVO (POST /menu)
router.post('/', ensureDocLoad, async (req, res) => {
    try {
        const data = req.body;
        const { numericPrice } = validateMenuData(data);
        
        const sheet = doc.sheetsByIndex[0];
        // Verificar si existe para no duplicar por error
        const rows = await sheet.getRows();
        const exists = rows.find(r => r.get('Producto').trim() === data.producto.trim());
        if (exists) {
            return res.status(400).json({ error: "El producto ya existe" });
        }

        const newRow = {
            'Producto': data.producto.trim(),
            'Tipo': data.tipo || 'Otro',
            'Disponible': data.disponible,
            'Precio': numericPrice,
            'Ingredientes': data.ingredientes || '',
            'Aliases': data.aliases || ''
        };

        await sheet.addRow(newRow);
        res.status(201).json({ success: true, message: "Producto agregado correctamente", data: newRow });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// 3. EDITAR UN PRODUCTO EXISTENTE (PUT /menu/:producto)
router.put('/:producto', ensureDocLoad, async (req, res) => {
    try {
        const productName = req.params.producto;
        const data = req.body;
        
        const { numericPrice } = validateMenuData(data);

        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('Producto').trim() === productName.trim());

        if (!row) return res.status(404).json({ error: "Producto no encontrado" });

        row.set('Producto', data.producto.trim());
        safeSet(row, 'Tipo', data.tipo || 'Otro');
        safeSet(row, 'Disponible', data.disponible);
        safeSet(row, 'Precio', numericPrice);
        safeSet(row, 'Ingredientes', data.ingredientes || '');
        safeSet(row, 'Aliases', data.aliases || '');
        
        await row.save();
        
        res.json({ success: true, message: "Producto actualizado", data: data });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// 4. CAMBIAR DISPONIBILIDAD (PATCH /menu/:producto/disponible)
router.patch('/:producto/disponible', ensureDocLoad, async (req, res) => {
    try {
        const productName = req.params.producto;
        const { disponible } = req.body;

        if (disponible !== 'Sí' && disponible !== 'No') {
            return res.status(400).json({ error: "Disponible solo puede ser 'Sí' o 'No'" });
        }

        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('Producto').trim() === productName.trim());

        if (!row) return res.status(404).json({ error: "Producto no encontrado" });

        row.set('Disponible', disponible);
        await row.save();

        res.json({ success: true, message: `Disponibilidad de ${productName} actualizada a ${disponible}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 5. ELIMINAR UN PRODUCTO (DELETE /menu/:producto)
router.delete('/:producto', ensureDocLoad, async (req, res) => {
    try {
        const productName = req.params.producto;

        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('Producto').trim() === productName.trim());

        if (!row) return res.status(404).json({ error: "Producto no encontrado" });

        await row.delete();

        res.json({ success: true, message: "Producto eliminado correctamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
