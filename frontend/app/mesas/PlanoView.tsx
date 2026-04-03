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
}

export default function PlanoView() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const fetchTables = async () => {
    const { data, error } = await supabase.from('mesas').select('*');
    if (!error && data) {
      setTables(data as Table[]);
    }
  };

  useEffect(() => {
    fetchTables();

    const channel = supabase.channel('realtime-mesas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchTables();
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Table;
          setTables(prev => prev.map(t => t.id === updated.id ? updated : t));
        } else if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = {
    free: tables.filter(t => t.status === "free").length,
    reserved: tables.filter(t => t.status === "reserved").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    total: tables.length,
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  const updateTableStatus = async (id: string, status: "free" | "occupied" | "reserved", extras?: Partial<Table>) => {
    const { error } = await supabase.from('mesas').update({ status, ...extras }).eq('id', id);
    if (!error) {
      setTables(prev => prev.map(t => t.id === id ? { ...t, status, ...extras } : t));
    }
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
            {tables.map(table => {
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
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Cliente</label>
                     <p className="text-lg font-bold text-on-surface">{selectedTable.current_client}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Tiempo</label>
                      <p className="text-xl font-headline font-extrabold text-on-surface">{selectedTable.time_elapsed || "00:00"}</p>
                    </div>
                    <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Cuenta</label>
                       <p className="text-xl font-headline font-extrabold text-primary">€{(selectedTable.current_bill || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 p-4 rounded-xl flex gap-3 border border-indigo-100">
                    <span className="material-symbols-outlined text-indigo-500">auto_awesome</span>
                    <p className="text-xs leading-relaxed text-indigo-900 font-medium">
                      <span className="font-bold flex mb-1">Predicción AI</span>
                      Mesa libre en <span className="font-extrabold text-indigo-600">25 min</span> basado en sus pedidos y ritmo de la zona.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <button 
                      onClick={() => updateTableStatus(selectedTable.id, 'free', { current_client: null, time_elapsed: null, current_bill: null })}
                      className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-container transition-all active:scale-95 text-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Finalizar mesa
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="bg-stone-50 py-3 rounded-xl font-bold text-stone-600 flex flex-col items-center gap-1 hover:bg-stone-100 transition-colors border border-stone-200 text-xs shadow-sm">
                        <span className="material-symbols-outlined text-stone-500">move_up</span>
                        Cambiar
                      </button>
                      <button className="bg-stone-50 py-3 rounded-xl font-bold text-stone-600 flex flex-col items-center gap-1 hover:bg-stone-100 transition-colors border border-stone-200 text-xs shadow-sm">
                        <span className="material-symbols-outlined text-stone-500">receipt_long</span>
                        Cuenta
                      </button>
                    </div>
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
                      onClick={() => updateTableStatus(selectedTable.id, 'occupied', { time_elapsed: '0 min', reservation_time: null })}
                      className="w-full bg-secondary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-secondary/20 hover:bg-secondary-container transition-all active:scale-95 text-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      Sentar clientes
                    </button>
                    <button 
                      onClick={() => updateTableStatus(selectedTable.id, 'free', { current_client: null, reservation_time: null })}
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
    </div>
  );
}
