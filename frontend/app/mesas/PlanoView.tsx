"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { printTicket } from "./printTicket";
import POSDrawer, { OrderItem } from "./POSDrawer";

export interface Table {
  id: string;
  name: string;
  capacity: number;
  shape: "square" | "circle" | "rectangle" | "tall" | "barra" | "pared" | "puerta" | "terraza";
  status: "free" | "occupied" | "reserved";
  x: number;
  y: number;
  w: number;
  h: number;
  current_client?: string | null;
  time_elapsed?: string | null;
  current_bill?: number | null;
  reservation_time?: string | null;
  zone?: string | null;
  active_reserva_id?: string | null;
  current_order_items?: OrderItem[] | null;
}

type PaymentMethod = "cash" | "card" | "transfer" | "qr";

const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";

export default function PlanoView({ selectedDate }: { selectedDate: Date }) {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [billAmountToAdd, setBillAmountToAdd] = useState("");
  const [reservations, setReservations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [discount, setDiscount] = useState<number>(0);

  const [isClosingAccount, setIsClosingAccount] = useState(false);
  const [closeAccountSuccess, setCloseAccountSuccess] = useState(false);
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [closePaymentMethod, setClosePaymentMethod] = useState<PaymentMethod>("cash");

  const fetchTables = async () => {
    const { data, error } = await supabase.from('mesas').select('*');
    if (!error && data) setTables(data as Table[]);
  };

  const fetchReservations = async () => {
    const today = selectedDate || new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const { data } = await supabase.from('reservas').select('*').gte('start_time', todayStr).lt('start_time', tmrStr).neq('status', 'cancelled');
    if (data) setReservations(data);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        const mappedData = data
          .filter((p: any) => p.disponible === 'Sí' || p.disponible === 'Si' || p.disponible === 'Si ' || p.disponible === 'Sí ')
          .map((p: any) => ({
            id: p.producto,
            name: p.producto,
            category: p.tipo,
            price: parseFloat(String(p.precio).replace(/[^0-9.-]+/g, "")) || 0,
            description: p.ingredientes,
            image_url: null
          }));
        setProducts(mappedData);
      }
    } catch (e) {
      console.error("Error fetching products:", e);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchReservations();
    fetchProducts();
    const channel = supabase.channel('realtime-mesas-plano')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, fetchReservations)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const isToday = !selectedDate || selectedDate.toDateString() === new Date().toDateString();

  const derivedTables = tables.map(table => {
    const res = reservations.find(r => r.table_id === table.id && r.status !== 'cancelled' && r.status !== 'seated');
    if (res && (!isToday || table.status === 'free')) {
      const timeMatch = res.start_time.match(/T(\d{2}:\d{2})/);
      const timeVal = timeMatch ? timeMatch[1] : res.start_time.split('T').pop()?.substring(0, 5) ?? res.start_time;
      return { ...table, status: 'reserved' as const, reservation_time: timeVal, current_client: res.client_name, active_reserva_id: res.id };
    }
    if (!isToday && table.status === 'occupied') {
      return { ...table, status: 'free' as const, current_client: undefined, time_elapsed: undefined, current_bill: undefined };
    }
    return table;
  });

  const stats = {
    free: derivedTables.filter(t => t.status === "free" && !["pared","puerta","terraza"].includes(t.shape)).length,
    reserved: derivedTables.filter(t => t.status === "reserved" && !["pared","puerta","terraza"].includes(t.shape)).length,
    occupied: derivedTables.filter(t => t.status === "occupied" && !["pared","puerta","terraza"].includes(t.shape)).length,
    total: derivedTables.filter(t => !["pared","puerta","terraza"].includes(t.shape)).length,
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const selectedTable = derivedTables.find(t => t.id === selectedTableId);

  const subtotalAmount = selectedTable?.current_bill || 0;
  const discountAmount = Math.round(subtotalAmount * discount / 100);
  const totalAmount = subtotalAmount - discountAmount;

  const updateTableStatus = async (
    id: string, status: "free" | "occupied" | "reserved",
    extras?: Partial<Table>,
    reservaConfig?: { id: string; status: 'seated' | 'cancelled' | 'completed' }
  ) => {
    const { error } = await supabase.from('mesas').update({ status, ...extras }).eq('id', id);
    if (!error) {
      let finalExtras = { ...extras };
      if (reservaConfig) {
        await supabase.from('reservas').update({ status: reservaConfig.status }).eq('id', reservaConfig.id);
        finalExtras.active_reserva_id = null;
        finalExtras.reservation_time = null;
      }
      setTables(prev => prev.map(t => t.id === id ? { ...t, status, ...finalExtras } : t));
      if (reservaConfig) fetchReservations();
    }
  };

  const clearTable = (tableId: string, tableStatus: "free" | "occupied" | "reserved") => {
    if (!window.confirm(`¿Limpiar la cuenta de ${selectedTable?.name}?`)) return;
    updateTableStatus(tableId, tableStatus, { current_bill: 0, current_order_items: [] });
  };

  // Envía los productos actuales a cocina y mantiene la mesa ocupada
  const procesarCobro = async () => {
    if (!selectedTable) return;
    const orderItems = selectedTable.current_order_items || [];
    if (orderItems.length === 0) return;

    setIsProcessing(true);
    try {
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          restaurant_id: RESTAURANT_ID,
          customer_name: `Salón Mesa: ${selectedTable.name}`,
          status: 'new',
          delivery_type: 'salon',
          payment_method: null,
          source: 'salon',
          subtotal: subtotalAmount,
          delivery_fee: 0,
          total: totalAmount,
          table_id: selectedTable.id,
          table_name: selectedTable.name,
          notes: discount > 0 ? `Descuento ${discount}%` : null,
        })
        .select('id')
        .single();

      if (pedidoError) throw pedidoError;

      const items = orderItems.map(item => ({
        pedido_id: pedido.id,
        product_id: null,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: (item as any).note || null,
      }));

      const { error: itemsError } = await supabase.from('items_pedido').insert(items);
      if (itemsError) throw itemsError;

      // Mesa SIGUE OCUPADA — solo se limpian los ítems enviados para poder seguir agregando
      await supabase.from('mesas').update({
        current_bill: 0,
        current_order_items: [],
      }).eq('id', selectedTable.id);

      setTables(prev => prev.map(t =>
        t.id === selectedTable.id
          ? { ...t, current_bill: 0, current_order_items: [] }
          : t
      ));

      // Imprime solo la comanda de los productos enviados ahora
      printTicket({
        tableName: selectedTable.name,
        clientName: selectedTable.current_client,
        items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        subtotal: subtotalAmount,
        discount,
        discountAmount,
        total: totalAmount,
        paymentMethod: 'cash',
      });

      setCheckoutSuccess(true);
      setTimeout(() => {
        setIsCheckoutOpen(false);
        setIsMenuDrawerOpen(false);
        setCheckoutSuccess(false);
        // La mesa queda abierta para seguir agregando
        setDiscount(0);
        setPaymentMethod("cash");
      }, 2000);

    } catch (err) {
      console.error("Error al enviar pedido:", err);
      alert("Error al enviar el pedido. Intente nuevamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Abre el modal de cierre de cuenta con todos los pedidos de la mesa
  const abrirCuentaFinal = async () => {
    if (!selectedTable) return;
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, items_pedido(*)')
      .eq('table_id', selectedTable.id)
      .not('status', 'in', '(cancelled,completed)')
      .order('created_at', { ascending: true });
    if (!error && data) setTableOrders(data);
    setIsClosingAccount(true);
  };

  // Cierra la cuenta: marca todos los pedidos como completados y libera la mesa
  const cerrarCuenta = async () => {
    if (!selectedTable) return;
    setIsProcessing(true);
    try {
      const orderIds = tableOrders.map((o: any) => o.id);
      if (orderIds.length > 0) {
        await supabase.from('pedidos')
          .update({ status: 'completed', payment_method: closePaymentMethod })
          .in('id', orderIds);
      }

      // También procesar ítems actuales si los hay
      const pendingItems = selectedTable.current_order_items || [];
      if (pendingItems.length > 0) {
        const pendingTotal = pendingItems.reduce((s: number, i: OrderItem) => s + i.price * i.quantity, 0);
        const { data: lastPedido } = await supabase.from('pedidos').insert({
          restaurant_id: RESTAURANT_ID,
          customer_name: selectedTable.current_client || 'Cliente Salón',
          status: 'completed',
          delivery_type: 'salon',
          payment_method: closePaymentMethod,
          source: 'salon',
          subtotal: pendingTotal,
          delivery_fee: 0,
          total: pendingTotal,
          table_id: selectedTable.id,
          table_name: selectedTable.name,
        }).select('id').single();
        if (lastPedido) {
          await supabase.from('items_pedido').insert(
            pendingItems.map((item: OrderItem) => ({ pedido_id: lastPedido.id, product_id: null, name: item.name, price: item.price, quantity: item.quantity }))
          );
        }
      }

      // Liberar la mesa
      await supabase.from('mesas').update({
        status: 'free', current_client: null, time_elapsed: null, current_bill: null, current_order_items: [],
      }).eq('id', selectedTable.id);
      setTables(prev => prev.map(t =>
        t.id === selectedTable.id
          ? { ...t, status: 'free', current_client: null, time_elapsed: null, current_bill: null, current_order_items: [] }
          : t
      ));

      // Ticket final con todos los ítems
      const allItems: { name: string; quantity: number; price: number }[] = [];
      tableOrders.forEach((order: any) => {
        (order.items_pedido || []).forEach((item: any) => {
          allItems.push({ name: item.name, quantity: item.quantity, price: item.price });
        });
      });
      pendingItems.forEach((i: OrderItem) => allItems.push({ name: i.name, quantity: i.quantity, price: i.price }));
      const grandTotal = tableOrders.reduce((s: number, o: any) => s + (o.total || 0), 0)
        + pendingItems.reduce((s: number, i: OrderItem) => s + i.price * i.quantity, 0);

      printTicket({
        tableName: selectedTable.name,
        clientName: selectedTable.current_client,
        items: allItems,
        subtotal: grandTotal,
        discount: 0,
        discountAmount: 0,
        total: grandTotal,
        paymentMethod: closePaymentMethod,
      });

      setCloseAccountSuccess(true);
      setTimeout(() => {
        setIsClosingAccount(false);
        setCloseAccountSuccess(false);
        setSelectedTableId(null);
        setClosePaymentMethod("cash");
        setTableOrders([]);
      }, 2500);
    } catch (err) {
      console.error("Error al cerrar cuenta:", err);
      alert("Error al cerrar la cuenta. Intente nuevamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const tableTheme = {
    free:     { badge: "bg-emerald-500 text-white",  border: "border-emerald-300", ring: "ring-emerald-200", label: "Libre" },
    occupied: { badge: "bg-red-700 text-white",       border: "border-red-400",    ring: "ring-red-200",    label: "Ocupada" },
    reserved: { badge: "bg-amber-500 text-white",     border: "border-amber-300",  ring: "ring-amber-200",  label: "Reservada" },
  };

  const paymentMethods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: "cash",     label: "Efectivo",    icon: "payments" },
    { id: "card",     label: "Tarjeta",     icon: "credit_card" },
    { id: "transfer", label: "Transferencia", icon: "account_balance" },
    { id: "qr",       label: "QR",          icon: "qr_code_2" },
  ];

  return (
    <div className="flex flex-col gap-4 w-full h-full animate-in fade-in duration-300">

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: "Libres",      value: stats.free,     color: "text-emerald-600", bg: "bg-emerald-50",  icon: "check_circle" },
          { label: "Reservadas",  value: stats.reserved, color: "text-amber-600",   bg: "bg-amber-50",    icon: "event" },
          { label: "Ocupadas",    value: stats.occupied, color: "text-red-700",     bg: "bg-red-50",      icon: "person_pin_circle" },
          { label: "Total Mesas", value: stats.total,    color: "text-stone-800",   bg: "bg-stone-100",   icon: "grid_view" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-stone-500 mb-1">{card.label}</p>
              <p className={`text-3xl sm:text-4xl font-black ${card.color}`}>{card.value}</p>
            </div>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${card.bg} flex items-center justify-center ${card.color}`}>
              <span className="material-symbols-outlined text-[20px] sm:text-[24px]">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* FLOOR PLAN + DETAIL */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

        <div
          className={`bg-stone-100 rounded-2xl border border-stone-200 overflow-auto custom-scrollbar relative transition-all duration-300 ${selectedTable ? 'lg:flex-1 h-[50vh] lg:h-full' : 'flex-1 h-[60vh] lg:h-full'}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).id === "plano-canvas") {
              setSelectedTableId(null);
            }
          }}
        >
          <div id="plano-canvas" className="w-[1100px] min-h-[700px] relative pointer-events-auto"
            style={{ backgroundImage: 'radial-gradient(#d6d3ce 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}
          >
            {derivedTables.map(table => {
              const isSelected = selectedTableId === table.id;

              if (table.shape === 'pared' || table.shape === 'puerta') {
                const isPuerta = table.shape === 'puerta';
                return (
                  <div key={table.id} className="absolute pointer-events-none select-none" style={{
                    left: table.x, top: table.y, width: table.w, height: table.h,
                    backgroundColor: isPuerta ? 'transparent' : '#b5b0aa',
                    backgroundImage: isPuerta ? 'repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(180,174,168,0.5) 8px,rgba(180,174,168,0.5) 16px)' : 'none',
                    borderRadius: '6px'
                  }} />
                );
              }
              if (table.shape === 'terraza') {
                return (
                  <div key={table.id} className="absolute flex items-center justify-center border-2 border-dashed border-stone-400 pointer-events-none select-none rounded-3xl"
                    style={{ left: table.x, top: table.y, width: table.w, height: table.h }}>
                    <span className="uppercase tracking-widest text-[10px] opacity-40 font-black px-2 text-center break-words">{table.name || "TERRAZA"}</span>
                  </div>
                );
              }

              const theme = tableTheme[table.status] ?? tableTheme.free;
              const isCircle = table.shape === "circle";
              const isBarra = table.shape === "barra";

              return (
                <button key={table.id}
                  onPointerDown={(e) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                  className={`absolute flex flex-col items-center justify-center cursor-pointer transition-all duration-150 active:scale-95 bg-white border-2 select-none focus:outline-none
                    ${theme.border} ${isCircle ? "rounded-full" : "rounded-xl"} ${isBarra ? "flex-row justify-between px-4" : "flex-col"}
                    ${isSelected ? `ring-4 ${theme.ring} shadow-xl z-10 scale-[1.03]` : "z-0 shadow-sm hover:shadow-md hover:scale-[1.02]"}`}
                  style={{ left: `${table.x}px`, top: `${table.y}px`, width: `${table.w}px`, height: `${table.h}px` }}
                >
                  {isBarra ? (
                    <>
                      <div className="flex flex-col text-left">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${theme.badge} mb-1 self-start`}>{theme.label}</span>
                        <p className="font-extrabold text-stone-800 text-sm">{table.current_client || "Sin Asignar"}</p>
                        <p className="text-[11px] text-stone-400 font-medium">Barra · {table.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-red-700">${(table.current_bill || 0).toLocaleString('es-AR')}</p>
                        <p className="text-[11px] font-bold text-stone-400">{table.time_elapsed || "0 min"}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${theme.badge}`}>
                          {theme.label}
                        </span>
                      </div>
                      <p className="font-black text-stone-700 text-sm mt-0.5 leading-none">{table.name}</p>
                      {table.status === "occupied" && (
                        <div className="flex flex-col items-center mt-1 gap-0.5">
                          <p className="text-[10px] font-bold text-stone-500 truncate max-w-[90%] text-center">{table.current_client || "—"}</p>
                          <div className="flex items-center gap-0.5 text-red-600">
                            <span className="material-symbols-outlined text-[11px]">schedule</span>
                            <span className="text-[10px] font-black">{table.time_elapsed || "0m"}</span>
                          </div>
                        </div>
                      )}
                      {table.status === "reserved" && (
                        <div className="flex flex-col items-center mt-1 gap-0.5">
                          <p className="text-[10px] font-bold text-stone-500 truncate max-w-[90%] text-center">{table.current_client || "Reserva"}</p>
                          <div className="flex items-center gap-0.5 text-amber-600">
                            <span className="material-symbols-outlined text-[11px]">schedule</span>
                            <span className="text-[10px] font-black">{table.reservation_time}</span>
                          </div>
                        </div>
                      )}
                      {table.status === "free" && (
                        <div className="flex items-center gap-0.5 text-stone-400 mt-1">
                          <span className="material-symbols-outlined text-[11px]">groups</span>
                          <span className="text-[10px] font-semibold">{table.capacity}p</span>
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedTable && (
          <div className="lg:w-[360px] xl:w-[400px] shrink-0 animate-in fade-in slide-in-from-bottom-2 lg:slide-in-from-right-4 duration-200">
            <div className="bg-white rounded-2xl shadow-lg border border-stone-100 flex flex-col overflow-hidden h-full max-h-[80vh] lg:max-h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-stone-800">{selectedTable.name}</h3>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    selectedTable.status === 'free' ? 'bg-emerald-100 text-emerald-700' :
                    selectedTable.status === 'occupied' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedTable.status === 'free' ? 'Libre' : selectedTable.status === 'occupied' ? 'Ocupada' : 'Reservada'}
                  </span>
                </div>
                <button onClick={() => setSelectedTableId(null)} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* OCCUPIED */}
                {selectedTable.status === 'occupied' && (
                  <div className="flex flex-col">
                    <div className="px-5 py-4 flex items-center gap-3 bg-red-50/50 border-b border-stone-100">
                      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-red-600 text-[18px]">person</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-red-600 tracking-widest leading-none mb-1">Cliente</p>
                        <p className="font-bold text-stone-800 text-sm">{selectedTable.current_client}</p>
                        <p className="text-xs text-stone-400 font-medium">{selectedTable.time_elapsed || "0 min"}</p>
                      </div>
                    </div>

                    <div className="px-5 pt-3 pb-2">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Detalle de consumo</span>
                        <span className="text-[10px] font-bold text-stone-400">{(selectedTable.current_order_items || []).reduce((a, i) => a + i.quantity, 0)} ítems</span>
                      </div>
                      {(selectedTable.current_order_items || []).length === 0 ? (
                        <p className="text-sm text-stone-400 text-center py-4">Sin productos</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {(selectedTable.current_order_items || []).map(item => (
                            <div key={item.id} className="flex items-center gap-2 py-2 border-b border-stone-50">
                              <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-black shrink-0">{item.quantity}</span>
                              <p className="flex-1 text-sm font-semibold text-stone-700 truncate">{item.name}</p>
                              <p className="text-sm font-black text-stone-800">${((item.price || 0) * item.quantity).toLocaleString('es-AR')}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-5 py-3 border-t border-dashed border-stone-200 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-stone-400">Total a pagar</span>
                      <span className="text-2xl font-black text-red-700">${(selectedTable.current_bill || 0).toLocaleString('es-AR')}</span>
                    </div>

                    <div className="px-5 py-2 border-t border-stone-100">
                      <div className="flex gap-2 overflow-x-auto hide-scroll pb-1">
                        {uniqueCategories.slice(0, 6).map(cat => (
                          <button key={cat as string} onClick={() => { setActiveCategory(cat as string); setIsMenuDrawerOpen(true); }}
                            className="shrink-0 h-7 px-3 rounded-full bg-stone-100 text-stone-600 font-bold text-xs hover:bg-stone-200 transition-colors">
                            {cat as string}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 flex flex-col gap-2 shrink-0">
                      <button onClick={() => { setActiveCategory(null); setIsMenuDrawerOpen(true); }}
                        className="w-full bg-red-700 hover:bg-red-800 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md shadow-red-900/20 active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        Agregar productos
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setIsBillOpen(true)} className="bg-stone-50 border border-stone-200 py-2.5 rounded-xl font-bold text-stone-600 text-xs flex items-center justify-center gap-1.5 hover:bg-stone-100 active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                          Editar manual
                        </button>
                        <button onClick={() => clearTable(selectedTable.id, selectedTable.status)} className="bg-stone-50 border border-stone-200 py-2.5 rounded-xl font-bold text-stone-600 text-xs flex items-center justify-center gap-1.5 hover:bg-stone-100 active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          Limpiar cuenta
                        </button>
                        <button className="bg-stone-50 border border-stone-200 py-2.5 rounded-xl font-bold text-stone-600 text-xs flex items-center justify-center gap-1.5 hover:bg-stone-100 active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-[15px]">call_split</span>
                          Dividir cuenta
                        </button>
                        <button className="bg-stone-50 border border-stone-200 py-2.5 rounded-xl font-bold text-stone-600 text-xs flex items-center justify-center gap-1.5 hover:bg-stone-100 active:scale-95 transition-all">
                          <span className="material-symbols-outlined text-[15px]">transform</span>
                          Cambiar mesa
                        </button>
                      </div>

                      <button
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={(selectedTable.current_order_items || []).length === 0}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md shadow-green-900/20 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Mandar pedido
                      </button>

                      <button
                        onClick={abrirCuentaFinal}
                        className="w-full bg-stone-800 hover:bg-stone-900 border border-stone-300 text-stone-700 py-3.5 rounded-xl font-black flex items-center justify-center gap-2 text-sm active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                        Cerrar cuenta
                      </button>
                    </div>
                  </div>
                )}

                {/* FREE */}
                {selectedTable.status === 'free' && (
                  <div className="p-5 flex flex-col gap-5">
                    <div className="bg-stone-50 rounded-xl p-4 flex items-center gap-3">
                      <span className="material-symbols-outlined text-stone-400 text-[28px]">groups</span>
                      <div>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Capacidad</p>
                        <p className="font-bold text-stone-800">{selectedTable.capacity} personas</p>
                      </div>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-4">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Próxima reserva</p>
                      <p className="text-sm text-stone-500">Sin reservas hoy.</p>
                    </div>
                    <button onClick={() => updateTableStatus(selectedTable.id, 'occupied', { current_client: 'Cliente Caminante', time_elapsed: '0 min' })}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Sentar cliente
                    </button>
                  </div>
                )}

                {/* RESERVED */}
                {selectedTable.status === 'reserved' && (
                  <div className="p-5 flex flex-col gap-4">
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Cliente reserva</p>
                      <p className="font-bold text-stone-800 text-base">{selectedTable.current_client}</p>
                      <div className="flex items-center gap-1 mt-2 text-amber-600">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span className="text-sm font-bold">{selectedTable.reservation_time}</span>
                      </div>
                    </div>
                    <button onClick={() => {
                      if (selectedTable.active_reserva_id) {
                        updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', current_client: selectedTable.current_client }, { id: selectedTable.active_reserva_id, status: 'seated' });
                      } else {
                        updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', reservation_time: null });
                      }
                    }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Sentar clientes
                    </button>
                    <button onClick={() => {
                      if (selectedTable.active_reserva_id) {
                        updateTableStatus(selectedTable.id, 'free', { current_client: null, reservation_time: null }, { id: selectedTable.active_reserva_id, status: 'cancelled' });
                      } else {
                        updateTableStatus(selectedTable.id, 'free', { current_client: null, reservation_time: null });
                      }
                    }}
                      className="w-full text-stone-400 hover:text-red-600 py-2 font-bold text-xs flex items-center justify-center gap-1 transition-colors">
                      <span className="material-symbols-outlined text-sm">cancel</span>
                      Cancelar reserva
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BILL MODAL */}
      {isBillOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h3 className="text-lg font-black">Editar cuenta · {selectedTable.name}</h3>
              <button onClick={() => setIsBillOpen(false)} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-5">
              <div className="text-4xl font-black text-red-700 mb-5">${(selectedTable.current_bill || 0).toLocaleString('es-AR')}</div>
              <div className="flex gap-2">
                <input type="number" placeholder="Monto a agregar..."
                  className="flex-1 px-4 py-3 border border-stone-200 rounded-xl outline-none focus:border-red-700 transition-colors text-sm"
                  value={billAmountToAdd} onChange={(e) => setBillAmountToAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseFloat(billAmountToAdd);
                      if (!isNaN(val)) { updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: (selectedTable.current_bill || 0) + val }); setBillAmountToAdd(""); }
                    }
                  }}
                />
                <button
                  onClick={() => { const val = parseFloat(billAmountToAdd); if (!isNaN(val)) { updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: (selectedTable.current_bill || 0) + val }); setBillAmountToAdd(""); } }}
                  className="bg-red-700 text-white px-4 rounded-xl font-bold hover:bg-red-800 active:scale-95 transition-all">
                  <span className="material-symbols-outlined mt-1">add</span>
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: 0 })} className="flex-1 py-2.5 font-bold text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-xl flex items-center gap-1 justify-center">
                  <span className="material-symbols-outlined text-[14px]">remove_shopping_cart</span>
                  Limpiar
                </button>
                <button onClick={() => setIsBillOpen(false)} className="flex-1 py-2.5 font-bold text-xs text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL - Mandar pedido a cocina */}
      {isCheckoutOpen && selectedTable && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

            {checkoutSuccess && (
              <div className="absolute inset-0 bg-emerald-700 flex flex-col items-center justify-center z-10 animate-in fade-in">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-white text-[48px]">check_circle</span>
                </div>
                <p className="text-white font-black text-2xl">¡Pedido enviado a cocina!</p>
                <p className="text-white/70 text-sm mt-1">{selectedTable.name} · Podés seguir agregando productos</p>
              </div>
            )}

            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="text-xl font-black text-stone-800">Mandar pedido</h3>
                <p className="text-xs text-stone-400 font-medium mt-0.5">{selectedTable.name} · {selectedTable.current_client}</p>
              </div>
              <button onClick={() => { setIsCheckoutOpen(false); setDiscount(0); }} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
              <div className="bg-stone-50 rounded-2xl p-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Resumen del pedido</p>
                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                  {(selectedTable.current_order_items || []).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-stone-600 font-medium">{item.quantity}x {item.name}</span>
                      <span className="font-bold text-stone-800">${((item.price || 0) * item.quantity).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-500">Descuento</span>
                    <span className="text-xs font-black text-stone-700">{discount}%</span>
                  </div>
                  <div className="flex gap-2">
                    {[0, 5, 10, 15, 20, 25].map(pct => (
                      <button key={pct} onClick={() => setDiscount(pct)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${discount === pct ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'}`}>
                        {pct > 0 ? `${pct}%` : 'Sin'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-dashed border-stone-200 space-y-1">
                  <div className="flex justify-between text-sm text-stone-500">
                    <span>Subtotal</span>
                    <span className="font-bold">${subtotalAmount.toLocaleString('es-AR')}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Descuento ({discount}%)</span>
                      <span className="font-bold">-${discountAmount.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="text-sm font-black uppercase tracking-widest text-stone-500">TOTAL</span>
                    <span className="text-4xl font-black text-stone-900">${totalAmount.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              <button onClick={procesarCobro} disabled={isProcessing}
                className="w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 bg-emerald-700 hover:bg-emerald-800 text-white transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-green-900/20 mb-4">
                {isProcessing ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-2xl">send</span>
                    Confirmar pedido · ${totalAmount.toLocaleString('es-AR')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-SPEED POS */}
      {isMenuDrawerOpen && selectedTable && (
        <POSDrawer
          table={selectedTable}
          products={products}
          initialCategory={activeCategory}
          onClose={() => setIsMenuDrawerOpen(false)}
          onCobrar={() => { setIsMenuDrawerOpen(false); setIsCheckoutOpen(true); }}
          onSave={(newItems, bill) =>
            updateTableStatus(selectedTable.id, selectedTable.status, {
              current_order_items: newItems,
              current_bill: bill,
            })
          }
        />
      )}

      {/* CERRAR CUENTA MODAL */}
      {isClosingAccount && selectedTable && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 relative">

            {closeAccountSuccess && (
              <div className="absolute inset-0 bg-stone-900 flex flex-col items-center justify-center z-10 animate-in fade-in">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-white text-[48px]">check_circle</span>
                </div>
                <p className="text-white font-black text-2xl">¡Cuenta cerrada!</p>
                <p className="text-white/60 text-sm mt-1">{selectedTable.name} · Ticket impreso</p>
              </div>
            )}

            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
              <div>
                <h3 className="text-xl font-black text-stone-800">Cerrar cuenta</h3>
                <p className="text-xs text-stone-400 font-medium mt-0.5">{selectedTable.name} · {selectedTable.current_client}</p>
              </div>
              <button onClick={() => { setIsClosingAccount(false); setTableOrders([]); }} className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
              {/* Pedidos anteriores */}
              {tableOrders.length > 0 && (
                <div className="bg-stone-50 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Pedidos enviados</p>
                  <div className="flex flex-col gap-3 max-h-48 overflow-y-auto">
                    {tableOrders.map((order: any, idx: number) => (
                      <div key={order.id}>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider mb-1">Pedido #{idx + 1}</p>
                        {(order.items_pedido || []).map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-sm py-0.5">
                            <span className="text-stone-600">{item.quantity}x {item.name}</span>
                            <span className="font-bold text-stone-800">${((item.price || 0) * item.quantity).toLocaleString('es-AR')}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ítems pendientes aún no enviados */}
              {(selectedTable.current_order_items || []).length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Ítems sin mandar</p>
                  {(selectedTable.current_order_items || []).map((item: OrderItem) => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-stone-600">{item.quantity}x {item.name}</span>
                      <span className="font-bold text-stone-800">${((item.price || 0) * item.quantity).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Total final */}
              {(() => {
                const grandT = tableOrders.reduce((s: number, o: any) => s + (o.total || 0), 0)
                  + (selectedTable.current_order_items || []).reduce((s: number, i: OrderItem) => s + i.price * i.quantity, 0);
                return (
                  <div className="bg-stone-900 rounded-2xl p-4 mb-4 flex items-center justify-between">
                    <span className="text-sm font-black uppercase tracking-widest text-stone-400">TOTAL FINAL</span>
                    <span className="text-4xl font-black text-white">${grandT.toLocaleString('es-AR')}</span>
                  </div>
                );
              })()}

              {/* Método de pago */}
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Método de pago</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                {paymentMethods.map(pm => (
                  <button key={pm.id} onClick={() => setClosePaymentMethod(pm.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-bold text-xs transition-all active:scale-95 ${closePaymentMethod === pm.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
                    <span className={`material-symbols-outlined text-[22px] ${closePaymentMethod === pm.id ? 'text-white' : 'text-stone-500'}`}>{pm.icon}</span>
                    {pm.label}
                  </button>
                ))}
              </div>

              <button onClick={cerrarCuenta} disabled={isProcessing}
                className="w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 bg-stone-900 hover:bg-stone-800 text-white transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg mb-4">
                {isProcessing ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                    Cobrar y cerrar mesa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
