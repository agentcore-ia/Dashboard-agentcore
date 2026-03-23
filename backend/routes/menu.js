const express = require('express');
const router = express.Router();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// To authorize, we need GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY
// They should be provided in .env
// We also need the GOOGLE_SHEETS_ID from the URL
const SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

// Initialize auth
const auth = new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);

let isReady = false;

// Middleware to ensure document loads first
async function ensureDocLoad(req, res, next) {
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

// 1. OBTENER EL MENÚ (GET /menu)
router.get('/', ensureDocLoad, async (req, res) => {
    try {
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        const menu = rows.map(row => ({
            producto: row.get('Producto') || '',
            tipo: row.get('Tipo') || 'Otro',
            disponible: row.get('Disponible') || 'No',
            precio: row.get('Precio') || '0',
            ingredientes: row.get('Ingredientes') || '',
            aliases: row.get('Aliases') || ''
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
        row.set('Tipo', data.tipo || 'Otro');
        row.set('Disponible', data.disponible);
        row.set('Precio', numericPrice);
        row.set('Ingredientes', data.ingredientes || '');
        row.set('Aliases', data.aliases || '');
        
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
