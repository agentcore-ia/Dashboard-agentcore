export interface TicketData {
  tableName: string;
  clientName?: string | null;
  orderNumber?: number | null;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;        // percentage, e.g. 10
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

function line(char = "-", len = 32) {
  return char.repeat(len);
}

function center(text: string, width = 32) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function cols(left: string, right: string, width = 32) {
  const gap = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(gap) + right;
}

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR");
}

export function printTicket(data: TicketData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket · ${data.tableName}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      padding: 6mm 4mm;
      background: #fff;
      color: #000;
      line-height: 1.5;
    }
    .center   { text-align: center; }
    .bold     { font-weight: bold; }
    .large    { font-size: 18px; font-weight: bold; }
    .xlarge   { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .divider  { border-top: 1px dashed #000; margin: 4px 0; }
    .divider-solid { border-top: 1px solid #000; margin: 4px 0; }
    .row      { display: flex; justify-content: space-between; }
    .row-item { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .qty      { min-width: 24px; }
    .item-name{ flex: 1; padding: 0 4px; }
    .item-price{ min-width: 60px; text-align: right; }
    .total-row{ display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; }
    .label-total { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .value-total { font-size: 22px; font-weight: 900; }
    .barcode  { text-align: center; margin-top: 8px; letter-spacing: 4px; font-size: 10px; }
    @media print {
      body { padding: 2mm 3mm; }
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="center bold large" style="margin-bottom:2px;">AGENTCORE</div>
  <div class="center" style="font-size:10px; margin-bottom:6px;">Sistema de Gestión · Salón</div>
  <div class="divider-solid"></div>

  <!-- META -->
  <div class="row" style="margin:4px 0;">
    <span>${dateStr}  ${timeStr}</span>
    <span class="bold">${data.tableName.toUpperCase()}</span>
  </div>
  ${data.clientName ? `<div style="margin-bottom:4px;">Cliente: <span class="bold">${data.clientName}</span></div>` : ""}
  ${data.orderNumber ? `<div style="margin-bottom:4px; font-size:10px;">Pedido #${data.orderNumber}</div>` : ""}
  <div class="divider"></div>

  <!-- ITEMS HEADER -->
  <div class="row bold" style="margin-bottom:3px; font-size:10px;">
    <span>CANT  DESCRIPCIÓN</span>
    <span>IMPORTE</span>
  </div>
  <div class="divider"></div>

  <!-- ITEMS -->
  ${data.items.map(item => `
  <div class="row-item">
    <span class="qty">${item.quantity}x</span>
    <span class="item-name">${item.name}</span>
    <span class="item-price">${fmt(item.price * item.quantity)}</span>
  </div>
  ${item.quantity > 1 ? `<div style="font-size:10px; padding-left:28px; color:#555;">${fmt(item.price)} c/u</div>` : ""}
  `).join("")}

  <div class="divider"></div>

  <!-- SUBTOTAL -->
  <div class="row" style="margin:3px 0;">
    <span>Subtotal</span>
    <span>${fmt(data.subtotal)}</span>
  </div>

  ${data.discount > 0 ? `
  <div class="row" style="margin:2px 0;">
    <span>Descuento (${data.discount}%)</span>
    <span>-${fmt(data.discountAmount)}</span>
  </div>
  ` : ""}

  <div class="divider-solid"></div>

  <!-- TOTAL -->
  <div class="total-row" style="margin:6px 0;">
    <span class="label-total">TOTAL</span>
    <span class="value-total">${fmt(data.total)}</span>
  </div>

  <div class="divider"></div>

  <!-- PAYMENT -->
  <div class="row" style="margin:4px 0;">
    <span>Forma de pago</span>
    <span class="bold">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</span>
  </div>

  <div class="divider-solid"></div>

  <!-- FOOTER -->
  <div class="center" style="margin-top:8px; font-size:11px;">¡Gracias por su visita!</div>
  <div class="center" style="font-size:10px; margin-top:2px; color:#555;">agentcore-ia.com</div>

  <div class="barcode" style="margin-top:10px;">
    | || ||| || | || ||| ||| | |||<br/>
    <span style="font-size:9px; letter-spacing:0;">${now.getTime().toString().slice(-8)}</span>
  </div>

  <div style="height:12mm;"></div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 800);
    };
  </script>
</body>
</html>
`;

  const win = window.open("", "_blank", "width=350,height=600,toolbar=0,menubar=0,location=0");
  if (!win) {
    alert("Habilitá las ventanas emergentes para imprimir el ticket.");
    return;
  }
  win.document.write(htmlContent);
  win.document.close();
}
