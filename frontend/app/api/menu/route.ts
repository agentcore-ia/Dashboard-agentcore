import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// ── Configuration ────────────────────────────────────────
const SHEET_ID = '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const SA_EMAIL = 'dashboard@agent-core-490803.iam.gserviceaccount.com';
const SA_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDN+ieHM4jtT33Y\no/i2106LRKkh3bahjBa7TpJ8kMWGzFy6CmzkJk/mjweVvXfyI+OTc53FrXeXTEBt\nXsNH8MllnAcZkR1XGj9XSgtWmzZ2aRwuAdMjUVfkGNvc1OCRCBnBL1NQGdHHSQPP\nsbclIRRv7RkkoxV/UhDHdSOAtub9CJy3kI2cy/dN2EWc0OQSfqEcCMtpA8z33z0C\nmKafWuwFgYRnOgrisY9ihbCHFqen79U5ajxcMis7OnqqXWXD+kRZ3Eg0bTs4un2d\nOBR194yEZA4gw5R/MV1Bfojr1AYbyd6suX9jd46ae6GKEyf8E3JXJjJHJCG/23sn\nsUFUQKQ7AgMBAAECggEAQTbB/Brzb9s6p3Qm41Dg49QtznShhZ1SdyRF2d2GRIsA\nksCJQGTm6EMBrkWqK8Z0H7O70KH+2q7AOUCHCIhyY1LWpqAcz36Wbl8ZnuaOhEf8\nLY7TV/vBnYzHU7Asl46ehN0kfhhmpDd4VvJX35ANJfDGBKUDwedsO5JZVr/R+2uE\ns77U/V+6ScgIHWkNnycRQ5s4nDwSxQCvtGlLgVYfg4/isGx2XsnquLFQmDrBfWIC\noeLzhTEo532G0KpVh1aXaxSEN9SxUXY503Z8frvXHic0TjyT0JXTdGyMYOl30HmT\nW1ui91eKtVWDJqZd87zRKqElSdXfAIGf8k1oyhjGoQKBgQDobSdbnHjsULvZs6XO\nvS2b9HDmmTfzZDW2K17rQqnB9rUuWPN3AHytsVX57Ppz7S34tS91wDQs3eBUuQQM\nQl8eW5jRuLdYOKE7FGgqC/gPTax70hfOs+ZlXKnN4FfO8/y6DfUPc72tvwNs4ftn\nfM2TYV+cCxeyKOLLMxwcelONYQKBgQDi3kI5VV13Wzf5B49dAzBIgPSA8GJIZIIe\nItY3qx1eByGvVVUewMlYt93khBhxSuw0OeNYos52LgtWdUxeN5W5DLfHSmEn9bKO\nyoTEgQDqe3Cha/GJBFDSci7wlaZ2go71DAq9ROFjmD7DBMqdn55xr6nHis3RdBXO\nBFiA1zebGwKBgCszJo6TfbJGqzOifV34sYJ8I4Po1IprhMQwOXs2r8C6byCHLfFf\naM0L2fQTBNYJLnM8ke6r48a3EpwMq2Dv8Sf+VGAemg1OsUD+4QF3qgqGIFn/SaeE\nrn0GhRUb7pYrqTyXnYXauFWT3Dofoo+wlbEf9xpUwXm+ubCU9lOgtOjhAoGBAKc3\nbRZ3PjIIUSRDlz7WZ9M5AX68L6TuOB3gTYawoC+7D+/89IV7Ua0LsQiK+L0gnSMN\ne+3L6mOfIooyYPyc+cVwg1DoGN5sMZUf3mY8M6GhJG5GcrwsKypCMSjxFMYLCzXB\nD3Vb/Mj84V26/WDa0t02vewu+e8lIiE8gMNOXlT7AoGAJKEN5COjSTmrRGW2MU9u\n31rVKKeGGijdPYWTC42RFhZ5luR2El454uefWJkN+mQxWp8Y7zMz2P4n2Efkkypi\nM9wbOR0Ha7HJWMH3uQhspitPoKtyTW7DfjaVpt0sFbu5qN8SNYJsonqexrA+g/w0\n+Gcrx4iQEicwQ7XNT7DbfcA=\n-----END PRIVATE KEY-----\n";

// ── CSV Parser ───────────────────────────────────────────
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    const headers = parseCSVLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h.replace(/^"|"$/g, '').trim()] = (values[idx] || '').replace(/^"|"$/g, '').trim();
        });
        if (row['Producto']?.trim()) rows.push(row);
    }
    return rows;
}

// ── Helper: get authenticated GoogleSpreadsheet instance ─
function safeGet(row: any, header: string): string {
    try { return row.get(header) || ''; } catch { return ''; }
}

async function getAuthDoc(): Promise<GoogleSpreadsheet> {
    const auth = new JWT({
        email: SA_EMAIL,
        key: SA_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();
    return doc;
}

// ═════════════════════════════════════════════════════════
// GET — Read all products (PUBLIC CSV, no auth needed)
// ═════════════════════════════════════════════════════════
export async function GET() {
    try {
        const response = await fetch(CSV_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Google Sheets returned ${response.status}`);
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        const menu = rows.map(row => ({
            producto: row['Producto'] || '',
            tipo: row['Categoria'] || row['Tipo'] || 'Otro',
            disponible: row['Disponibilidad'] || row['Disponible'] || 'No',
            precio: row['Precio'] || '0',
            ingredientes: row['Descripción'] || row['Ingredientes'] || '',
            aliases: row['Aliases'] || '',
        }));
        return NextResponse.json(menu);
    } catch (err: any) {
        console.error('GET /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═════════════════════════════════════════════════════════
// POST — Add a new product
// ═════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        if (!data.producto?.trim()) {
            return NextResponse.json({ error: 'El nombre del producto no puede estar vacío' }, { status: 400 });
        }
        const doc = await getAuthDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const exists = rows.find((r: any) => safeGet(r, 'Producto').trim() === data.producto.trim());
        if (exists) return NextResponse.json({ error: 'El producto ya existe' }, { status: 400 });

        const price = parseFloat(String(data.precio).replace(/[^0-9.]/g, '')) || 0;
        await sheet.addRow({
            'Producto': data.producto.trim(),
            'Tipo': data.tipo || 'Otro',
            'Disponible': data.disponible || 'Sí',
            'Precio': price,
            'Ingredientes': data.ingredientes || '',
        });
        return NextResponse.json({ success: true, data: { Producto: data.producto.trim(), Tipo: data.tipo || 'Otro', Disponible: data.disponible || 'Sí', Precio: price, Ingredientes: data.ingredientes || '', Aliases: data.aliases || '' } }, { status: 201 });
    } catch (err: any) {
        console.error('POST /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═════════════════════════════════════════════════════════
// PUT — Edit an existing product
// ═════════════════════════════════════════════════════════
export async function PUT(request: NextRequest) {
    try {
        const data = await request.json();
        const originalName = data.originalName || data.producto;
        if (!originalName) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 });

        const doc = await getAuthDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const row = rows.find((r: any) => safeGet(r, 'Producto').trim() === originalName.trim());
        if (!row) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

        const price = parseFloat(String(data.precio).replace(/[^0-9.]/g, '')) || 0;
        row.set('Producto', (data.producto || originalName).trim());
        try { row.set('Tipo', data.tipo || 'Otro'); } catch {}
        try { row.set('Disponible', data.disponible || 'Sí'); } catch {}
        try { row.set('Precio', price); } catch {}
        try { row.set('Ingredientes', data.ingredientes || ''); } catch {}
        try { row.set('Aliases', data.aliases || ''); } catch {}
        await row.save();
        return NextResponse.json({ success: true, data: { Producto: (data.producto || originalName).trim(), Tipo: data.tipo || 'Otro', Disponible: data.disponible || 'Sí', Precio: price, Ingredientes: data.ingredientes || '', Aliases: data.aliases || '' } });
    } catch (err: any) {
        console.error('PUT /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═════════════════════════════════════════════════════════
// PATCH — Toggle availability
// ═════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest) {
    try {
        const data = await request.json();
        const { producto, disponible } = data;
        if (!producto) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 });

        const doc = await getAuthDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const row = rows.find((r: any) => safeGet(r, 'Producto').trim() === producto.trim());
        if (!row) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

        row.set('Disponibilidad', disponible);
        await row.save();
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('PATCH /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═════════════════════════════════════════════════════════
// DELETE — Remove a product
// ═════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const producto = searchParams.get('producto');
        if (!producto) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 });

        const doc = await getAuthDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const row = rows.find((r: any) => safeGet(r, 'Producto').trim() === producto.trim());
        if (!row) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

        await row.delete();
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('DELETE /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
