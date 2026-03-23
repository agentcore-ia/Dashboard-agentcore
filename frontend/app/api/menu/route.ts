import { NextRequest, NextResponse } from 'next/server';

// ── Google Sheets Public CSV Endpoint ────────────────────
// This reads data WITHOUT any authentication by using the published CSV export.
// The sheet must be shared as "Anyone with the link can view".
const SHEET_ID = '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

// Expected columns: Producto, Tipo, Disponible, Precio, Ingredientes, Aliases
const HEADERS = ['Producto', 'Tipo', 'Disponible', 'Precio', 'Ingredientes', 'Aliases'];

function parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    
    // Parse header row
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    
    // Parse data rows
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h.replace(/^"|"$/g, '').trim()] = (values[idx] || '').replace(/^"|"$/g, '').trim();
        });
        // Only include rows with a non-empty Producto
        if (row['Producto'] && row['Producto'].trim() !== '') {
            rows.push(row);
        }
    }
    return rows;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
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

// ── Google Sheets API v4 authenticated writes ────────────
// Using the CORRECT private key from the original service account JSON
const SA_EMAIL = 'dashboard@agent-core-490803.iam.gserviceaccount.com';
const SA_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDN+ieHM4jtT33Y\no/i2106LRKkh3bahjBa7TpJ8kMWGzFy6CmzkJk/mjweVvXfyI+OTc53FrXeXTEBt\nXsNH8MllnAcZkR1XGj9XSgtWmzZ2aRwuAdMjUVfkGNvc1OCRCBnBL1NQGdHHSQPP\nsbclIRRv7RkkoxV/UhDHdSOAtub9CJy3kI2cy/dN2EWc0OQSfqEcCMtpA8z33z0C\nmKafWuwFgYRnOgrisY9ihbCHFqen79U5ajxcMis7OnqqXWXD+kRZ3Eg0bTs4un2d\nOBR194yEZA4gw5R/MV1Bfojr1AYbyd6suX9jd46ae6GKEyf8E3JXJjJHJCG/23sn\nsUFUQKQ7AgMBAAECggEAQTbB/Brzb9s6p3Qm41Dg49QtznShhZ1SdyRF2d2GRIsA\nksCJQGTm6EMBrkWqK8Z0H7O70KH+2q7AOUCHCIhyY1LWpqAcz36Wbl8ZnuaOhEf8\nLY7TV/vBnYzHU7Asl46ehN0kfhhmpDd4VvJX35ANJfDGBKUDwedsO5JZVr/R+2uE\ns77U/V+6ScgIHWkNnycRQ5s4nDwSxQCvtGlLgVYfg4/isGx2XsnquLFQmDrBfWIC\noeLzhTEo532G0KpVh1aXaxSEN9SxUXY503Z8frvXHic0TjyT0JXTdGyMYOl30HmT\nW1ui91eKtVWDJqZd87zRKqElSdXfAIGf8k1oyhjGoQKBgQDobSdbnHjsULvZs6XO\nvS2b9HDmmTfzZDW2K17rQqnB9rUuWPN3AHytsVX57Ppz7S34tS91wDQs3eBUuQQM\nQl8eW5jRuLdYOKE7FGgqC/gPTax70hfOs+ZlXKnN4FfO8/y6DfUPc72tvwNs4ftn\nfM2TYV+cCxeyKOLLMxwcelONYQKBgQDi3kI5VV13Wzf5B49dAzBIgPSA8GJIZIIe\nItY3qx1eByGvVVUewMlYt93khBhxSuw0OeNYos52LgtWdUxeN5W5DLfHSmEn9bKO\nyoTEgQDqe3Cha/GJBFDSci7wlaZ2go71DAq9ROFjmD7DBMqdn55xr6nHis3RdBXO\nBFiA1zebGwKBgCszJo6TfbJGqzOifV34sYJ8I4Po1IprhMQwOXs2r8C6byCHLfFf\naM0L2fQTBNYJLnM8ke6r48a3EpwMq2Dv8Sf+VGAemg1OsUD+4QF3qgqGIFn/SaeE\nrn0GhRUb7pYrqTyXnYXauFWT3Dofoo+wlbEf9xpUwXm+ubCU9lOgtOjhAoGBAKc3\nbRZ3PjIIUSRDlz7WZ9M5AX68L6TuOB3gTYawoC+7D+/89IV7Ua0LsQiK+L0gnSMN\ne+3L6mOfIooyYPyc+cVwg1DoGN5sMZUf3mY8M6GhJG5GcrwsKypCMSjxFMYLCzXB\nD3Vb/Mj84V26/WDa0t02vewu+e8lIiE8gMNOXlT7AoGAJKEN5COjSTmrRGW2MU9u\n31rVKKeGGijdPYWTC42RFhZ5luR2El454uefWJkN+mQxWp8Y7zMz2P4n2Efkkypi\nM9wbOR0Ha7HJWMH3uQhspitPoKtyTW7DfjaVpt0sFbu5qN8SNYJsonqexrA+g/w0\n+Gcrx4iQEicwQ7XNT7DbfcA=\n-----END PRIVATE KEY-----\n";

async function getAuthenticatedHeaders(): Promise<Record<string, string> | null> {
    try {
        const { JWT } = await import('google-auth-library');
        const auth = new JWT({
            email: SA_EMAIL,
            key: SA_KEY,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const token = await auth.getAccessToken();
        if (!token.token) return null;
        return {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json',
        };
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════
// GET — Read all products from Google Sheets (PUBLIC, no auth)
// ═══════════════════════════════════════════════════════════
export async function GET() {
    try {
        const response = await fetch(CSV_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Google Sheets returned ${response.status}: ${response.statusText}`);
        }
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        const menu = rows.map(row => ({
            producto: row['Producto'] || '',
            tipo: row['Tipo'] || 'Otro',
            disponible: row['Disponible'] || 'No',
            precio: row['Precio'] || '0',
            ingredientes: row['Ingredientes'] || '',
            aliases: row['Aliases'] || '',
        }));
        
        return NextResponse.json(menu);
    } catch (err: any) {
        console.error('GET /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// POST — Add a new product
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        if (!data.producto?.trim()) {
            return NextResponse.json({ error: 'El nombre del producto no puede estar vacío' }, { status: 400 });
        }

        const headers = await getAuthenticatedHeaders();
        if (!headers) {
            return NextResponse.json({ error: 'Credenciales de Google no válidas. Contacta al administrador.' }, { status: 500 });
        }

        const price = parseFloat(String(data.precio).replace(/[^0-9.]/g, '')) || 0;
        const values = [[
            data.producto.trim(),
            data.tipo || 'Otro',
            data.disponible || 'Sí',
            price,
            data.ingredientes || '',
            data.aliases || ''
        ]];

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ values }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }

        return NextResponse.json({ success: true, data: { Producto: data.producto, Tipo: data.tipo, Disponible: data.disponible, Precio: price, Ingredientes: data.ingredientes, Aliases: data.aliases } }, { status: 201 });
    } catch (err: any) {
        console.error('POST /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// PUT — Edit an existing product
// ═══════════════════════════════════════════════════════════
export async function PUT(request: NextRequest) {
    try {
        const data = await request.json();
        const originalName = data.originalName || data.producto;
        if (!originalName) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 });

        const headers = await getAuthenticatedHeaders();
        if (!headers) {
            return NextResponse.json({ error: 'Credenciales de Google no válidas. Contacta al administrador.' }, { status: 500 });
        }

        // First, find the row number
        const csvRes = await fetch(CSV_URL, { cache: 'no-store' });
        const csvText = await csvRes.text();
        const rows = parseCSV(csvText);
        const rowIndex = rows.findIndex(r => r['Producto']?.trim() === originalName.trim());
        if (rowIndex === -1) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

        const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-indexed
        const price = parseFloat(String(data.precio).replace(/[^0-9.]/g, '')) || 0;
        const values = [[
            (data.producto || originalName).trim(),
            data.tipo || 'Otro',
            data.disponible || 'Sí',
            price,
            data.ingredientes || '',
            data.aliases || ''
        ]];

        const range = `Sheet1!A${sheetRow}:F${sheetRow}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ values }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }

        return NextResponse.json({ success: true, data: { Producto: data.producto, Tipo: data.tipo, Disponible: data.disponible, Precio: price, Ingredientes: data.ingredientes, Aliases: data.aliases } });
    } catch (err: any) {
        console.error('PUT /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// PATCH — Toggle availability
// ═══════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest) {
    try {
        const data = await request.json();
        const { producto, disponible } = data;
        if (!producto) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 });

        const headers = await getAuthenticatedHeaders();
        if (!headers) {
            return NextResponse.json({ error: 'Credenciales de Google no válidas. Contacta al administrador.' }, { status: 500 });
        }

        // Find row number
        const csvRes = await fetch(CSV_URL, { cache: 'no-store' });
        const csvText = await csvRes.text();
        const rows = parseCSV(csvText);
        const rowIndex = rows.findIndex(r => r['Producto']?.trim() === producto.trim());
        if (rowIndex === -1) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

        const sheetRow = rowIndex + 2;
        const range = `Sheet1!C${sheetRow}`; // Column C = Disponible
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ values: [[disponible]] }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('PATCH /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// DELETE — Remove a product
// ═══════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const producto = searchParams.get('producto');
        if (!producto) return NextResponse.json({ error: 'Falta el nombre del producto' }, { status: 400 });

        const headers = await getAuthenticatedHeaders();
        if (!headers) {
            return NextResponse.json({ error: 'Credenciales de Google no válidas. Contacta al administrador.' }, { status: 500 });
        }

        // Find row number
        const csvRes = await fetch(CSV_URL, { cache: 'no-store' });
        const csvText = await csvRes.text();
        const rows = parseCSV(csvText);
        const rowIndex = rows.findIndex(r => r['Producto']?.trim() === producto.trim());
        if (rowIndex === -1) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

        const sheetRow = rowIndex + 2;
        // Clear the row (Google Sheets API v4 doesn't have a direct delete-row via values endpoint)
        const range = `Sheet1!A${sheetRow}:F${sheetRow}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
        const res = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ values: [['', '', '', '', '', '']] }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('DELETE /api/menu error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
