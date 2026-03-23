import { NextResponse } from 'next/server';

const SHEET_ID = '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
// Use CSV export for fast, unauthenticated reads
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Webhook URL in local n8n
const N8N_WEBHOOK_URL = process.env.N8N_MENU_WEBHOOK_URL || 'http://localhost:5678/webhook/menu-api';

// Simple CSV Parser
function parseCSV(text: string) {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  
  // Quick parse for quotes
  const parseLine = (line: string) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
       const char = line[i];
       if (char === '"') {
          inQuotes = !inQuotes;
       } else if (char === ',' && !inQuotes) {
          result.push(cur);
          cur = '';
       } else {
          cur += char;
       }
    }
    result.push(cur);
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj: any = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ? values[idx].trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

export async function GET() {
  try {
    const response = await fetch(CSV_URL, { cache: 'no-store' });
    const text = await response.text();
    const rows = parseCSV(text);
    
    // Map Google Sheet columns to Dashboard Product interface
    const products = rows.map((row, index) => {
       // Clean Price string like "$10,000" or "$1,500" or "10000"
       const rawPrice = row['Precio'] || '0';
       const cleanedPriceStr = rawPrice.replace(/[^0-9.]/g, '');
       const numericPrice = parseFloat(cleanedPriceStr) || 0;

       return {
         id: `gsheet-${index}-${row['Producto']}`, // unique pseudo-id
         name: row['Producto'] || '',
         category: row['Tipo'] || 'Otro',
         available: (row['Disponible'] === 'Sí' || row['Disponible'] === 'Si' || row['Disponible'] === 'true'),
         price: numericPrice,
         description: row['Ingredientes'] || '',
         image_url: '' // Missing in sheet but frontend ignores it nicely
       };
    }).filter(p => p.name !== ''); // Filter out empty blank rows
    
    return NextResponse.json(products);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
     const body = await req.json();
     
     // Construct the row for Google Sheets
     const sheetRow = {
        "Producto": body.name,
        "Tipo": body.category,
        "Disponible": body.available ? "Sí" : "No",
        "Precio": `$${Number(body.price).toLocaleString('es-AR')}`,
        "Ingredientes": body.description || ""
     };

     const n8nReq = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: "UPDATE", data: sheetRow })
     });

     if (!n8nReq.ok) {
        throw new Error("Failed to sync with n8n webhook");
     }

     return NextResponse.json({ success: true, product: body });
  } catch (err: any) {
     return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
   try {
      const { searchParams } = new URL(req.url);
      const name = searchParams.get('name');

      if (!name) return NextResponse.json({error: "No name provided"}, { status: 400 });

      // n8n action DELETE
      const n8nReq = await fetch(N8N_WEBHOOK_URL, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action: "DELETE", name: name })
      });

      if (!n8nReq.ok) {
         throw new Error("Failed to delete with n8n webhook");
      }
 
      return NextResponse.json({ success: true });
   } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
   }
}
