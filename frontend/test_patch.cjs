const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = '1WUQRUqR-u8FLENLJUuxpNepQ3eezlaw6yo8CI0fVYq4';
const SA_EMAIL = 'dashboard@agent-core-490803.iam.gserviceaccount.com';
const SA_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDN+ieHM4jtT33Y\no/i2106LRKkh3bahjBa7TpJ8kMWGzFy6CmzkJk/mjweVvXfyI+OTc53FrXeXTEBt\nXsNH8MllnAcZkR1XGj9XSgtWmzZ2aRwuAdMjUVfkGNvc1OCRCBnBL1NQGdHHSQPP\nsbclIRRv7RkkoxV/UhDHdSOAtub9CJy3kI2cy/dN2EWc0OQSfqEcCMtpA8z33z0C\nmKafWuwFgYRnOgrisY9ihbCHFqen79U5ajxcMis7OnqqXWXD+kRZ3Eg0bTs4un2d\nOBR194yEZA4gw5R/MV1Bfojr1AYbyd6suX9jd46ae6GKEyf8E3JXJjJHJCG/23sn\nsUFUQKQ7AgMBAAECggEAQTbB/Brzb9s6p3Qm41Dg49QtznShhZ1SdyRF2d2GRIsA\nksCJQGTm6EMBrkWqK8Z0H7O70KH+2q7AOUCHCIhyY1LWpqAcz36Wbl8ZnuaOhEf8\nLY7TV/vBnYzHU7Asl46ehN0kfhhmpDd4VvJX35ANJfDGBKUDwedsO5JZVr/R+2uE\ns77U/V+6ScgIHWkNnycRQ5s4nDwSxQCvtGlLgVYfg4/isGx2XsnquLFQmDrBfWIC\noeLzhTEo532G0KpVh1aXaxSEN9SxUXY503Z8frvXHic0TjyT0JXTdGyMYOl30HmT\nW1ui91eKtVWDJqZd87zRKqElSdXfAIGf8k1oyhjGoQKBgQDobSdbnHjsULvZs6XO\nvS2b9HDmmTfzZDW2K17rQqnB9rUuWPN3AHytsVX57Ppz7S34tS91wDQs3eBUuQQM\nQl8eW5jRuLdYOKE7FGgqC/gPTax70hfOs+ZlXKnN4FfO8/y6DfUPc72tvwNs4ftn\nfM2TYV+cCxeyKOLLMxwcelONYQKBgQDi3kI5VV13Wzf5B49dAzBIgPSA8GJIZIIe\nItY3qx1eByGvVVUewMlYt93khBhxSuw0OeNYos52LgtWdUxeN5W5DLfHSmEn9bKO\nyoTEgQDqe3Cha/GJBFDSci7wlaZ2go71DAq9ROFjmD7DBMqdn55xr6nHis3RdBXO\nBFiA1zebGwKBgCszJo6TfbJGqzOifV34sYJ8I4Po1IprhMQwOXs2r8C6byCHLfFf\naM0L2fQTBNYJLnM8ke6r48a3EpwMq2Dv8Sf+VGAemg1OsUD+4QF3qgqGIFn/SaeE\nrn0GhRUb7pYrqTyXnYXauFWT3Dofoo+wlbEf9xpUwXm+ubCU9lOgtOjhAoGBAKc3\nbRZ3PjIIUSRDlz7WZ9M5AX68L6TuOB3gTYawoC+7D+/89IV7Ua0LsQiK+L0gnSMN\ne+3L6mOfIooyYPyc+cVwg1DoGN5sMZUf3mY8M6GhJG5GcrwsKypCMSjxFMYLCzXB\nD3Vb/Mj84V26/WDa0t02vewu+e8lIiE8gMNOXlT7AoGAJKEN5COjSTmrRGW2MU9u\n31rVKKeGGijdPYWTC42RFhZ5luR2El454uefWJkN+mQxWp8Y7zMz2P4n2Efkkypi\nM9wbOR0Ha7HJWMH3uQhspitPoKtyTW7DfjaVpt0sFbu5qN8SNYJsonqexrA+g/w0\n+Gcrx4iQEicwQ7XNT7DbfcA=\n-----END PRIVATE KEY-----\n';

function safeGet(row, header) {
    try { return row.get(header) || ''; } catch (e) { return ''; }
}

async function run() {
    const auth = new JWT({
        email: SA_EMAIL,
        key: SA_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('Fetching rows from GS...');
    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    await sheet.loadHeaderRow();
    console.log('Exact headers:', sheet.headerValues);

    const rows = await sheet.getRows();
    const producto = 'Muzzarella';
                 
    const row = rows.find(r => safeGet(r, 'Producto').trim() === producto.trim());
    if (!row) return console.log('not found');
    console.log('Before update, Disponibilidad is:', safeGet(row, 'Disponibilidad'));

    row.set('Disponibilidad', 'No');
    await row.save();
    console.log('After update:', safeGet(row, 'Disponibilidad'));
}

run().catch(console.error);
