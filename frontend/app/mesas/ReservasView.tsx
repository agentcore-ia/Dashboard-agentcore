"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table } from "./PlanoView";

interface Reservation {
  id: string;
  table_id: string;
  client_name: string;
  client_phone?: string;
  pax: number;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  status: "confirmed" | "seated" | "cancelled";
  channel: "WhatsApp" | "Instagram" | "Teléfono";
}

const timeSlots = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"];

export default function ReservasView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [filter, setFilter] = useState("Todo");

  // Normalizes ISO datetime or plain time to "HH:MM"
  const toHHMM = (value: string): string => {
    if (!value) return "";
    // Already HH:MM format
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    // ISO datetime like 2026-04-04T21:00:00 or 2026-04-04T21:00:00-03:00
    const match = value.match(/(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
    return value;
  };

  const fetchTables = async () => {
    const { data } = await supabase.from('mesas').select('*');
    if (data) {
      // Filter out non-real tables: PARED, empty names, capacity 0 items (floor plan decorators)
      const realTables = (data as Table[]).filter(t =>
        t.name &&
        t.name.trim() !== '' &&
        !t.name.toUpperCase().startsWith('PARED') &&
        (t.capacity ?? 0) > 0
      );
      setTables(realTables);
    }
  };

  const fetchReservations = async () => {
    const { data } = await supabase.from('reservas').select('*');
    if (data) {
      // Normalize start_time and end_time to HH:MM for grid display
      const normalized = (data as Reservation[]).map(r => ({
        ...r,
        start_time: toHHMM(r.start_time),
        end_time: r.end_time ? toHHMM(r.end_time) : toHHMM(r.start_time) // fallback end = start + 1 slot
      }));
      setReservations(normalized);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchReservations();

    const tablesChannel = supabase.channel('realtime-mesas-reservas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        fetchTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        fetchReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
    };
  }, []);

  const selectedRes = reservations.find(r => r.id === selectedResId);
  const selectedTable = selectedRes ? tables.find(t => t.id === selectedRes.table_id) : null;

  // Simple function to calculate left/width based on time strings
  const getSlotPosition = (start: string, end: string) => {
    const startIndex = timeSlots.indexOf(start);
    const endIndex = timeSlots.indexOf(end);
    
    const validStart = startIndex >= 0 ? startIndex : 0;
    const validEnd = endIndex >= 0 ? endIndex : 2;
    
    return {
      left: `${validStart * 100}px`,
      width: `${(validEnd - validStart) * 100}px`
    };
  };

  const updateReservationStatus = async (id: string, status: "confirmed" | "seated" | "cancelled") => {
    await supabase.from('reservas').update({ status }).eq('id', id);
    if (status === "seated" && selectedTable) {
        // also update the table to occupied
        await supabase.from('mesas').update({ 
            status: 'occupied', 
            current_client: selectedRes?.client_name, 
            time_elapsed: '0 min' 
        }).eq('id', selectedTable.id);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-0">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container-low p-1 rounded-xl">
            {["Todo", "Interior", "Terraza", "Barra"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-800'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors">
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        </div>
        <div className="hidden md:flex bg-stone-100 px-3 py-1.5 rounded-full items-center gap-2 border border-stone-200">
          <span className="material-symbols-outlined text-stone-400 text-lg">search</span>
          <input className="bg-transparent border-none text-xs focus:ring-0 w-48 text-stone-800 placeholder-stone-400 outline-none" placeholder="Buscar mesa o cliente..." type="text"/>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-[500px] h-[65vh]">
        {/* Agenda Grid Container */}
        <div className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col shadow-sm border border-stone-200 relative">
          {/* Timeline Header */}
          <div className="flex border-b border-stone-100 shrink-0">
            <div className="w-32 flex-shrink-0 p-4 font-bold text-xs text-stone-500 bg-stone-50 border-r border-stone-100 flex items-center">
              Mesa / Zona
            </div>
            <div className="flex-1 flex overflow-x-auto no-scrollbar">
              {timeSlots.map(time => (
                <div key={time} className="flex-1 min-w-[100px] py-3 text-center text-[10px] font-black text-stone-400 border-r border-stone-100 uppercase tracking-widest shrink-0">
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* Grid Rows */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col">
            {/* Unassigned reservas (created via WhatsApp without a table_id) */}
            {(() => {
              const unassigned = reservations.filter(r => !r.table_id && r.status !== 'cancelled');
              if (unassigned.length === 0 || filter !== "Todo") return null;
              return (
                <div className="flex border-b-2 border-secondary/20 group bg-secondary/5 h-24 shrink-0 relative">
                  <div className="w-32 flex-shrink-0 p-4 bg-secondary/10 border-r border-secondary/20 flex flex-col justify-center z-20">
                    <span className="font-bold text-secondary text-sm whitespace-nowrap">Sin mesa</span>
                    <span className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest">WhatsApp · Sin asignar</span>
                  </div>
                  <div className="flex-1 relative overflow-hidden flex items-center gap-2 px-3">
                    {unassigned.map(res => {
                      const isSelected = selectedResId === res.id;
                      return (
                        <div
                          key={res.id}
                          onClick={() => setSelectedResId(res.id)}
                          className={`flex flex-col justify-center rounded-xl p-3 cursor-pointer transition-all shadow-sm h-16 min-w-[160px] bg-secondary text-white ${isSelected ? 'ring-2 ring-offset-2 ring-stone-900' : 'hover:scale-[1.02]'}`}
                        >
                          <p className="font-bold text-xs truncate">{res.client_name}</p>
                          <div className="flex items-center gap-1 opacity-80 mt-0.5">
                            <span className="material-symbols-outlined text-[10px]">person</span>
                            <span className="font-semibold text-[10px]">{res.pax}p</span>
                            <span className="mx-1">•</span>
                            <span className="font-semibold text-[10px]">{res.start_time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {tables.filter(t => filter === "Todo" || (t.zone ?? '').toLowerCase() === filter.toLowerCase()).map(table => {
              const tableRes = reservations.filter(r => r.table_id === table.id);

              return (
                <div key={table.id} className="flex border-b border-stone-100 group hover:bg-stone-50/50 transition-colors h-24 shrink-0 relative">
                  <div className="w-32 flex-shrink-0 p-4 bg-stone-50/50 border-r border-stone-100 flex flex-col justify-center z-20">
                    <span className="font-bold text-stone-800 text-sm whitespace-nowrap">{table.name}</span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{table.zone} · {table.capacity}p</span>
                  </div>
                  <div className="flex-1 relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAwIDBMMTAwIDEwMCIgc3Ryb2tlPSIjZjVmNWY0IiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')]">
                    {tableRes.map(res => {
                       const pos = getSlotPosition(res.start_time, res.end_time);
                       const isSelected = selectedResId === res.id;
                       
                       let bgClass = "bg-secondary text-white shadow-secondary/20";
                       if (res.status === "seated") bgClass = "bg-primary text-white shadow-primary/20";
                       if (res.status === "cancelled") bgClass = "bg-stone-200 text-stone-500 line-through opacity-60";
                       
                       return (
                         <div 
                           key={res.id}
                           onClick={() => setSelectedResId(res.id)}
                           className={`absolute top-2 bottom-2 rounded-xl p-3 flex flex-col justify-center cursor-pointer transition-all shadow-sm z-10 overflow-hidden group/res ${bgClass} ${isSelected ? 'ring-2 ring-offset-2 ring-stone-900 border-none' : 'border border-white/20 hover:scale-[1.02]'}`}
                           style={{ left: pos.left, width: pos.width }}
                         >
                            <p className="font-bold text-xs truncate max-w-full">{res.client_name}</p>
                            <div className="flex items-center gap-1 opacity-80 mt-0.5">
                               <span className="material-symbols-outlined text-[10px]">person</span>
                               <span className="font-semibold text-[10px]">{res.pax}p</span>
                               <span className="mx-1">•</span>
                               <span className="font-semibold text-[10px]">{res.start_time} - {res.end_time}</span>
                            </div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedRes && (
          <aside className="w-80 lg:w-96 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <div className="bg-surface-container-lowest p-6 lg:p-8 rounded-2xl shadow-lg border border-stone-200 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-extrabold font-headline text-on-surface">{selectedRes.client_name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest ${
                      selectedRes.status === 'confirmed' ? 'bg-secondary-container/50 text-secondary' :
                      selectedRes.status === 'seated' ? 'bg-primary/10 text-primary' :
                      'bg-stone-100 text-stone-500'
                    }`}>
                      {selectedRes.status === 'confirmed' ? 'Confirmada' : selectedRes.status === 'seated' ? 'Sentados' : 'Cancelada'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Por {selectedRes.channel}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedResId(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Horario</label>
                    <p className="text-lg font-headline font-extrabold text-on-surface">{selectedRes.start_time}</p>
                    <p className="text-xs text-stone-500 font-semibold">hasta {selectedRes.end_time}</p>
                  </div>
                  <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Mesa</label>
                     <p className="text-lg font-headline font-extrabold text-on-surface">{selectedTable?.name ?? 'Sin asignar'}</p>
                     <p className="text-xs text-stone-500 font-semibold">{selectedRes.pax} Personas</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Contacto</label>
                   <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                     <span className="material-symbols-outlined text-[16px] text-stone-400">call</span>
                     {selectedRes.client_phone || 'No registrado'}
                   </p>
                </div>

                {selectedRes.status === 'confirmed' && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <button 
                        onClick={() => updateReservationStatus(selectedRes.id, 'seated')}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-container transition-all active:scale-95 text-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                      Confirmar llegada (Sentar)
                    </button>
                    <button 
                        onClick={() => updateReservationStatus(selectedRes.id, 'cancelled')}
                        className="w-full text-stone-400 py-2 font-medium text-xs hover:text-red-600 transition-colors flex items-center justify-center gap-1 mt-2"
                    >
                       <span className="material-symbols-outlined text-sm">cancel</span>
                       Marcar No Show / Cancelar
                    </button>
                  </div>
                )}
                
                {selectedRes.status === 'seated' && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex gap-3 text-primary">
                        <span className="material-symbols-outlined">info</span>
                        <p className="text-xs font-medium">Los clientes ya han sido sentados. Las acciones de esta mesa se gestionan desde el plano principal.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
