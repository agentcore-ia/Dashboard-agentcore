"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

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

export interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
}

export default function PlanoView({ selectedDate }: { selectedDate: Date }) {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [billAmountToAdd, setBillAmountToAdd] = useState("");
  const [reservations, setReservations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const addProductToTable = (product: any) => {
    if (!selectedTable) return;
    const currentItems = selectedTable.current_order_items || [];
    const existingIndex = currentItems.findIndex(i => i.product_id === product.id);
    let newItems = [...currentItems];
    if (existingIndex >= 0) {
      newItems[existingIndex] = { ...newItems[existingIndex], quantity: newItems[existingIndex].quantity + 1 };
    } else {
      newItems.push({ id: Math.random().toString(36).substring(7), product_id: product.id, name: product.name, price: parseFloat(product.price) || 0, quantity: 1, description: product.description });
    }
    const newBill = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    updateTableStatus(selectedTable.id, selectedTable.status, { current_order_items: newItems, current_bill: newBill });
  };

  const updateProductQuantity = (itemId: string, delta: number) => {
    if (!selectedTable) return;
    const newItems = (selectedTable.current_order_items || []).map(i =>
      i.id === itemId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    );
    const newBill = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    updateTableStatus(selectedTable.id, selectedTable.status, { current_order_items: newItems, current_bill: newBill });
  };

  const removeProductFromTable = (itemId: string) => {
    if (!selectedTable) return;
    const newItems = (selectedTable.current_order_items || []).filter(i => i.id !== itemId);
    const newBill = newItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    updateTableStatus(selectedTable.id, selectedTable.status, { current_order_items: newItems, current_bill: newBill });
  };

  const clearTable = (tableId: string, tableStatus: "free" | "occupied" | "reserved") => {
    if (!window.confirm(`¿Limpiar la cuenta de ${selectedTable?.name}?`)) return;
    updateTableStatus(tableId, tableStatus, { current_bill: 0, current_order_items: [] });
  };

  const cobrarCuenta = () => {
    if (!selectedTable) return;
    updateTableStatus(selectedTable.id, 'free', { current_client: null, time_elapsed: null, current_bill: null, current_order_items: null });
    setIsMenuDrawerOpen(false);
  };

  // Table status styles
  const tableTheme = {
    free:     { badge: "bg-emerald-500 text-white",     border: "border-emerald-300",  ring: "ring-emerald-200", label: "Libre" },
    occupied: { badge: "bg-red-700 text-white",         border: "border-red-400",      ring: "ring-red-200",     label: "Ocupada" },
    reserved: { badge: "bg-amber-500 text-white",       border: "border-amber-300",    ring: "ring-amber-200",   label: "Reservada" },
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full animate-in fade-in duration-300">

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: "Libres",       value: stats.free,     color: "text-emerald-600",  bg: "bg-emerald-50",    icon: "check_circle" },
          { label: "Reservadas",   value: stats.reserved, color: "text-amber-600",    bg: "bg-amber-50",      icon: "event" },
          { label: "Ocupadas",     value: stats.occupied, color: "text-red-700",      bg: "bg-red-50",        icon: "person_pin_circle" },
          { label: "Total Mesas",  value: stats.total,    color: "text-stone-800",    bg: "bg-stone-100",     icon: "grid_view" },
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

      {/* ── FLOOR PLAN + DETAIL PANEL ── */}
      {/* On mobile: stacked. On lg+: side by side */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

        {/* Floor Plan */}
        <div
          className={`bg-stone-100 rounded-2xl border border-stone-200 overflow-auto custom-scrollbar relative transition-all duration-300 ${selectedTable ? 'lg:flex-1 h-[50vh] lg:h-full' : 'flex-1 h-[60vh] lg:h-full'}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).id === "plano-canvas") {
              setSelectedTableId(null);
            }
          }}
        >
          <div
            id="plano-canvas"
            className="w-[1100px] min-h-[700px] relative pointer-events-auto"
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
                  <div key={table.id} className="absolute flex items-center justify-center border-2 border-dashed border-stone-400 pointer-events-none select-none rounded-3xl" style={{ left: table.x, top: table.y, width: table.w, height: table.h }}>
                    <span className="uppercase tracking-widest text-[10px] opacity-40 font-black px-2 text-center break-words">{table.name || "TERRAZA"}</span>
                  </div>
                );
              }

              // Real tables
              const theme = tableTheme[table.status] ?? tableTheme.free;
              const isCircle = table.shape === "circle";
              const isBarra = table.shape === "barra";

              return (
                <button
                  key={table.id}
                  onPointerDown={(e) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                  className={`absolute flex flex-col items-center justify-center cursor-pointer transition-all duration-150 active:scale-95 bg-white border-2 select-none focus:outline-none
                    ${theme.border}
                    ${isCircle ? "rounded-full" : "rounded-xl"}
                    ${isSelected ? `ring-4 ${theme.ring} shadow-xl z-10 scale-[1.03]` : "z-0 shadow-sm hover:shadow-md hover:scale-[1.02]"}
                    ${isBarra ? "flex-row justify-between px-4" : "flex-col"}
                  `}
                  style={{ left: `${table.x}px`, top: `${table.y}px`, width: `${table.w}px`, height: `${table.h}px` }}
                >
                  {/* Status badge — now INSIDE the card, at the top */}
                  <div className={`${isBarra ? 'hidden' : 'block'} shrink-0`}>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${theme.badge}`}>
                      {theme.label}
                    </span>
                  </div>

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

        {/* Detail Panel — slides in on mobile as overlay-like bottom sheet, sidebar on desktop */}
        {selectedTable && (
          <div className="lg:w-[360px] xl:w-[400px] shrink-0 animate-in fade-in slide-in-from-bottom-2 lg:slide-in-from-right-4 duration-200">
            <div className="bg-white rounded-2xl shadow-lg border border-stone-100 flex flex-col overflow-hidden h-full max-h-[80vh] lg:max-h-full">

              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-stone-800">{selectedTable.name}</h3>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    selectedTable.status === 'free' ? 'bg-emerald-100 text-emerald-700' :
                    selectedTable.status === 'occupied' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedTable.status === 'free' ? 'Libre' : selectedTable.status === 'occupied' ? 'Ocupada' : 'Reservada'}
                  </span>
                </div>
                <button onClick={() => setSelectedTableId(null)} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Panel Body — scrollable */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ── OCCUPIED STATE ── */}
                {selectedTable.status === 'occupied' && (
                  <div className="flex flex-col h-full">
                    {/* Client info */}
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

                    {/* Items */}
                    <div className="px-5 pt-3 pb-2 flex-1 overflow-y-auto">
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

                    {/* Total */}
                    <div className="px-5 py-3 border-t border-dashed border-stone-200 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-stone-400">Total a pagar</span>
                      <span className="text-2xl font-black text-red-700">${(selectedTable.current_bill || 0).toLocaleString('es-AR')}</span>
                    </div>

                    {/* Category quick access */}
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

                    {/* Actions */}
                    <div className="p-4 flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => { setActiveCategory(null); setIsMenuDrawerOpen(true); }}
                        className="w-full bg-red-700 hover:bg-red-800 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md shadow-red-900/20 active:scale-95 transition-all"
                      >
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
                        onClick={() => updateTableStatus(selectedTable.id, 'free', { current_client: null, time_elapsed: null, current_bill: null, current_order_items: null })}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md shadow-green-900/20 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                        Cerrar y cobrar
                      </button>
                    </div>
                  </div>
                )}

                {/* ── FREE STATE ── */}
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
                    <button
                      onClick={() => updateTableStatus(selectedTable.id, 'occupied', { current_client: 'Cliente Caminante', time_elapsed: '0 min' })}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Sentar cliente
                    </button>
                  </div>
                )}

                {/* ── RESERVED STATE ── */}
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
                    <button
                      onClick={() => {
                        if (selectedTable.active_reserva_id) {
                          updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', current_client: selectedTable.current_client }, { id: selectedTable.active_reserva_id, status: 'seated' });
                        } else {
                          updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', reservation_time: null });
                        }
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Sentar clientes
                    </button>
                    <button
                      onClick={() => {
                        if (selectedTable.active_reserva_id) {
                          updateTableStatus(selectedTable.id, 'free', { current_client: null, reservation_time: null }, { id: selectedTable.active_reserva_id, status: 'cancelled' });
                        } else {
                          updateTableStatus(selectedTable.id, 'free', { current_client: null, reservation_time: null });
                        }
                      }}
                      className="w-full text-stone-400 hover:text-red-600 py-2 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                    >
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

      {/* ── BILL MODAL ── */}
      {isBillOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h3 className="text-lg font-black">Editar cuenta · {selectedTable.name}</h3>
              <button onClick={() => setIsBillOpen(false)} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-5">
              <div className="text-4xl font-black text-red-700 mb-5">${(selectedTable.current_bill || 0).toLocaleString('es-AR')}</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Monto a agregar..."
                  className="flex-1 px-4 py-3 border border-stone-200 rounded-xl outline-none focus:border-red-700 transition-colors text-sm"
                  value={billAmountToAdd}
                  onChange={(e) => setBillAmountToAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseFloat(billAmountToAdd);
                      if (!isNaN(val)) { updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: (selectedTable.current_bill || 0) + val }); setBillAmountToAdd(""); }
                    }
                  }}
                />
                <button
                  onClick={() => { const val = parseFloat(billAmountToAdd); if (!isNaN(val)) { updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: (selectedTable.current_bill || 0) + val }); setBillAmountToAdd(""); } }}
                  className="bg-red-700 text-white px-4 rounded-xl font-bold hover:bg-red-800 active:scale-95 transition-all"
                >
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

      {/* ── POS FULL-SCREEN ── */}
      {isMenuDrawerOpen && selectedTable && (() => {
        const orderItems = selectedTable.current_order_items || [];
        const itemCount = orderItems.reduce((acc, i) => acc + i.quantity, 0);
        const filteredProducts = products.filter(p => !activeCategory || p.category === activeCategory);

        return (
          <div className="fixed inset-0 z-[100] flex flex-col lg:flex-row bg-[#f5f4f2] animate-in fade-in duration-150"
            onKeyDown={(e) => { if (e.key === 'Escape') setIsMenuDrawerOpen(false); }}
            tabIndex={-1}
          >
            {/* LEFT: Catalog */}
            <div className="flex-1 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-stone-200">

              {/* Header */}
              <div className="h-14 lg:h-16 px-4 lg:px-5 flex items-center gap-3 bg-white border-b border-stone-200 shrink-0">
                <button onClick={() => setIsMenuDrawerOpen(false)} className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 active:scale-90 transition-all">
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <div className="flex-1 min-w-0">
                  <span className="font-black text-stone-800 text-base lg:text-lg leading-none">{selectedTable.name}</span>
                  <span className="hidden sm:inline ml-2 text-xs font-bold text-stone-400 uppercase tracking-widest">· Agregar productos</span>
                </div>
                {itemCount > 0 && (
                  <span className="bg-emerald-700 text-white font-black text-xs lg:text-sm px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full shrink-0">
                    {itemCount} ítem{itemCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Categories */}
              <div className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 bg-white border-b border-stone-200 overflow-x-auto hide-scroll shrink-0">
                <button onClick={() => setActiveCategory(null)}
                  className={`shrink-0 h-9 lg:h-10 px-4 lg:px-5 rounded-xl font-black text-xs lg:text-sm transition-all duration-100 active:scale-95 ${!activeCategory ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                  Todos
                </button>
                {uniqueCategories.map(cat => (
                  <button key={cat as string} onClick={() => setActiveCategory(cat as string)}
                    className={`shrink-0 h-9 lg:h-10 px-4 lg:px-5 rounded-xl font-black text-xs lg:text-sm transition-all duration-100 active:scale-95 ${activeCategory === cat ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    {cat as string}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-stone-400 select-none">
                    <span className="material-symbols-outlined text-[48px] opacity-30 mb-2">search_off</span>
                    <span className="font-bold text-sm">Sin productos en esta categoría</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 lg:gap-3">
                    {filteredProducts.map(p => {
                      const existingItem = orderItems.find(i => i.product_id === p.id);
                      return (
                        <button key={p.id} onClick={() => addProductToTable(p)}
                          className="group relative bg-white border-2 border-stone-100 hover:border-stone-700 active:scale-[0.93] active:bg-stone-900 active:border-stone-900 rounded-xl lg:rounded-2xl p-3 lg:p-4 flex flex-col justify-between text-left transition-all duration-100 select-none focus:outline-none"
                          style={{ minHeight: '88px' }}
                        >
                          {existingItem && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 lg:w-6 lg:h-6 bg-emerald-700 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow z-10">
                              {existingItem.quantity}
                            </div>
                          )}
                          <span className="font-bold text-stone-800 text-xs lg:text-sm leading-snug line-clamp-2 group-active:text-white transition-colors">
                            {p.name}
                          </span>
                          <span className="font-black text-red-700 text-base lg:text-lg mt-1.5 group-active:text-red-200 transition-colors">
                            ${(p.price || 0).toLocaleString('es-AR')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Comanda */}
            <div className="w-full lg:w-[360px] xl:w-[420px] flex flex-col bg-white shrink-0 max-h-[45vh] lg:max-h-full">

              {/* Comanda Header */}
              <div className="h-14 lg:h-16 px-4 lg:px-5 flex items-center justify-between border-b border-stone-200 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-stone-800 text-base lg:text-lg">Comanda</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${orderItems.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {orderItems.length > 0 ? 'En curso' : 'Abierta'}
                  </span>
                </div>
                {orderItems.length > 0 && (
                  <button onClick={() => clearTable(selectedTable.id, selectedTable.status)}
                    className="text-stone-300 hover:text-red-500 text-xs font-bold flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-3 lg:px-4 py-2 lg:py-3 flex flex-col gap-1.5 lg:gap-2">
                {orderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-stone-300 select-none py-6">
                    <span className="material-symbols-outlined text-[52px] lg:text-[72px] mb-2">receipt_long</span>
                    <span className="font-black text-sm text-stone-400">Cuenta vacía</span>
                  </div>
                ) : (
                  orderItems.map((item, idx) => {
                    const isLast = idx === orderItems.length - 1;
                    return (
                      <div key={item.id}
                        className={`rounded-xl px-3 lg:px-4 py-2.5 lg:py-3 flex items-center gap-2 lg:gap-3 transition-all duration-150 ${isLast ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-stone-50 border border-stone-100'}`}
                      >
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateProductQuantity(item.id, -1)}
                            className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 active:scale-90 flex items-center justify-center text-stone-600 transition-all">
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className="w-6 text-center font-black text-sm text-stone-800">{item.quantity}</span>
                          <button onClick={() => updateProductQuantity(item.id, 1)}
                            className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-stone-900 hover:bg-stone-700 active:scale-90 flex items-center justify-center text-white transition-all">
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-stone-800 text-xs lg:text-sm leading-tight truncate">{item.name}</p>
                          <p className="text-[10px] lg:text-xs text-stone-400 font-medium">${(item.price || 0).toLocaleString('es-AR')} c/u</p>
                        </div>
                        <span className="font-black text-stone-800 text-sm shrink-0">${((item.price || 0) * item.quantity).toLocaleString('es-AR')}</span>
                        <button onClick={() => removeProductFromTable(item.id)}
                          className="w-7 h-7 rounded-lg text-stone-200 hover:text-red-500 hover:bg-red-50 active:scale-90 flex items-center justify-center transition-all shrink-0">
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom: Totals + Actions */}
              <div className="bg-white border-t border-stone-100 p-3 lg:p-4 shrink-0">
                <div className="flex justify-between items-center text-xs font-bold text-stone-400 mb-1">
                  <span>{itemCount} ítem{itemCount !== 1 ? 's' : ''} · Subtotal</span>
                  <span>${(selectedTable.current_bill || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-baseline border-t border-dashed border-stone-100 pt-2 mb-3">
                  <span className="text-xs font-black uppercase tracking-widest text-stone-400">TOTAL</span>
                  <span className="text-3xl lg:text-4xl xl:text-[48px] leading-none font-black text-stone-900 tracking-tighter">
                    ${(selectedTable.current_bill || 0).toLocaleString('es-AR')}
                  </span>
                </div>
                <button onClick={cobrarCuenta} disabled={orderItems.length === 0}
                  className="w-full h-12 lg:h-14 rounded-xl lg:rounded-2xl font-black text-base lg:text-lg flex items-center justify-center gap-2 transition-all duration-100 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-700 hover:bg-emerald-800 text-white shadow-md"
                >
                  <span className="material-symbols-outlined text-xl">payments</span>
                  Cobrar cuenta
                </button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={() => clearTable(selectedTable.id, selectedTable.status)}
                    className="h-9 lg:h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                    Limpiar
                  </button>
                  <button className="h-9 lg:h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[16px]">local_offer</span>
                    Descuento
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
