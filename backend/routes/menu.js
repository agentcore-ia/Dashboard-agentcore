const express = require('express');
const router = express.Router();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// To authorize, we need GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY
// They should be provided in .env
// We also need the GOOGLE_SHEETS_ID from the URL
const SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

// ── Sanitize Private Key ─────────────────────────────────
// Easypanel env panels sometimes wrap values in quotes or escape \n differently
let rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
// Strip surrounding quotes if present
if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    rawKey = rawKey.slice(1, -1);
}
// Replace literal \n sequences with actual newlines
const PRIVATE_KEY = rawKey.replace(/\\n/g, '\n');

console.log('── Menu Route Init ──');
console.log('SHEET_ID:', SHEET_ID ? '✅' : '❌');
console.log('SERVICE_EMAIL:', SERVICE_EMAIL ? '✅ ' + SERVICE_EMAIL : '❌ MISSING');
console.log('PRIVATE_KEY:', PRIVATE_KEY.includes('BEGIN PRIVATE KEY') ? '✅ valid format' : '❌ BAD FORMAT or MISSING');
console.log('────────────────────');

// Initialize auth
let auth, doc;
try {
    auth = new JWT({
        email: SERVICE_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    doc = new GoogleSpreadsheet(SHEET_ID, auth);
    console.log('✅ GoogleSpreadsheet initialized');
} catch (initErr) {
    console.error('❌ GoogleSpreadsheet init failed:', initErr.message);
}

let isReady = false;

// Middleware to ensure document loads first
async function ensureDocLoad(req, res, next) {
    if (!doc) {
        return res.status(500).json({ error: "Google Sheets client failed to initialize. Check server logs." });
    }
    if (!SERVICE_EMAIL || !PRIVATE_KEY) {
        return res.status(500).json({ error: "Missing Google Service Account credentials in .env (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)" });
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
