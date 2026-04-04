export interface TicketData {
  tableName: string;
  clientName?: string | null;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
};

function fmt(n: number) {
  return "$\u00a0" + n.toLocaleString("es-AR");
}

export function printTicket(data: TicketData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const itemsHtml = data.items.map(item => `
    <tr>
      <td class="qty">${item.quantity}x</td>
      <td class="iname">${item.name}</td>
      <td class="iprice">${fmt(item.price * item.quantity)}</td>
    </tr>
    ${item.quantity > 1 ? `<tr><td></td><td class="unit-price">${fmt(item.price)} c/u</td><td></td></tr>` : ""}
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket \u00b7 ${data.tableName}</title>
  <style>
    @page { size: A4 portrait; margin: 20mm 18mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Arial', sans-serif;
      font-size: 18px;
      color: #111;
      line-height: 1.6;
    }

    .center { text-align: center; }

    /* ── HEADER ── */
    .header { text-align: center; margin-bottom: 24px; }
    .business-name {
      font-size: 42px;
      font-weight: 900;
      letter-spacing: 6px;
      text-transform: uppercase;
    }
    .business-sub {
      font-size: 15px;
      color: #666;
      margin-top: 2px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* ── DIVIDERS ── */
    .divider-solid { border: none; border-top: 3px solid #111; margin: 18px 0; }
    .divider-dash  { border: none; border-top: 2px dashed #bbb; margin: 14px 0; }

    /* ── META INFO ── */
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .meta-row .label { color: #777; }
    .meta-row .value { font-weight: 700; }

    /* ── TABLE HEADER ── */
    .col-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    /* ── ITEMS TABLE ── */
    table.items {
      width: 100%;
      border-collapse: collapse;
    }
    table.items td {
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      font-size: 18px;
    }
    table.items td.qty {
      width: 50px;
      font-weight: 900;
      color: #111;
    }
    table.items td.iname {
      font-weight: 600;
    }
    table.items td.iprice {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }
    table.items td.unit-price {
      font-size: 13px;
      color: #aaa;
      padding-top: 0;
      border-bottom: none;
    }

    /* ── TOTALS ── */
    .totals-block { margin-top: 8px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      padding: 8px 0;
      border-bottom: 1px dashed #ddd;
    }
    .total-row.discount { color: #16a34a; font-weight: 700; }
    .total-row.subtotal { color: #777; }

    /* ── BIG TOTAL ── */
    .grand-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 20px 0 16px;
    }
    .grand-total .label {
      font-size: 22px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 4px;
    }
    .grand-total .amount {
      font-size: 64px;
      font-weight: 900;
      line-height: 1;
    }

    /* ── PAYMENT ── */
    .payment-row {
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      padding: 10px 0;
    }
    .payment-row .label { color: #777; }
    .payment-row .value { font-weight: 700; font-size: 20px; }

    /* ── FOOTER ── */
    .footer {
      text-align: center;
      margin-top: 40px;
    }
    .footer .thanks {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .footer .site {
      font-size: 15px;
      color: #aaa;
      letter-spacing: 2px;
    }
    .footer .order-num {
      font-size: 13px;
      color: #ccc;
      margin-top: 20px;
      letter-spacing: 3px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="business-name">AGENTCORE</div>
    <div class="business-sub">Sistema de Gestión &middot; Sal&oacute;n</div>
  </div>

  <hr class="divider-solid"/>

  <div class="meta-row"><span class="label">Fecha</span><span class="value">${dateStr}</span></div>
  <div class="meta-row"><span class="label">Hora</span><span class="value">${timeStr}</span></div>
  <div class="meta-row"><span class="label">Mesa</span><span class="value">${data.tableName}</span></div>
  ${data.clientName ? `<div class="meta-row"><span class="label">Cliente</span><span class="value">${data.clientName}</span></div>` : ""}

  <hr class="divider-solid"/>

  <div class="col-header">
    <span>CANT &nbsp; DESCRIPCI&Oacute;N</span>
    <span>IMPORTE</span>
  </div>

  <table class="items">
    <tbody>${itemsHtml}</tbody>
  </table>

  <hr class="divider-dash"/>

  <div class="totals-block">
    <div class="total-row subtotal">
      <span>Subtotal</span>
      <span>${fmt(data.subtotal)}</span>
    </div>
    ${data.discount > 0 ? `
    <div class="total-row discount">
      <span>Descuento (${data.discount}%)</span>
      <span>- ${fmt(data.discountAmount)}</span>
    </div>` : ""}
  </div>

  <hr class="divider-solid"/>

  <div class="grand-total">
    <span class="label">TOTAL</span>
    <span class="amount">${fmt(data.total)}</span>
  </div>

  <hr class="divider-dash"/>

  <div class="payment-row">
    <span class="label">Forma de pago</span>
    <span class="value">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</span>
  </div>

  <hr class="divider-solid"/>

  <div class="footer">
    <div class="thanks">&iexcl;Gracias por su visita!</div>
    <div class="site">agentcore-ia.com</div>
    <div class="order-num"># ${now.getTime().toString().slice(-6)}</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 1200);
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700,toolbar=0,menubar=0,location=0,scrollbars=1");
  if (!win) {
    alert("Habilitá las ventanas emergentes para imprimir el ticket.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
