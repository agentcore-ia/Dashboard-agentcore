"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type OrderStatus = "new" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";

interface TranscriptionItem { role: string; mensaje: string; }
interface OrderItem { name: string; price: number; quantity: number; notes?: string; }
interface Order {
  id: string; order_number: number; status: OrderStatus;
  customer_name: string; customer_phone: string; delivery_type: string;
  payment_method: string; address: string; subtotal: number;
  delivery_fee: number; total: number; items: OrderItem[]; created_at: string;
  source?: string; transcription?: TranscriptionItem[] | null;
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
  return order.delivery_type === 'pickup' || order.address === 'Retiro en local';
}

function TranscriptionModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const transcript = order.transcription || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-xl rounded-2xl border border-stone-200 p-6 bg-white shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <span className="material-symbols-outlined">phone_in_talk</span>
            <div>
              <h3 className="font-bold text-sm text-stone-800">Transcripción de llamada</h3>
              <p className="text-xs text-stone-500">Pedido #{order.order_number} — {order.customer_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors text-stone-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {transcript.length === 0 ? (
            <p className="text-stone-400 text-sm py-4 italic line-clamp-3">No hay transcripción guardada.</p>
          ) : (
            transcript.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'agent' ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  msg.role === 'agent' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {msg.role === 'agent' ? '🤖' : '👤'}
                </div>
                <div className={`rounded-2xl px-4 py-2 text-sm max-w-[80%] shadow-sm ${
                  msg.role === 'agent'
                    ? 'bg-stone-50 text-stone-700 border border-stone-100 rounded-tl-sm'
                    : 'bg-orange-600 text-white rounded-tr-sm'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-60">
                    {msg.role === 'agent' ? 'Agente AI' : 'Cliente'}
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
  const pickup = isPickup(order);
  const time = timeAgoObj(order.created_at);
  const isCall = order.source === 'llamada';

  // Card styles by status
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

  return (
    <>
    {showTranscript && <TranscriptionModal order={order} onClose={() => setShowTranscript(false)} />}
    <div className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border-l-4 ${borderColor} flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2`}>
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-headline font-bold text-on-surface">{order.customer_name}</h4>
          <div className="flex items-center gap-1.5 text-stone-400 mt-1">
            <span className="material-symbols-outlined text-sm">{isCall ? 'call' : (order.customer_phone ? 'chat' : 'storefront')}</span>
            <span className="text-xs font-semibold flex items-center gap-2">
              {pickup ? 'Retiro' : 'Delivery'} • {isCall ? 'Llamada' : (order.customer_phone ? 'WhatsApp' : 'Local')} • #{order.order_number}
              {!isCall && order.customer_phone && (
                <a 
                  href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                  title="Enviar WhatsApp"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                </a>
              )}
            </span>
          </div>
          {isCall && order.transcription && order.transcription.length > 0 && (
             <button
               onClick={() => setShowTranscript(true)}
               className="mt-2 flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors border border-indigo-100"
             >
               <span className="material-symbols-outlined text-[14px]">transcribe</span>
               Ver llamada
             </button>
          )}
        </div>
        
        {order.status === "ready" ? (
          <span className="material-symbols-outlined text-green-500">check_circle</span>
        ) : order.status === "preparing" && time.minutes < 5 ? (
          <div className="flex items-center gap-1">
             <span className="material-symbols-outlined text-sm text-primary animate-spin">progress_activity</span>
             <span className="text-xs font-black text-primary">Precocinando</span>
          </div>
        ) : (
          <span className={`text-xs font-black px-2 py-1 rounded-md ${badgeClass}`}>{badgeText}</span>
        )}
      </div>

      {!pickup && order.address && (
        <div className="text-xs text-stone-500 bg-stone-100 p-2 rounded-lg border border-stone-200 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[14px]">location_on</span>
          <span className="font-medium">{order.address}</span>
        </div>
      )}

      <div className="space-y-2">
        <ul className="text-sm font-medium text-stone-600 list-none space-y-1">
          {order.items.length > 0 ? (
            order.items.map((item, i) => (
              <li key={i} className="flex justify-between">
                <span>{item.quantity}x {item.name}</span>
              </li>
            ))
          ) : (
            <li className="italic opacity-50 text-xs">Sin detalles de items</li>
          )}
        </ul>
        
        {/* Mock for order notes, if any existed on order level we'd show them here */}
        {order.items.some(i => i.notes) && (
          <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
            <p className="text-[11px] font-bold text-orange-800 uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">priority_high</span>
              {order.items.map(i => i.notes).filter(Boolean).join(" | ")}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-stone-100 pt-3 mt-1">
        <span className="text-lg font-black font-headline text-stone-800">${order.total.toLocaleString('es-AR')}</span>
        {nextStatus && (
          <button 
             onClick={() => onAdvance(order.id, nextStatus)}
             className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${btnClass}`}
          >
            {btnLabel}
          </button>
        )}
      </div>
    </div>
    </>
  );
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id, order_number, status, delivery_type, payment_method, address, subtotal, delivery_fee, total, notes, created_at, customer_name, customer_phone, source, transcription,
        clientes(name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
      return;
    }

    const transformed: Order[] = (data || []).map((o: any) => ({
      id: o.id, order_number: o.order_number, status: o.status,
      customer_name: o.customer_name || o.clientes?.name || "Cliente", 
      customer_phone: o.customer_phone || o.clientes?.phone || "",
      delivery_type: o.delivery_type, payment_method: o.payment_method, address: o.address || "",
      subtotal: Number(o.subtotal), delivery_fee: Number(o.delivery_fee), total: Number(o.total),
      items: o.notes ? [{ name: o.notes, price: 0, quantity: 1 }] : [],
      created_at: o.created_at,
      source: o.source, transcription: o.transcription,
    }));

    setOrders(transformed);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('realtime-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
          if (payload.eventType === 'INSERT') { fetchOrders(); } 
          else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o));
          } 
          else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const advanceOrder = async (id: string, next: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: next } : o));
    await supabase.from('pedidos').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const byStatus = (status: OrderStatus) => orders.filter(o => o.status === status);

  const news = byStatus("new");
  const preparing = byStatus("preparing");
  const ready = byStatus("ready");

  return (
    <div className="flex-1 w-full bg-surface text-on-surface overflow-hidden flex flex-col pt-6 lg:pt-8 px-4 md:px-10 pb-6">
      {/* Hero Header Area */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl lg:text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Comandero Digital</h2>
          <p className="text-sm lg:text-lg text-stone-500 font-medium">Visualización de flujo de cocina en tiempo real.</p>
        </div>
        {/* Quick Summary Dashboard */}
        <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-2xl w-full md:w-auto overflow-x-auto">
          <div className="px-4 lg:px-6 py-2 bg-white rounded-xl shadow-sm border border-stone-100 text-center min-w-24">
            <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Nuevos</span>
            <span className="text-xl lg:text-2xl font-black text-orange-600">{news.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="px-4 lg:px-6 py-2 bg-white rounded-xl shadow-sm border border-stone-100 text-center min-w-24">
            <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">En Cocina</span>
            <span className="text-xl lg:text-2xl font-black text-primary">{preparing.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="px-4 lg:px-6 py-2 bg-white rounded-xl shadow-sm border border-stone-100 text-center min-w-24">
            <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Listos</span>
            <span className="text-xl lg:text-2xl font-black text-green-600">{ready.length.toString().padStart(2, '0')}</span>
          </div>
        </div>
      </header>

      {/* Kanban Board Section */}
      <section className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        
        {/* Column: NUEVOS */}
        <div className="flex flex-col gap-4 bg-stone-100/50 rounded-3xl p-4 border border-stone-200/50 overflow-hidden h-full">
          <div className="flex items-center justify-between px-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
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
            {news.map(order => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />)}
          </div>
        </div>

        {/* Column: EN PREPARACIÓN */}
        <div className="flex flex-col gap-4 bg-stone-100/50 rounded-3xl p-4 border border-stone-200/50 overflow-hidden h-full">
          <div className="flex items-center justify-between px-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
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
            {preparing.map(order => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />)}
          </div>
        </div>

        {/* Column: LISTOS PARA ENTREGAR */}
        <div className="flex flex-col gap-4 bg-stone-100/50 rounded-3xl p-4 border border-stone-200/50 overflow-hidden h-full">
          <div className="flex items-center justify-between px-2 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
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
            {ready.map(order => <OrderCard key={order.id} order={order} onAdvance={advanceOrder} />)}
          </div>
        </div>

      </section>

      {/* Floating Quick Action Area / Footer */}
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
