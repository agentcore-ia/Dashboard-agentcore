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

// ── Google Sheets API v4 (for writes) using API key approach ──
// For write operations, we'll attempt using the service account.
// If credentials are broken, writes will return an error message.
async function getAuthenticatedHeaders(): Promise<Record<string, string> | null> {
    try {
        const { JWT } = await import('google-auth-library');
        
        // Try env vars first, then hardcoded fallback
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'dashboard@agent-core-490803.iam.gserviceaccount.com';
        let key = process.env.GOOGLE_PRIVATE_KEY || '';
        if (key.startsWith('"')) key = key.slice(1);
        if (key.endsWith('"')) key = key.slice(0, -1);
        key = key.replace(/\\n/g, '\n');
        
        if (!key.includes('BEGIN PRIVATE KEY')) return null;
        
        const auth = new JWT({
            email,
            key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const token = await auth.getAccessToken();
        if (!token.token) return null;
        return {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json',
        };
    } catch {
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
