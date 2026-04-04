"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

// Export standard interface
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
  // Detail info
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

  // Billing functionality
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

    const { data } = await supabase
      .from('reservas')
      .select('*')
      .gte('start_time', todayStr)
      .lt('start_time', tmrStr)
      .neq('status', 'cancelled');

    if (data) setReservations(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('available', true);
    if (data) setProducts(data);
  };

  useEffect(() => {
    fetchTables();
    fetchReservations();
    fetchProducts();

    const channel = supabase.channel('realtime-mesas-plano')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, fetchReservations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const isToday = !selectedDate || selectedDate.toDateString() === new Date().toDateString();

  const derivedTables = tables.map(table => {
    const res = reservations.find(r => r.table_id === table.id && r.status === 'confirmed');
    
    // For today, if it's occupied currently, we might want to prioritize occupied state
    // But for future dates, we should always show confirmed reservations as 'reserved' 
    // even if the table is currently "occupied" today.
    if (res && (!isToday || table.status === 'free')) {
      const timeMatch = res.start_time.match(/T(\d{2}:\d{2})/);
      const timeVal = timeMatch ? timeMatch[1] : (res.start_time.includes(':') ? res.start_time.split('T').pop().substring(0,5) : res.start_time);
      
      return {
        ...table,
        status: 'reserved' as const,
        reservation_time: timeVal,
        current_client: res.client_name,
        active_reserva_id: res.id
      };
    }
    // If we are looking at a future date but there's no reservation, it shouldn't show as occupied!
    if (!isToday && table.status === 'occupied') {
        return { ...table, status: 'free' as const, current_client: undefined, time_elapsed: undefined, current_bill: undefined };
    }

    return table;
  });

  const stats = {
    free: derivedTables.filter(t => t.status === "free" && t.shape !== "pared" && t.shape !== "puerta" && t.shape !== "terraza").length,
    reserved: derivedTables.filter(t => t.status === "reserved" && t.shape !== "pared" && t.shape !== "puerta" && t.shape !== "terraza").length,
    occupied: derivedTables.filter(t => t.status === "occupied" && t.shape !== "pared" && t.shape !== "puerta" && t.shape !== "terraza").length,
    total: derivedTables.filter(t => t.shape !== "pared" && t.shape !== "puerta" && t.shape !== "terraza").length,
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const selectedTable = derivedTables.find(t => t.id === selectedTableId);

  const updateTableStatus = async (id: string, status: "free" | "occupied" | "reserved", extras?: Partial<Table>, reservaConfig?: { id: string, status: 'seated' | 'cancelled' | 'completed' }) => {
    const { error } = await supabase.from('mesas').update({ status, ...extras }).eq('id', id);
    if (!error) {
      let finalExtras = { ...extras };
      if (reservaConfig) {
        await supabase.from('reservas').update({ status: reservaConfig.status }).eq('id', reservaConfig.id);
        finalExtras.active_reserva_id = null;
        finalExtras.reservation_time = null;
      }
      setTables(prev => prev.map(t => t.id === id ? { ...t, status, ...finalExtras } : t));
      if (reservaConfig) {
          // Re-fetch reservations so derivedTables logic updates if needed
          fetchReservations();
      }
    }
  };

  const addProductToTable = (product: any) => {
     if (!selectedTable) return;
     const currentItems = selectedTable.current_order_items || [];
     const existingItemIndex = currentItems.findIndex(item => item.product_id === product.id);
     
     let newItems;
     if (existingItemIndex >= 0) {
        newItems = [...currentItems];
        newItems[existingItemIndex].quantity += 1;
     } else {
        newItems = [...currentItems, {
           id: Math.random().toString(36).substring(7),
           product_id: product.id,
           name: product.name,
           price: parseFloat(product.price),
           quantity: 1,
           description: product.description
        }];
     }
     
     const newBill = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
     updateTableStatus(selectedTable.id, selectedTable.status, { current_order_items: newItems, current_bill: newBill });
     setIsMenuDrawerOpen(false);
  };

  const removeProductFromTable = (itemId: string) => {
     if (!selectedTable) return;
     const currentItems = selectedTable.current_order_items || [];
     const newItems = currentItems.filter(i => i.id !== itemId);
     const newBill = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
     updateTableStatus(selectedTable.id, selectedTable.status, { current_order_items: newItems, current_bill: newBill });
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full animate-in fade-in duration-300">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Libres</p>
            <p className="text-3xl font-extrabold font-headline text-tertiary">{stats.free}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-tertiary-fixed-dim/20 flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Reservadas</p>
            <p className="text-3xl font-extrabold font-headline text-secondary">{stats.reserved}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary-container/50 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined">event</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Ocupadas</p>
            <p className="text-3xl font-extrabold font-headline text-primary">{stats.occupied}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary-fixed/50 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">person_pin_circle</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Total Mesas</p>
            <p className="text-3xl font-extrabold font-headline text-on-surface">{stats.total}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">grid_view</span>
          </div>
        </div>
      </div>

      <div className="flex gap-6 min-h-[500px] h-[65vh] relative w-full">
        {/* Floor Plan Area */}
        <div className="flex-1 bg-surface-container rounded-2xl overflow-auto border border-stone-200 shadow-inner custom-scrollbar relative"
             onPointerDown={(e) => {
               if (e.target === e.currentTarget || (e.target as HTMLElement).id === "plano-canvas") {
                 setSelectedTableId(null);
               }
             }}
        >
          <div 
             id="plano-canvas"
             className="w-[1240px] h-[1000px] relative pointer-events-auto"
             style={{ backgroundImage: 'radial-gradient(#e6e2dc 1px, transparent 1px)', backgroundSize: '32px 32px' }}
          >
            {derivedTables.map(table => {
              const isSelected = selectedTableId === table.id;
              
              // --- Infraestructura rendering ---
              if (table.shape === 'pared' || table.shape === 'puerta') {
                  const isPuerta = table.shape === 'puerta';
                  return (
                    <div 
                      key={table.id}
                      className={`absolute flex items-center justify-center transition-all z-0 pointer-events-none select-none`}
                      style={{ 
                          left: table.x, top: table.y, width: table.w, height: table.h,
                          backgroundColor: isPuerta ? 'transparent' : '#a8a29e',
                          backgroundImage: isPuerta ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(168, 162, 158, 0.4) 10px, rgba(168, 162, 158, 0.4) 20px)' : 'none',
                          borderRadius: '8px'
                      }}
                    />
                  );
              }

              if (table.shape === 'terraza') {
                  return (
                    <div 
                      key={table.id}
                      className="absolute flex items-center justify-center font-bold text-stone-400 z-0 bg-transparent border-2 border-dashed border-stone-300 pointer-events-none select-none rounded-3xl"
                      style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
                    >
                      <span className="uppercase tracking-widest text-[10px] md:text-xs opacity-50 font-black px-4 text-center break-words">
                        {table.name || "ZONA TERRAZA"}
                      </span>
                    </div>
                  );
              }

              // --- Tables rendering ---
              let themeBase = "";
              let themeBorder = "";
              let labelBadge = "";
              
              if (table.status === "free") {
                themeBase = "bg-tertiary text-white";
                themeBorder = "border-tertiary/40";
                labelBadge = "Libre";
              } else if (table.status === "occupied") {
                themeBase = "bg-primary text-white";
                themeBorder = isSelected ? "border-primary-container" : "border-primary";
                labelBadge = "Ocupada";
              } else if (table.status === "reserved") {
                themeBase = "bg-secondary text-white";
                themeBorder = "border-secondary";
                labelBadge = "Reservada";
              }

              const isCircle = table.shape === "circle";
              const isBarra = table.shape === "barra";
              
              return (
                <div 
                  key={table.id}
                  onPointerDown={(e) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                  className={`absolute bg-surface-container-lowest border-4 flex flex-col items-center cursor-pointer hover:shadow-md transition-all active:scale-95 ${themeBorder} ${isCircle ? "rounded-full" : "rounded-xl"} ${isSelected ? "ring-8 ring-stone-900/5 shadow-lg z-10 scale-100" : "z-0 scale-95 hover:scale-100"}`}
                  style={{ 
                    left: `${table.x}px`, 
                    top: `${table.y}px`, 
                    width: `${table.w}px`, 
                    height: `${table.h}px`,
                    justifyContent: isBarra ? "space-between" : "center",
                    flexDirection: isBarra ? "row" : "column",
                    padding: isBarra ? "0 24px" : "0"
                  }}
                >
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${themeBase} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap shadow-sm`}>
                    {labelBadge} {isBarra && `- ${table.name}`}
                  </div>
                  
                  {isBarra ? (
                    <>
                      <div className="flex flex-col text-left">
                        <p className="font-extrabold text-on-surface font-headline">{table.current_client || "Sin Asignar"}</p>
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">chair_alt</span>
                          <span className="text-xs font-semibold">Barra</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">€{(table.current_bill || 0).toFixed(2)}</p>
                        <div className="flex items-center justify-end gap-1 text-primary">
                          <span className="material-symbols-outlined text-sm">timer</span>
                          <span className="text-xs font-bold">{table.time_elapsed || "00:00"}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-on-surface whitespace-nowrap">{table.name}</p>
                      {table.status === "occupied" && (
                        <>
                          <p className="text-[11px] font-bold text-on-surface-variant truncate w-full text-center px-1">{table.current_client || "Sin Cliente"}</p>
                          <div className="flex items-center gap-1 text-primary mt-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            <span className="text-xs font-bold">{table.time_elapsed || "00:00"}</span>
                          </div>
                        </>
                      )}
                      {table.status === "reserved" && (
                        <>
                          <p className="text-[11px] font-bold text-on-surface-variant truncate w-full text-center px-1">{table.current_client || "Reserva"}</p>
                          <div className="flex items-center gap-1 text-secondary mt-1">
                            <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                            <span className="text-xs font-bold">{table.reservation_time}</span>
                          </div>
                        </>
                      )}
                      {table.status === "free" && (
                        <div className="flex items-center gap-1 text-on-surface-variant mt-1">
                          <span className="material-symbols-outlined text-[14px]">groups</span>
                          <span className="text-xs font-semibold">{table.capacity} Pax</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side Detail Panel */}
        {selectedTable && (
          <aside className="w-80 lg:w-96 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <div className="bg-surface-container-lowest p-6 lg:p-8 rounded-2xl shadow-lg border border-stone-200 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-extrabold font-headline text-on-surface">{selectedTable.name}</h3>
                  <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest mt-2 ${
                    selectedTable.status === 'free' ? 'bg-tertiary-fixed-dim/20 text-tertiary' :
                    selectedTable.status === 'occupied' ? 'bg-primary/10 text-primary' :
                    'bg-secondary-container/50 text-secondary'
                  }`}>
                    {selectedTable.status === 'free' ? 'Libre' : selectedTable.status === 'occupied' ? 'Ocupada' : 'Reservada'}
                  </span>
                </div>
                <button onClick={() => setSelectedTableId(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {selectedTable.status === 'occupied' && (
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Reservation Banner (if applies) */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex gap-4 items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-red-700 shadow-sm shrink-0">
                      <span className="material-symbols-outlined text-lg">bookmark</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-0.5">LLEGADA DEL CLIENTE</p>
                      <p className="font-bold text-stone-800 text-sm leading-tight">{selectedTable.current_client}</p>
                      <p className="text-xs font-semibold text-stone-500">{selectedTable.time_elapsed || "0 min"}</p>
                    </div>
                  </div>

                  {/* Detalle de Consumo Header */}
                  <div className="flex justify-between items-center mb-3 text-stone-500 font-bold uppercase tracking-wider text-[10px] pb-2 border-b border-stone-100">
                    <span>Detalle de Consumo</span>
                    <span>{(selectedTable.current_order_items || []).reduce((acc, item) => acc + item.quantity, 0)} items</span>
                  </div>

                  {/* List of Items */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 py-2 pr-2">
                    {(selectedTable.current_order_items || []).length === 0 ? (
                      <div className="text-center text-stone-400 py-6 text-sm font-medium">No hay productos en la cuenta</div>
                    ) : (
                      (selectedTable.current_order_items || []).map((item) => (
                        <div key={item.id} className="flex gap-3 relative group">
                          <div className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex justify-center items-center font-bold text-xs shrink-0 border border-red-100 mt-0.5 group-hover:bg-red-100 transition-colors">
                             {item.quantity}
                          </div>
                          <div className="flex-1">
                             <p className="font-bold text-stone-800 leading-tight mb-0.5 text-sm">{item.name}</p>
                             {item.description && <p className="text-[11px] text-stone-500 leading-tight">{item.description}</p>}
                          </div>
                          <div className="font-bold text-stone-800 text-sm">
                             ${((item.price || 0) * item.quantity).toLocaleString('es-AR')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total to pay */}
                  <div className="flex justify-between items-end border-t border-dashed border-stone-200 mt-4 pt-4 mb-4 pb-2">
                     <span className="font-extrabold uppercase tracking-widest text-[#937b74] text-xs">Total a Pagar</span>
                     <span className="text-3xl font-black text-red-800 tracking-tight">${(selectedTable.current_bill || 0).toLocaleString('es-AR')}</span>
                  </div>

                  {/* Bottom Actions Sticky Section */}
                  <div className="bg-stone-50 -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 p-6 lg:p-8 pt-6">
                    {/* Horizontal Categories */}
                    <div className="flex overflow-x-auto gap-2 pb-4 custom-scrollbar snap-x mb-2 hide-scroll">
                      {uniqueCategories.map(cat => (
                        <button key={cat as string} onClick={() => { setActiveCategory(cat as string); setIsMenuDrawerOpen(true); }} className="snap-start shrink-0 px-4 py-1.5 rounded-full bg-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-300 transition-colors flex items-center gap-1.5 shadow-sm">
                          {cat === 'Pizzas' && <span className="material-symbols-outlined text-[14px]">local_pizza</span>}
                          {cat === 'Hamburguesas' && <span className="material-symbols-outlined text-[14px]">lunch_dining</span>}
                          {cat === 'Bebidas' && <span className="material-symbols-outlined text-[14px]">local_bar</span>}
                          {cat === 'Postres' && <span className="material-symbols-outlined text-[14px]">icecream</span>}
                          {cat as string}
                        </button>
                      ))}
                    </div>

                    <button onClick={() => { setActiveCategory(null); setIsMenuDrawerOpen(true); }} className="w-full bg-[#9f2a1c] text-white py-4 rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-[#852317] hover:scale-[1.02] shadow-xl shadow-red-900/20 active:scale-95 transition-all mb-4 text-sm">
                      <span className="material-symbols-outlined">add_circle</span>
                      Agregar producto
                    </button>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button onClick={() => setIsBillOpen(true)} className="bg-white py-3 rounded-2xl font-bold text-stone-700 shadow-sm border border-stone-200 hover:bg-stone-50 active:scale-95 transition-all text-xs flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar manual
                      </button>
                      <button onClick={() => updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: 0, current_order_items: [] })} className="bg-white py-3 rounded-2xl font-bold text-stone-700 shadow-sm border border-stone-200 hover:bg-stone-50 active:scale-95 transition-all text-xs flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Limpiar cuenta
                      </button>
                      <button className="bg-white py-3 rounded-2xl font-bold text-stone-700 shadow-sm border border-stone-200 hover:bg-stone-50 active:scale-95 transition-all text-xs flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">call_split</span>
                        Dividir cuenta
                      </button>
                      <button className="bg-white py-3 rounded-2xl font-bold text-stone-700 shadow-sm border border-stone-200 hover:bg-stone-50 active:scale-95 transition-all text-xs flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">transform</span>
                        Cambiar mesa
                      </button>
                    </div>

                    <button 
                      onClick={() => updateTableStatus(selectedTable.id, 'free', { current_client: null, time_elapsed: null, current_bill: null, current_order_items: null })}
                      className="w-full bg-[#00743b] text-white py-4 rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-[#005a2e] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-900/20 text-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">payments</span>
                      Cerrar cuenta
                    </button>
                  </div>
                </div>
              )}

              {selectedTable.status === 'free' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Capacidad Total</label>
                    <p className="text-lg font-bold text-on-surface flex items-center gap-2">
                       <span className="material-symbols-outlined text-stone-400">groups</span>
                       {selectedTable.capacity} Personas
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Siguiente Reserva</label>
                    <p className="text-sm font-medium text-stone-500">Sin reservas confirmadas hoy.</p>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <button 
                      onClick={() => updateTableStatus(selectedTable.id, 'occupied', { current_client: 'Cliente Caminante', time_elapsed: '0 min' })}
                      className="w-full bg-tertiary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-tertiary/20 hover:bg-tertiary-container transition-all active:scale-95 text-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Ocupar mesa
                    </button>
                  </div>
                </div>
              )}

              {selectedTable.status === 'reserved' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Cliente</label>
                    <p className="text-lg font-bold text-on-surface">{selectedTable.current_client}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Hora</label>
                      <p className="text-xl font-headline font-extrabold text-on-surface flex items-center gap-1">
                         <span className="material-symbols-outlined text-secondary text-sm">schedule</span>
                         {selectedTable.reservation_time}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <button 
                      onClick={() => {
                        if (selectedTable.active_reserva_id) {
                           updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', current_client: selectedTable.current_client }, { id: selectedTable.active_reserva_id, status: 'seated' });
                        } else {
                           updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', reservation_time: null });
                        }
                      }}
                      className="w-full bg-secondary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-secondary/20 hover:bg-secondary-container transition-all active:scale-95 text-sm"
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
                      className="w-full text-stone-400 py-2 font-medium text-xs hover:text-red-600 transition-colors flex items-center justify-center gap-1 mt-2"
                    >
                       <span className="material-symbols-outlined text-sm">cancel</span>
                       Cancelar reserva
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
      
      {/* Bill Slide-over / Modal */}
      {isBillOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-in fade-in">
          <div className="bg-surface-container-lowest p-6 rounded-2xl w-[400px] shadow-2xl relative">
            <button onClick={() => setIsBillOpen(false)} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800 rounded-full">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-xl font-extrabold font-headline mb-4">Mesa: {selectedTable.name}</h3>
            
            <div className="mb-6 flex flex-col gap-2">
              <label className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Cuenta Actual</label>
              <div className="text-4xl font-extrabold text-primary">€{(selectedTable.current_bill || 0).toFixed(2)}</div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Monto a agregar..."
                className="flex-1 px-4 py-3 border border-stone-200 rounded-xl outline-none focus:border-red-800 transition-colors"
                value={billAmountToAdd}
                onChange={(e) => setBillAmountToAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseFloat(billAmountToAdd);
                    if (!isNaN(val)) {
                      updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: (selectedTable.current_bill || 0) + val });
                      setBillAmountToAdd("");
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const val = parseFloat(billAmountToAdd);
                  if (!isNaN(val)) {
                    updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: (selectedTable.current_bill || 0) + val });
                    setBillAmountToAdd("");
                  }
                }}
                className="bg-primary text-white font-bold p-3 rounded-xl shadow hover:bg-primary-container active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined mt-1">add</span>
              </button>
            </div>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
               <button 
                  onClick={() => updateTableStatus(selectedTable.id, selectedTable.status, { current_bill: 0 })}
                  className="flex-1 py-2 font-bold text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 justify-center transition-colors"
               >
                 <span className="material-symbols-outlined text-[14px]">remove_shopping_cart</span>
                 Limpiar Cuenta
               </button>
               <button 
                  onClick={() => setIsBillOpen(false)}
                  className="flex-1 py-2 font-bold text-xs text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1 justify-center transition-colors"
               >
                 Cerrar
               </button>
            </div>
          </div>
        </div>
      )}
      {/* Menu Overlay Drawer */}
      {isMenuDrawerOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setIsMenuDrawerOpen(false)} />
          <div className="w-[450px] max-w-full bg-surface-container-lowest h-full relative shadow-2xl flex flex-col slide-in-from-right animate-in border-l border-stone-200 pointer-events-auto">
             <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-white z-10 sticky top-0">
               <div>
                  <h3 className="text-xl font-black font-headline text-stone-800">Menú de Productos</h3>
                  <p className="text-xs font-bold text-stone-400 mt-1 uppercase tracking-widest">Agregando a {selectedTable.name}</p>
               </div>
               <button onClick={() => setIsMenuDrawerOpen(false)} className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors">
                  <span className="material-symbols-outlined font-bold">close</span>
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto bg-stone-50/50 p-6">
                <div className="flex overflow-x-auto gap-2 pb-4 hide-scroll sticky top-0 bg-stone-50/50 pt-2 z-10 backdrop-blur-sm">
                   <button 
                      onClick={() => setActiveCategory(null)} 
                      className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm ${!activeCategory ? 'bg-red-800 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                   >
                     Todos
                   </button>
                   {uniqueCategories.map(cat => (
                      <button 
                        key={cat as string} 
                        onClick={() => setActiveCategory(cat as string)} 
                        className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm ${activeCategory === cat ? 'bg-red-800 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                      >
                        {cat as string}
                      </button>
                   ))}
                </div>

                <div className="grid gap-4 mt-2 mb-20">
                   {products
                      .filter(p => !activeCategory || p.category === activeCategory)
                      .map(p => (
                      <div key={p.id} onClick={() => addProductToTable(p)} className="bg-white border border-stone-200 rounded-2xl p-4 flex gap-4 cursor-pointer hover:border-red-300 hover:shadow-md transition-all group active:scale-[0.98]">
                         {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-stone-100" />
                         ) : (
                            <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 text-stone-400">
                               <span className="material-symbols-outlined text-3xl">fastfood</span>
                            </div>
                         )}
                         <div className="flex-1">
                            <div className="flex justify-between items-start gap-2">
                               <h4 className="font-bold text-stone-800 text-sm leading-tight">{p.name}</h4>
                               <span className="font-black text-red-700 text-sm whitespace-nowrap">${parseFloat(p.price).toLocaleString('es-AR')}</span>
                            </div>
                            {p.description && <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-snug">{p.description}</p>}
                         </div>
                         <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center self-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
