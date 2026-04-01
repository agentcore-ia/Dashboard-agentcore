async function run() {
  const url = 'https://docs.google.com/spreadsheets/d/1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4/gviz/tq?tqx=out:csv';
  const res = await fetch(url);
  const csvText = await res.text();
  
  function parseCSVLine(line) {
    const result = [];
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

  function parseCSV(csvText) {
      const lines = csvText.split('\n').filter(l => l.trim() !== '');
      if (lines.length === 0) return [];
      const headers = parseCSVLine(lines[0]);
      console.log('Headers from CSVLine:', headers.map(h => h.replace(/^"|"$/g, '').trim()));
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row = {};
          headers.forEach((h, idx) => {
              row[h.replace(/^"|"$/g, '').trim()] = (values[idx] || '').replace(/^"|"$/g, '').trim();
          });
          if (row['Producto']?.trim()) rows.push(row);
      }
      return rows;
  }

  const rows = parseCSV(csvText);
  // console.log('Parsed rows:', rows.slice(0, 2));
  
  const menu = rows.map(row => ({
      producto: row['Producto'] || '',
      tipo: row['Categoria'] || row['Tipo'] || 'Otro',
      disponible: row['Disponibilidad'] || row['Disponible'] || 'No',
      precio: row['Precio'] || '0',
      ingredientes: row['Descripción'] || row['Ingredientes'] || '',
      aliases: row['Aliases'] || '',
  }));
  
  console.log('First mapped product:', menu[0]);
  console.log('Is available strictly equal to "Sí"?', menu[0].disponible === 'Sí');
  console.log('Hex of "disponible" value:', Array.from(menu[0].disponible).map(c => c.charCodeAt(0).toString(16)).join(' '));
  console.log('Hex of "Sí" literal:', Array.from('Sí').map(c => c.charCodeAt(0).toString(16)).join(' '));
}
run().catch(console.error);
