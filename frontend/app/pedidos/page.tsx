"use client";

import { useState, useEffect } from "react";
import { Clock, Truck, CheckCircle, Package, MapPin, CreditCard, ChefHat, Volume2, VolumeX, RefreshCw, Phone, X, MessageSquare } from "lucide-react";
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
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  return `hace ${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

function TranscriptionModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const transcript = order.transcription || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 p-6" style={{ background: '#111827', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Transcripción de llamada</h3>
              <p className="text-xs text-white/40">Pedido #{order.order_number} — {order.customer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: '60vh' }}>
          {transcript.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">No hay transcripción disponible</p>
          ) : (
            transcript.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  msg.role === 'assistant' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {msg.role === 'assistant' ? '🤖' : '👤'}
                </div>
                <div className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] ${
                  msg.role === 'assistant'
                    ? 'bg-white/5 text-white/80 rounded-tl-sm'
                    : 'bg-orange-500/15 text-orange-100 rounded-tr-sm'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">
                    {msg.role === 'assistant' ? 'Agente' : 'Cliente'}
                  </p>
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

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (id: string, next: OrderStatus) => void }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const nextStatus = STATUS_FLOW[order.status];
  const btnLabel = BTN_LABELS[order.status];
  const isCall = order.source === 'llamada' || order.customer_phone === 'llamada';

  return (
    <>
      {showTranscript && <TranscriptionModal order={order} onClose={() => setShowTranscript(false)} />}
      <div className="glass-card p-4 fade-in mb-3 backdrop-blur-md rounded-xl border border-white/10 bg-white/5" style={{ minWidth: "260px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full pulse" style={{ background: order.status === "new" ? "#f87171" : "#4ade80" }} />
          <span className="font-bold text-sm">PEDIDO #{order.order_number}</span>
          {order.delivery_type === "delivery" ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
              <Truck className="w-3 h-3 inline mr-1" />DELIVERY
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              🏪 RETIRADA
            </span>
          )}
          {isCall && (
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight flex items-center gap-1" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
              <Phone className="w-2.5 h-2.5" />LLAMADA
            </span>
          )}
          {!isCall && order.source === 'instagram' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight flex items-center gap-1" style={{ background: "rgba(236,72,153,0.15)", color: "#f472b6" }}>
              <MessageSquare className="w-2.5 h-2.5" />INSTAGRAM
            </span>
          )}
          {!isCall && order.source === 'whatsapp' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tight flex items-center gap-1" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              <MessageSquare className="w-2.5 h-2.5" />WHATSAPP
            </span>
          )}
        </div>
        {isCall && order.transcription && order.transcription.length > 0 && (
          <button
            onClick={() => setShowTranscript(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wide transition-all hover:opacity-80"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <MessageSquare className="w-3 h-3" />
            Ver llamada
          </button>
        )}
      </div>
      <p className="text-[10px] mb-1 opacity-40">{timeAgo(order.created_at)}</p>
      <p className="font-semibold text-sm mb-3 text-white/90">{order.customer_name}</p>

      {/* Items/Notes */}
      <div className="space-y-1 mb-3">
        <div className="text-xs text-white/70 italic border-l-2 border-orange-500/50 pl-2 py-1 bg-white/5 rounded">
          {order.items.length > 0 ? (
            order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-0.5">
                <span>{item.quantity}x {item.name}</span>
                <span className="text-[10px] opacity-50">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))
          ) : (
            <span className="block whitespace-pre-wrap">{order.address === 'notes' ? order.address : (order.items.length === 0 ? "Sin detalles específicos" : "")}</span>
          )}
        </div>
      </div>

      {/* Display as single string if notes exist */}
      {!order.items.length && (
         <div className="text-xs text-white/60 mb-3 whitespace-pre-wrap bg-white/5 p-2 rounded">
            <strong>Pedido:</strong> {order.address.includes('notes') ? '' : order.id} {/* Logic for empty notes */}
            {/* Find notes specifically if they were passed into address by accident or just notes column */}
         </div>
      )}

      {/* Totals removed for simplicity in manual flow but can be added back if needed */}
      <div className="flex justify-between font-bold text-sm mb-3 pt-3 border-t border-white/5">
          <span className="text-white/40">TOTAL:</span>
          <span className="text-green-400 font-mono">${order.total.toFixed(2)}</span>
      </div>

      {/* Payment */}
      <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase font-bold tracking-tighter opacity-50">
        <span>{PAYMENT_ICONS[order.payment_method] || "💳"}</span>
        <span>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
      </div>

      {/* Address */}
      {order.delivery_type === "delivery" && order.address && (
        <div className="flex items-start gap-1.5 mb-4 text-xs opacity-60">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{order.address}</span>
        </div>
      )}

      {/* CTA */}
      {btnLabel && nextStatus && (
        <button
          onClick={() => onAdvance(order.id, nextStatus)}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white text-sm font-bold py-2 rounded-lg transition-all shadow-lg shadow-orange-500/20"
        >
          {btnLabel}
        </button>
      )}
      {!btnLabel && (
        <div className="w-full text-center text-[10px] py-2 rounded-lg bg-white/5 text-white/40 border border-white/5">
          ✅ Pedido Finalizado
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
      .select(`
        id, 
        order_number, 
        status, 
        delivery_type, 
        payment_method, 
        address, 
        subtotal, 
        delivery_fee, 
        total, 
        notes,
        source,
        transcription,
        created_at,
        clientes(name, phone)
      `)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
      return;
    }

    const transformed: Order[] = (data || []).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      customer_name: o.clientes?.name || o.customer_name || (o.source === 'llamada' ? 'Cliente llamada' : 'Cliente WhatsApp'),
      customer_phone: o.clientes?.phone || o.customer_phone || "",
      delivery_type: o.delivery_type,
      payment_method: o.payment_method,
      address: o.address || "No especificada",
      subtotal: Number(o.subtotal),
      delivery_fee: Number(o.delivery_fee),
      total: Number(o.total),
      items: o.notes ? [{ name: o.notes, price: Number(o.total) || 0, quantity: 1 }] : [],
      created_at: o.created_at,
      source: o.source || 'whatsapp',
      transcription: o.transcription || null,
    }));

    setOrders(transformed);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Realtime subscription
    const channel = supabase
      .channel('realtime-pedidos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchOrders(); // Refresh all to get joined clients
            if (sound) {
                const audio = new Audio('/notification.mp3');
                audio.play().catch(() => {});
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o));
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const advanceOrder = async (id: string, next: OrderStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));

    const { error } = await supabase
      .from('pedidos')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating order status:', error);
      // Revert if error
      fetchOrders();
    }
  };

  const byStatus = (status: OrderStatus) => orders.filter(o => o.status === status);

  return (
    <div className="page-fullscreen" style={{ background: "rgb(8,8,14)", minHeight: "calc(100vh - 56px)" }}>
    <div className="p-6 h-full overflow-hidden flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600 shadow-xl shadow-orange-500/20">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tight">KITCHEN BOARD</h1>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Gestión de pedidos en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setSound(s => !s)} className="btn-ghost flex items-center gap-2 text-xs font-bold uppercase transition-all hover:bg-white/5 px-4 py-2 rounded-xl">
            {sound ? <Volume2 className="w-4 h-4 text-orange-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
            Sonido {sound ? "ACTIVO" : "SILENCIO"}
          </button>
          <button onClick={fetchOrders} className="btn-ghost flex items-center gap-2 text-xs font-bold uppercase transition-all hover:bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
          </button>
        </div>
      </div>

      {/* Kanban Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-6 h-full min-w-max">
            {COLUMNS.map(col => {
              const colOrders = byStatus(col.key);
              return (
                <div key={col.key} className="flex flex-col w-72 h-full rounded-2xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                  {/* Column header */}
                  <div
                    className="flex items-center gap-3 px-4 py-4 bg-white/[0.03]"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="p-2 rounded-lg" style={{ background: `${col.color}22`, color: col.color }}>
                      {col.icon}
                    </div>
                    <span className="font-bold text-xs uppercase tracking-widest">{col.label}</span>
                    <span
                      className="ml-auto text-xs font-black w-6 h-6 rounded-full flex items-center justify-center bg-white/10"
                      style={{ color: col.color }}
                    >
                      {colOrders.length}
                    </span>
                  </div>
                  {/* Cards container */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading && colOrders.length === 0 ? (
                       <div className="animate-pulse space-y-3">
                          <div className="h-32 bg-white/5 rounded-xl" />
                          <div className="h-32 bg-white/5 rounded-xl" />
                       </div>
                    ) : colOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-10 py-20 grayscale">
                        <Package className="w-12 h-12 mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Sin Pedidos</p>
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

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
    </div>
  );
}
