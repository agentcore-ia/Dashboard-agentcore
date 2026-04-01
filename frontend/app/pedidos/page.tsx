"use client";

import { useState, useEffect } from "react";
import { Clock, Truck, CheckCircle, Package, MapPin, ChefHat, Volume2, VolumeX, RefreshCw, Phone, X, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type OrderStatus = "new" | "preparing" | "ready" | "delivering" | "delivered";

interface OrderItem { name: string; price: number; quantity: number; notes?: string; }
interface TranscriptionItem { role: string; mensaje: string; }
interface Order {
  id: string; order_number: number; status: OrderStatus;
  customer_name: string; customer_phone: string; delivery_type: string;
  payment_method: string; address: string; subtotal: number;
  delivery_fee: number; total: number; items: OrderItem[]; created_at: string;
  source?: string; transcription?: TranscriptionItem[] | null;
}

const COLUMNS: { key: OrderStatus; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { key: "new",       label: "Nuevos",      color: "#ef4444", bg: "#fef2f2", icon: <Clock className="w-4 h-4" /> },
  { key: "preparing", label: "Preparando",  color: "#f97316", bg: "#fff7ed", icon: <ChefHat className="w-4 h-4" /> },
  { key: "ready",     label: "Listos",      color: "#22c55e", bg: "#f0fdf4", icon: <CheckCircle className="w-4 h-4" /> },
  { key: "delivering",label: "En camino",   color: "#3b82f6", bg: "#eff6ff", icon: <Truck className="w-4 h-4" /> },
  { key: "delivered", label: "Entregados",  color: "#9ca3af", bg: "#f9fafb", icon: <Package className="w-4 h-4" /> },
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
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

function TranscriptionModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const transcript = order.transcription || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 flex flex-col" style={{ maxHeight: "80vh" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600"><Phone className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-sm text-stone-800">Transcripción de llamada</h3>
              <p className="text-xs text-stone-500">Pedido #{order.order_number} — {order.customer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: "60vh" }}>
          {transcript.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-8">No hay transcripción disponible</p>
          ) : (
            transcript.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${msg.role === 'assistant' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                  {msg.role === 'assistant' ? '🤖' : '👤'}
                </div>
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] ${msg.role === 'assistant' ? 'bg-stone-100 text-stone-700 rounded-tl-sm' : 'bg-orange-100 text-orange-800 rounded-tr-sm'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">{msg.role === 'assistant' ? 'Agente' : 'Cliente'}</p>
                  {msg.mensaje}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance, col }: { order: Order; onAdvance: (id: string, next: OrderStatus) => void; col: typeof COLUMNS[0] }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const nextStatus = STATUS_FLOW[order.status];
  const btnLabel = BTN_LABELS[order.status];
  const isCall = order.source === 'llamada' || order.customer_phone === 'llamada';

  return (
    <>
      {showTranscript && <TranscriptionModal order={order} onClose={() => setShowTranscript(false)} />}
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 mb-3 hover:shadow-md transition-shadow">
        {/* Badge row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-xs text-stone-700">#{order.order_number}</span>
            {order.delivery_type === "delivery" ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#eff6ff", color: "#3b82f6" }}>
                <Truck className="w-2.5 h-2.5 inline mr-0.5" />Delivery
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#f0fdf4", color: "#22c55e" }}>
                🏪 Retiro
              </span>
            )}
            {isCall && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-600 flex items-center gap-0.5"><Phone className="w-2 h-2" />Llamada</span>}
            {!isCall && order.source === 'instagram' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-pink-100 text-pink-600 flex items-center gap-0.5"><MessageSquare className="w-2 h-2" />IG</span>}
            {!isCall && (!order.source || order.source === 'whatsapp') && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-green-100 text-green-600 flex items-center gap-0.5"><MessageSquare className="w-2 h-2" />WA</span>}
          </div>
          {isCall && order.transcription && order.transcription.length > 0 && (
            <button onClick={() => setShowTranscript(true)} className="text-[10px] px-2 py-1 rounded-lg font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" />Ver
            </button>
          )}
        </div>

        <p className="text-[10px] text-stone-400 mb-1">{timeAgo(order.created_at)}</p>
        <p className="font-semibold text-sm text-stone-800 mb-3">{order.customer_name}</p>

        {/* Items */}
        {order.items.length > 0 && (
          <div className="bg-stone-50 rounded-lg p-2 mb-3 space-y-1">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-stone-600">
                <span>{item.quantity}x {item.name}</span>
                <span className="text-stone-400">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center mb-2 pt-2 border-t border-stone-100">
          <span className="text-xs text-stone-500">{PAYMENT_ICONS[order.payment_method] || "💳"} {PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
          <span className="font-bold text-sm text-stone-800">${order.total.toFixed(2)}</span>
        </div>

        {/* Address */}
        {order.delivery_type === "delivery" && order.address && (
          <div className="flex items-start gap-1 mb-3 text-[10px] text-stone-500">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{order.address}</span>
          </div>
        )}

        {/* CTA */}
        {btnLabel && nextStatus ? (
          <button
            onClick={() => onAdvance(order.id, nextStatus)}
            className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${col.color}, ${col.color}cc)` }}
          >
            {btnLabel}
          </button>
        ) : (
          <div className="w-full text-center text-[10px] py-2 rounded-lg bg-stone-100 text-stone-400 font-medium">
            ✅ Finalizado
          </div>
        )}
      </div>
    </>
  );
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select(`id, order_number, status, delivery_type, payment_method, address, subtotal, delivery_fee, total, notes, source, transcription, created_at, clientes(name, phone)`)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) { setLoading(false); return; }

    const transformed: Order[] = (data || []).map((o: any) => ({
      id: o.id, order_number: o.order_number, status: o.status,
      customer_name: o.clientes?.name || (o.source === 'llamada' ? 'Cliente llamada' : 'Cliente WhatsApp'),
      customer_phone: o.clientes?.phone || "",
      delivery_type: o.delivery_type, payment_method: o.payment_method,
      address: o.address || "No especificada",
      subtotal: Number(o.subtotal), delivery_fee: Number(o.delivery_fee), total: Number(o.total),
      items: o.notes ? [{ name: o.notes, price: Number(o.total) || 0, quantity: 1 }] : [],
      created_at: o.created_at, source: o.source || 'whatsapp', transcription: o.transcription || null,
    }));

    setOrders(transformed);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('realtime-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchOrders();
          if (sound) { new Audio('/notification.mp3').play().catch(() => {}); }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o));
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const advanceOrder = async (id: string, next: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
    const { error } = await supabase.from('pedidos').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) fetchOrders();
  };

  const byStatus = (status: OrderStatus) => orders.filter(o => o.status === status);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-orange-900 tracking-tight font-headline">Kitchen Board</h2>
          <p className="text-stone-500 font-medium text-sm mt-1">Gestión de pedidos en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(s => !s)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
          >
            {sound ? <Volume2 className="w-4 h-4 text-orange-500" /> : <VolumeX className="w-4 h-4 text-red-500" />}
            {sound ? "Sonido" : "Silencio"}
          </button>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-stone-200 hover:bg-stone-50 transition-colors text-stone-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max" style={{ minHeight: "calc(100vh - 260px)" }}>
          {COLUMNS.map(col => {
            const colOrders = byStatus(col.key);
            return (
              <div key={col.key} className="flex flex-col rounded-2xl overflow-hidden" style={{ width: "280px", background: col.bg, border: `1px solid ${col.color}22` }}>
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${col.color}22` }}>
                  <div className="p-1.5 rounded-lg" style={{ background: col.color + "22", color: col.color }}>
                    {col.icon}
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wider text-stone-700">{col.label}</span>
                  <span className="ml-auto text-xs font-black w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm" style={{ color: col.color }}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3">
                  {loading && colOrders.length === 0 ? (
                    <div className="space-y-3">
                      <div className="h-28 bg-white/60 rounded-xl animate-pulse" />
                      <div className="h-28 bg-white/60 rounded-xl animate-pulse" />
                    </div>
                  ) : colOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-30">
                      <Package className="w-8 h-8 mb-2 text-stone-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Sin pedidos</p>
                    </div>
                  ) : (
                    colOrders.map(order => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} col={col} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
