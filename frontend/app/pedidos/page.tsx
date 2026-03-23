"use client";

import { useState, useEffect } from "react";
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
  return order.delivery_type === 'pickup' || order.address === 'Retiro en local';
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (id: string, next: OrderStatus) => void }) {
  const nextStatus = STATUS_FLOW[order.status];
  const pickup = isPickup(order);
  const time = timeAgoObj(order.created_at);

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
    <div className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border-l-4 ${borderColor} flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2`}>
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-headline font-bold text-on-surface">{order.customer_name}</h4>
          <div className="flex items-center gap-1.5 text-stone-400 mt-1">
            <span className="material-symbols-outlined text-sm">{pickup ? 'storefront' : 'moped'}</span>
            <span className="text-xs font-semibold">
              {pickup ? 'Retiro en local' : 'Delivery'} • #{order.order_number}
            </span>
          </div>
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
        id, order_number, status, delivery_type, payment_method, address, subtotal, delivery_fee, total, notes, created_at,
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
      customer_name: o.clientes?.name || "Cliente", customer_phone: o.clientes?.phone || "",
      delivery_type: o.delivery_type, payment_method: o.payment_method, address: o.address || "",
      subtotal: Number(o.subtotal), delivery_fee: Number(o.delivery_fee), total: Number(o.total),
      items: o.notes ? [{ name: o.notes, price: 0, quantity: 1 }] : [],
      created_at: o.created_at,
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
