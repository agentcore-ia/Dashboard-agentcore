"use client";

import { useState, useEffect } from "react";
import { Clock, Truck, CheckCircle, Package, MapPin, CreditCard, ChefHat, Volume2, VolumeX, RefreshCw } from "lucide-react";

type OrderStatus = "new" | "preparing" | "ready" | "delivering" | "delivered";

interface OrderItem { name: string; price: number; quantity: number; notes?: string; }
interface Order {
  id: string; order_number: number; status: OrderStatus;
  customer_name: string; customer_phone: string; delivery_type: string;
  payment_method: string; address: string; subtotal: number;
  delivery_fee: number; total: number; items: OrderItem[]; created_at: string;
}

const INITIAL_ORDERS: Order[] = [
  {
    id: "00000000-0000-0000-0000-000000000030", order_number: 260043,
    status: "new", customer_name: "Pedro Machado", customer_phone: "+5511987654321",
    delivery_type: "delivery", payment_method: "card", address: "Av. Paulista, 1500, Apto 42",
    subtotal: 71.80, delivery_fee: 5.00, total: 76.80,
    items: [
      { name: "Beast Classic", price: 32.90, quantity: 1, notes: "Ao ponto" },
      { name: "Batata c/ Cheddar e Bacon - média", price: 29.90, quantity: 1 },
      { name: "Refri 600ml", price: 9.00, quantity: 1 },
    ],
    created_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  },
];

const COLUMNS: { key: OrderStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "new", label: "Nuevos", color: "#f87171", icon: <Clock className="w-4 h-4" /> },
  { key: "preparing", label: "Preparando", color: "#fb923c", icon: <ChefHat className="w-4 h-4" /> },
  { key: "ready", label: "Listos", color: "#4ade80", icon: <CheckCircle className="w-4 h-4" /> },
  { key: "delivering", label: "En camino", color: "#60a5fa", icon: <Truck className="w-4 h-4" /> },
  { key: "delivered", label: "Entregados", color: "#9ca3af", icon: <Package className="w-4 h-4" /> },
];

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  new: "preparing", preparing: "ready", ready: "delivering", delivering: "delivered", delivered: null,
};

const BTN_LABELS: Record<OrderStatus, string | null> = {
  new: "Confirmar y Preparar", preparing: "Marcar como Listo", ready: "Marcar como Enviado", delivering: "Marcar como Entregado", delivered: null,
};

const PAYMENT_ICONS: Record<string, string> = { card: "💳", cash: "💵", pix: "📲", transfer: "🏦" };
const PAYMENT_LABELS: Record<string, string> = { card: "Tarjeta", cash: "Efectivo", pix: "Pix", transfer: "Transferencia" };

function timeAgo(date: string) {
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (id: string, next: OrderStatus) => void }) {
  const nextStatus = STATUS_FLOW[order.status];
  const btnLabel = BTN_LABELS[order.status];

  return (
    <div className="glass-card p-4 fade-in mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full pulse" style={{ background: order.status === "new" ? "#f87171" : "#4ade80" }} />
          <span className="font-bold text-sm">PEDIDO #{order.order_number}</span>
          {order.delivery_type === "delivery" ? (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
              <Truck className="w-3 h-3 inline mr-1" />DELIVERY
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              🏪 RETIRADA
            </span>
          )}
        </div>
      </div>
      <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{timeAgo(order.created_at)}</p>
      <p className="font-semibold text-sm mb-3">{order.customer_name}</p>

      {/* Items */}
      <div className="space-y-1 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span style={{ color: "rgba(255,255,255,0.7)" }}>
              {item.quantity}x {item.name}
              {item.notes && <span className="block text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Obs: {item.notes}</span>}
            </span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div
        className="pt-2 mb-3 space-y-1 text-xs"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span>Subtotal:</span><span>R$ {order.subtotal.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="flex justify-between" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span>Tasa de entrega:</span><span>R$ {order.delivery_fee.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span style={{ color: "#4ade80" }}>R$ {order.total.toFixed(2).replace(".", ",")}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        <span>{PAYMENT_ICONS[order.payment_method] || "💳"}</span>
        <span>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
      </div>

      {/* Address */}
      {order.delivery_type === "delivery" && (
        <div className="flex items-start gap-1.5 mb-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{order.address}</span>
        </div>
      )}

      {/* CTA */}
      {btnLabel && nextStatus && (
        <button
          onClick={() => onAdvance(order.id, nextStatus)}
          className="w-full btn-primary text-sm py-2 rounded-lg"
        >
          {btnLabel}
        </button>
      )}
      {!btnLabel && (
        <div className="w-full text-center text-xs py-2 rounded-lg" style={{ background: "rgba(107,114,128,0.15)", color: "#9ca3af" }}>
          ✅ Pedido Finalizado
        </div>
      )}

      <button className="w-full text-xs mt-2 py-1.5 rounded-lg flex items-center justify-center gap-1" style={{ color: "rgba(255,255,255,0.25)" }}>
        🖨 Imprimir (Próximamente)
      </button>
    </div>
  );
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [sound, setSound] = useState(true);

  const advanceOrder = (id: string, next: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
  };

  const byStatus = (status: OrderStatus) => orders.filter(o => o.status === status);

  return (
    <div className="p-6 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}>
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Pedidos de la Cocina</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Gestione sus pedidos en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSound(s => !s)} className="btn-ghost flex items-center gap-1.5 text-xs">
            {sound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Sonido {sound ? "ON" : "OFF"}
          </button>
          <button className="btn-ghost text-xs flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Próximamente
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-full" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {COLUMNS.map(col => {
          const colOrders = byStatus(col.key);
          return (
            <div key={col.key} className="kanban-col flex-shrink-0 w-72 flex flex-col">
              {/* Column header */}
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-t-xl"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span style={{ color: col.color }}>{col.icon}</span>
                <span className="font-semibold text-sm">{col.label}</span>
                <span
                  className="ml-auto text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: `${col.color}22`, color: col.color }}
                >
                  {colOrders.length}
                </span>
              </div>
              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3">
                {colOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Sin pedidos
                  </div>
                ) : (
                  colOrders.map(order => (
                    <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
