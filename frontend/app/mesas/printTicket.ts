export interface TicketData {
  tableName: string;
  clientName?: string | null;
  orderNumber?: number | null;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash:     "Efectivo",
  card:     "Tarjeta",
  transfer: "Transferencia",
  qr:       "QR",
};

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR");
}

export function printTicket(data: TicketData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit",
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Ticket · ${data.tableName}</title>
  <style>
    /* ── SCREEN: big and readable ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Courier New', Courier, monospace;
      background: #f0f0f0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 24px 12px;
    }

    .ticket {
      background: #fff;
      width: 100%;
      max-width: 480px;
      padding: 28px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
      font-size: 15px;
      line-height: 1.6;
      color: #111;
    }

    .center   { text-align: center; }
    .bold     { font-weight: bold; }
    .xlarge   { font-size: 26px; font-weight: 900; letter-spacing: 1px; }
    .large    { font-size: 18px; font-weight: bold; }
    .small    { font-size: 12px; }
    .muted    { color: #555; }

    hr.solid  { border: none; border-top: 2px solid #111; margin: 10px 0; }
    hr.dashed { border: none; border-top: 1px dashed #999; margin: 8px 0; }

    .row { display: flex; justify-content: space-between; align-items: baseline; margin: 4px 0; }
    .row-item { display: flex; justify-content: space-between; align-items: baseline; margin: 6px 0; }
    .qty   { min-width: 30px; font-weight: bold; }
    .iname { flex: 1; padding: 0 8px; }
    .iprice{ text-align: right; font-weight: bold; }
    .sub   { font-size: 12px; color: #777; padding-left: 38px; margin-top: -4px; margin-bottom: 4px; }

    .total-block {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 12px 0 8px;
    }
    .total-label { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
    .total-value { font-size: 42px; font-weight: 900; line-height: 1; }

    .discount-row { color: #16a34a; font-weight: bold; }

    .footer { text-align: center; margin-top: 18px; }

    .barcode {
      text-align: center;
      margin-top: 14px;
      letter-spacing: 3px;
      font-size: 13px;
      color: #aaa;
    }

    /* ── PRINT: compact 80mm thermal ── */
    @media print {
      body {
        background: #fff;
        padding: 0;
        display: block;
      }
      .ticket {
        max-width: 100%;
        width: 100%;
        box-shadow: none;
        border-radius: 0;
        padding: 4mm 3mm;
        font-size: 11px;
        line-height: 1.4;
      }
      .xlarge   { font-size: 18px; }
      .large    { font-size: 13px; }
      .total-value { font-size: 26px; }
      .total-label { font-size: 12px; }
      hr.solid  { border-top-width: 1px; }
    }

    @page {
      size: 80mm auto;
      margin: 0;
    }
  </style>
</head>
<body>
<div class="ticket">

  <!-- HEADER -->
  <div class="center xlarge">AGENTCORE</div>
  <div class="center small muted" style="margin-bottom:12px;">Sistema de Gestión · Salón</div>
  <hr class="solid"/>

  <!-- META -->
  <div class="row" style="margin:8px 0;">
    <span class="muted small">${dateStr} &nbsp; ${timeStr}</span>
    <span class="bold">${data.tableName.toUpperCase()}</span>
  </div>
  ${data.clientName ? `<div style="margin-bottom:8px;">Cliente: <span class="bold">${data.clientName}</span></div>` : ""}
  <hr class="dashed"/>

  <!-- ITEMS HEADER -->
  <div class="row small bold muted" style="margin-bottom:6px;">
    <span>CANT &nbsp; DESCRIPCIÓN</span>
    <span>IMPORTE</span>
  </div>
  <hr class="dashed"/>

  <!-- ITEMS -->
  ${data.items.map(item => `
  <div class="row-item">
    <span class="qty">${item.quantity}x</span>
    <span class="iname">${item.name}</span>
    <span class="iprice">${fmt(item.price * item.quantity)}</span>
  </div>
  ${item.quantity > 1 ? `<div class="sub">${fmt(item.price)} c/u</div>` : ""}
  `).join("")}

  <hr class="dashed"/>

  <!-- SUBTOTAL -->
  <div class="row muted" style="margin:6px 0;">
    <span>Subtotal</span>
    <span class="bold">${fmt(data.subtotal)}</span>
  </div>

  ${data.discount > 0 ? `
  <div class="row discount-row" style="margin-bottom:4px;">
    <span>Descuento (${data.discount}%)</span>
    <span>-${fmt(data.discountAmount)}</span>
  </div>` : ""}

  <hr class="solid"/>

  <!-- TOTAL -->
  <div class="total-block">
    <span class="total-label">TOTAL</span>
    <span class="total-value">${fmt(data.total)}</span>
  </div>

  <hr class="dashed"/>

  <!-- PAYMENT -->
  <div class="row" style="margin:8px 0;">
    <span class="muted">Forma de pago</span>
    <span class="bold">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</span>
  </div>

  <hr class="solid"/>

  <!-- FOOTER -->
  <div class="footer">
    <div style="font-size:16px; font-weight:bold; margin-bottom:4px;">¡Gracias por su visita!</div>
    <div class="small muted">agentcore-ia.com</div>
  </div>

  <div class="barcode">
    | || ||| || | || ||| ||| | |||<br/>
    <span style="font-size:11px; letter-spacing:0;">${now.getTime().toString().slice(-8)}</span>
  </div>

</div>

<script>
  window.onload = function() {
    window.print();
    setTimeout(function() { window.close(); }, 1000);
  };
</script>
</body>
</html>
`;

  const win = window.open("", "_blank", "width=560,height=700,toolbar=0,menubar=0,location=0,scrollbars=1");
  if (!win) {
    alert("Habilitá las ventanas emergentes para imprimir el ticket.");
    return;
  }
  win.document.write(htmlContent);
  win.document.close();
}
