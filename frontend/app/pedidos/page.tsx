"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

type OrderStatus = "new" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";

interface OrderItem { name: string; price: number; quantity: number; notes?: string; }
interface Order {
  id: string; order_number: number; status: OrderStatus;
  customer_name: string; customer_phone: string; delivery_type: string;
  payment_method: string; address: string; subtotal: number;
  delivery_fee: number; total: number; items: OrderItem[]; created_at: string;
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  new: "preparing", preparing: "ready", ready: "delivering", delivering: "delivered", delivered: null, cancelled: null,
};

function timeAgoObj(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const m = Math.floor(diff / 60000);
  return { minutes: m, isLate: m > 15 };
}

function isPickup(order: Order) {
  return order.delivery_type === "pickup" || order.address === "Retiro en local";
}

// ─── Thermal Ticket Printer ───────────────────────────────────────────────────
function printComanda(order: Order) {
  const pickup = isPickup(order);
  const time = new Date(order.created_at).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit",
  });
  const date = new Date(order.created_at).toLocaleDateString("es-AR");

  const itemsHtml = order.items.length > 0
    ? order.items.map((item) => `
        <tr>
          <td style="padding:3px 0;font-size:13px;">${item.quantity}x ${item.name}</td>
          <td style="padding:3px 0;font-size:13px;text-align:right;">${item.price > 0 ? "$" + item.price.toFixed(2) : ""}</td>
        </tr>
        ${item.notes ? `<tr><td colspan="2" style="font-size:11px;color:#555;padding-bottom:4px;">  ↳ ${item.notes}</td></tr>` : ""}
      `).join("")
    : `<tr><td colspan="2" style="font-size:12px;color:#555;">Sin detalle de items</td></tr>`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    @page { size: 80mm auto; margin: 4mm 2mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      width: 76mm;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .logo { font-size: 20px; font-weight: 900; letter-spacing: 2px; margin-bottom: 2px; }
    .subtitle { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #444; margin-bottom: 6px; }
    .badge {
      display: inline-block;
      border: 2px solid #000;
      padding: 2px 10px;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 4px 0;
    }
    .order-num { font-size: 28px; font-weight: 900; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-size: 15px; font-weight: 900; padding-top: 6px; }
    .footer { font-size: 10px; color: #555; margin-top: 4px; }
    .alert { font-size: 11px; font-weight: bold; background: #000; color: #fff; padding: 3px 6px; margin: 4px 0; display: inline-block; }
  </style>
</head>
<body>
  <div class="center">
    <div class="logo">AgentCore</div>
    <div class="subtitle">Sistema de Pedidos</div>
  </div>

  <div class="divider"></div>

  <div class="center">
    <div class="badge">${pickup ? "RETIRO EN LOCAL" : "DELIVERY"}</div>
    <div class="order-num">#${String(order.order_number).padStart(3, "0")}</div>
    <div style="font-size:11px;color:#444;">${date} — ${time}</div>
  </div>

  <div class="divider"></div>

  <table>
    <tr>
      <td style="font-size:11px;color:#555;padding-bottom:2px;">CLIENTE</td>
    </tr>
    <tr>
      <td class="bold" style="font-size:14px;">${order.customer_name}</td>
      ${order.customer_phone ? `<td style="font-size:11px;text-align:right;color:#444;">${order.customer_phone}</td>` : ""}
    </tr>
    ${!pickup && order.address ? `
    <tr>
      <td colspan="2" style="font-size:11px;color:#444;padding-top:2px;">📍 ${order.address}</td>
    </tr>` : ""}
  </table>

  <div class="divider"></div>

  <table>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="divider"></div>

  <table>
    ${order.subtotal > 0 ? `
    <tr>
      <td style="font-size:12px;">Subtotal</td>
      <td style="font-size:12px;text-align:right;">$${order.subtotal.toFixed(2)}</td>
    </tr>` : ""}
    ${order.delivery_fee > 0 ? `
    <tr>
      <td style="font-size:12px;">Envío</td>
      <td style="font-size:12px;text-align:right;">$${order.delivery_fee.toFixed(2)}</td>
    </tr>` : ""}
    <tr class="total-row">
      <td>TOTAL</td>
      <td style="text-align:right;">$${order.total.toFixed(2)}</td>
    </tr>
    ${order.payment_method ? `
    <tr>
      <td colspan="2" style="font-size:11px;color:#555;padding-top:3px;">Pago: ${order.payment_method}</td>
    </tr>` : ""}
  </table>

  <div class="divider"></div>

  <div class="center footer">
    ${order.items.some((i) => i.notes) ? `<div class="alert">⚠ VER NOTAS ESPECIALES</div><br/>` : ""}
    Gracias por tu pedido ✦ AgentCore
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=350,height=600");
  if (!win) { alert("Permitir ventanas emergentes para imprimir"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── WhatsApp Notify ──────────────────────────────────────────────────────────
async function notifyCustomer(order: Order): Promise<{ ok: boolean; error?: string }> {
  const pickup = isPickup(order);
  const message = pickup
    ? `🎉 ¡Hola ${order.customer_name}! Tu pedido *#${String(order.order_number).padStart(3, "0")}* ya está *listo para retirar* en el local. ¡Te esperamos! 🍽️`
    : `🚀 ¡Hola ${order.customer_name}! Tu pedido *#${String(order.order_number).padStart(3, "0")}* ya salió y está en camino. ¡Que lo disfrutes! 🍽️`;

  try {
    const res = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: order.customer_phone, message }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "Error desconocido" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance: (id: string, next: OrderStatus) => void;
}) {
  const nextStatus = STATUS_FLOW[order.status];
  const pickup = isPickup(order);
  const time = timeAgoObj(order.created_at);

  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  let borderColor = "";
  let badgeClass = "";
  let badgeText = "";
  let btnClass = "";
  let btnLabel = "";

  if (order.status === "new") {
    borderColor = time.isLate ? "border-red-500" : "border-orange-400";
    badgeClass = time.isLate ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500";
    badgeText = `${time.minutes}m espera`;
    btnClass = "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20";
    btnLabel = "Empezar a cocinar";
  } else if (order.status === "preparing") {
    borderColor = "border-primary";
    badgeClass = "text-stone-400 bg-transparent";
    badgeText = `${time.minutes}m en cocina`;
    btnClass = "bg-primary hover:bg-primary-container text-white shadow-primary/20";
    btnLabel = "Marcar como Listo";
  } else if (order.status === "ready") {
    borderColor = "border-green-500";
    badgeClass = "text-green-500 bg-green-50 px-2 rounded-md";
    badgeText = "Listo";
    btnClass = "bg-green-600 hover:bg-green-700 text-white shadow-green-600/20";
    btnLabel = pickup ? "Entregar a Cliente" : "Despachar a Envío";
  }

  const handleNotify = async () => {
    if (!order.customer_phone) return;
    setNotifying(true);
    setNotifyError(null);
    const result = await notifyCustomer(order);
    setNotifying(false);
    if (result.ok) {
      setNotified(true);
    } else {
      setNotifyError(result.error || "Error al enviar");
    }
  };

  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border-l-4 ${borderColor} flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2`}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-headline font-bold text-on-surface">{order.customer_name}</h4>
          <div className="flex items-center gap-1.5 text-stone-400 mt-1">
            <span className="material-symbols-outlined text-sm">
              {order.customer_phone ? "chat" : "storefront"}
            </span>
            <span className="text-xs font-semibold flex items-center gap-2">
              {pickup ? "Retiro" : "Delivery"} • {order.customer_phone ? "WhatsApp" : "Local"} •
              #{order.order_number}
              {order.customer_phone && (
                <a
                  href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                  title="Abrir chat en WhatsApp"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                </a>
              )}
            </span>
          </div>
        </div>

        {order.status === "ready" ? (
          <span className="material-symbols-outlined text-green-500">check_circle</span>
        ) : order.status === "preparing" && time.minutes < 5 ? (
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-primary animate-spin">
              progress_activity
            </span>
            <span className="text-xs font-black text-primary">Precocinando</span>
          </div>
        ) : (
          <span className={`text-xs font-black px-2 py-1 rounded-md ${badgeClass}`}>
            {badgeText}
          </span>
        )}
      </div>

      {/* Address */}
      {!pickup && order.address && (
        <div className="text-xs text-stone-500 bg-stone-100 p-2 rounded-lg border border-stone-200 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[14px]">location_on</span>
          <span className="font-medium">{order.address}</span>
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        <ul className="text-sm font-medium text-stone-600 list-none space-y-1">
          {order.items.length > 0 ? (
            order.items.map((item, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {item.quantity}x {item.name}
                </span>
              </li>
            ))
          ) : (
            <li className="italic opacity-50 text-xs">Sin detalles de items</li>
          )}
        </ul>
        {order.items.some((i) => i.notes) && (
          <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
            <p className="text-[11px] font-bold text-orange-800 uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">priority_high</span>
              {order.items.map((i) => i.notes).filter(Boolean).join(" | ")}
            </p>
          </div>
        )}
      </div>

      {/* Footer: price + action buttons */}
      <div className="flex flex-col gap-2 border-t border-stone-100 pt-3 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-lg font-black font-headline text-stone-800">
            ${order.total.toLocaleString("es-AR")}
          </span>
          <div className="flex items-center gap-2">
            {/* 🖨️ Print button — always visible */}
            <button
              onClick={() => printComanda(order)}
              title="Imprimir comanda"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* ▶ Advance status button */}
            {nextStatus && (
              <button
                onClick={() => onAdvance(order.id, nextStatus)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${btnClass}`}
              >
                {btnLabel}
              </button>
            )}
          </div>
        </div>

        {/* 📲 Notify customer — only when order is ready AND has a phone */}
        {order.status === "ready" && order.customer_phone && (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleNotify}
              disabled={notifying || notified}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                notified
                  ? "bg-green-100 text-green-700 cursor-default"
                  : notifying
                  ? "bg-blue-50 text-blue-500 cursor-wait"
                  : "bg-green-600 hover:bg-green-700 text-white shadow-green-600/20 shadow-md"
              }`}
            >
              {notified ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Cliente notificado por WhatsApp
                </>
              ) : notifying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-blue-400/40 border-t-blue-500 rounded-full animate-spin" />
                  Enviando mensaje...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  {pickup ? "Avisar: Listo para retirar" : "Avisar: Pedido en camino"}
                </>
              )}
            </button>
            {notifyError && (
              <p className="text-[11px] text-red-500 text-center font-medium">
                ⚠ {notifyError} — verificá la conexión con Evolution API
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        `id, order_number, status, delivery_type, payment_method, address, subtotal, delivery_fee, total, notes, created_at, customer_name, customer_phone, clientes(name, phone)`
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) { console.error("Error fetching orders:", error); setLoading(false); return; }

    const transformed: Order[] = (data || []).map((o: any) => ({
      id: o.id, order_number: o.order_number, status: o.status,
      customer_name: o.customer_name || o.clientes?.name || "Cliente",
      customer_phone: o.customer_phone || o.clientes?.phone || "",
      delivery_type: o.delivery_type, payment_method: o.payment_method,
      address: o.address || "", subtotal: Number(o.subtotal),
      delivery_fee: Number(o.delivery_fee), total: Number(o.total),
      items: o.notes ? [{ name: o.notes, price: 0, quantity: 1 }] : [],
      created_at: o.created_at,
    }));

    setOrders(transformed);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("realtime-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, (payload) => {
        if (payload.eventType === "INSERT") { fetchOrders(); }
        else if (payload.eventType === "UPDATE") {
          const updated = payload.new as any;
          setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, status: updated.status } : o));
        } else if (payload.eventType === "DELETE") {
          setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const advanceOrder = async (id: string, next: OrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: next } : o));
    await supabase.from("pedidos").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const byStatus = (status: OrderStatus) => orders.filter((o) => o.status === status);
  const news = byStatus("new");
  const preparing = byStatus("preparing");
  const ready = byStatus("ready");

  return (
    <div className="flex-1 w-full bg-surface text-on-surface overflow-hidden flex flex-col pt-6 lg:pt-8 px-4 md:px-10 pb-6">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl lg:text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">
            Comandero Digital
          </h2>
          <p className="text-sm lg:text-lg text-stone-500 font-medium">
            Visualización de flujo de cocina en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-2xl w-full md:w-auto overflow-x-auto">
          <div className="px-4 lg:px-6 py-2 bg-white rounded-xl shadow-sm border border-stone-100 text-center min-w-24">
            <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Nuevos</span>
            <span className="text-xl lg:text-2xl font-black text-orange-600">{news.length.toString().padStart(2, "0")}</span>
          </div>
          <div className="px-4 lg:px-6 py-2 bg-white rounded-xl shadow-sm border border-stone-100 text-center min-w-24">
            <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">En Cocina</span>
            <span className="text-xl lg:text-2xl font-black text-primary">{preparing.length.toString().padStart(2, "0")}</span>
          </div>
          <div className="px-4 lg:px-6 py-2 bg-white rounded-xl shadow-sm border border-stone-100 text-center min-w-24">
            <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Listos</span>
            <span className="text-xl lg:text-2xl font-black text-green-600">{ready.length.toString().padStart(2, "0")}</span>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <section className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        {/* NUEVOS */}
        <div className="flex flex-col gap-4 bg-stone-100/50 rounded-3xl p-4 border border-stone-200/50 overflow-hidden h-full">
          <div className="flex items-center justify-between px-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
              <h3 className="font-headline font-bold text-lg text-stone-700 uppercase tracking-tight">Nuevos</h3>
            </div>
            <span className="bg-orange-100 text-orange-700 text-xs font-black px-2 py-1 rounded-lg">{news.length} Pedidos</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-4">
            {news.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center p-10 text-stone-400 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                <span className="text-xs uppercase font-bold tracking-widest">Sin Nuevos</span>
              </div>
            )}
            {news.map((order) => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />)}
          </div>
        </div>

        {/* EN PREPARACIÓN */}
        <div className="flex flex-col gap-4 bg-stone-100/50 rounded-3xl p-4 border border-stone-200/50 overflow-hidden h-full">
          <div className="flex items-center justify-between px-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <h3 className="font-headline font-bold text-lg text-stone-700 uppercase tracking-tight">En Preparación</h3>
            </div>
            <span className="bg-primary/10 text-primary text-xs font-black px-2 py-1 rounded-lg">{preparing.length} Pedidos</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-4">
            {preparing.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center p-10 text-stone-400 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2">blender</span>
                <span className="text-xs uppercase font-bold tracking-widest">Cocina Libre</span>
              </div>
            )}
            {preparing.map((order) => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />)}
          </div>
        </div>

        {/* LISTOS */}
        <div className="flex flex-col gap-4 bg-stone-100/50 rounded-3xl p-4 border border-stone-200/50 overflow-hidden h-full">
          <div className="flex items-center justify-between px-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="font-headline font-bold text-lg text-stone-700 uppercase tracking-tight">Listos</h3>
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-1 rounded-lg">{ready.length} Pedidos</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-4">
            {ready.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center p-10 text-stone-400 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2">takeout_dining</span>
                <span className="text-xs uppercase font-bold tracking-widest">Vacío</span>
              </div>
            )}
            {ready.map((order) => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />)}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mt-6 flex shrink-0 w-full overflow-hidden">
        <div className="w-full bg-surface-container border border-surface-variant rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-stone-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">bolt</span>
            </div>
            <div>
              <h4 className="text-lg font-headline font-bold text-on-surface">Modo Alta Demanda</h4>
              <p className="text-stone-500 text-sm max-w-sm">Optimiza la preparación agrupando platos idénticos de diferentes pedidos de manera automática.</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-surface-container-lowest border border-stone-200 text-stone-700 rounded-xl font-bold hover:bg-white hover:text-primary transition-all shadow-sm">
            Activar pronto
          </button>
        </div>
      </section>

      {/* Map Contextual Indicator */}
      <div className="hidden lg:flex fixed bottom-6 right-6 items-center gap-3 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-stone-200 z-40">
        <div className="w-10 h-10 rounded-xl overflow-hidden grayscale bg-surface-container animate-pulse flex items-center justify-center">
          <span className="material-symbols-outlined text-stone-400">map</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-stone-400 uppercase leading-none mb-1">Sucursal Centro</span>
          <span className="text-xs font-bold text-stone-700">Abierto • Alta demanda</span>
        </div>
      </div>
    </div>
  );
}
