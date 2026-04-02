"use client";

import { useState } from "react";
import { Table, initialTables } from "./PlanoView";

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

const mockReservations: Reservation[] = [
  { id: "r1", table_id: "1", client_name: "Familia Ortiz", client_phone: "+34 622 123 456", pax: 4, start_time: "18:00", end_time: "19:30", status: "confirmed", channel: "WhatsApp" },
  { id: "r2", table_id: "3", client_name: "Perez G.", pax: 4, start_time: "19:30", end_time: "20:30", status: "cancelled", channel: "WhatsApp" },
  { id: "r3", table_id: "4", client_name: "Sr. Ruiz", pax: 6, start_time: "20:30", end_time: "22:00", status: "confirmed", channel: "Teléfono" },
];

const timeSlots = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"];

export default function ReservasView() {
  const [reservations, setReservations] = useState<Reservation[]>(mockReservations);
  const [selectedResId, setSelectedResId] = useState<string | null>("r1");
  const [filter, setFilter] = useState("Todo");

  const selectedRes = reservations.find(r => r.id === selectedResId);
  const selectedTable = selectedRes ? initialTables.find(t => t.id === selectedRes.table_id) : null;

  // Simple function to calculate left/width based on time strings
  const getSlotPosition = (start: string, end: string) => {
    const startIndex = timeSlots.indexOf(start);
    const endIndex = timeSlots.indexOf(end);
    
    // Fallbacks if time not exactly matching slots (simplified for UI demonstration)
    const validStart = startIndex >= 0 ? startIndex : 0;
    const validEnd = endIndex >= 0 ? endIndex : 2;
    
    // Each column is 100px min width 
    return {
      left: `${validStart * 100}px`,
      width: `${(validEnd - validStart) * 100}px`
    };
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
            {initialTables.filter(t => filter === "Todo" || t.zone === filter).map(table => {
              const tableRes = reservations.filter(r => r.table_id === table.id);

              return (
                <div key={table.id} className="flex border-b border-stone-100 group hover:bg-stone-50/50 transition-colors h-24 shrink-0 relative">
                  <div className="w-32 flex-shrink-0 p-4 bg-stone-50/50 border-r border-stone-100 flex flex-col justify-center z-20">
                    <span className="font-bold text-stone-800">{table.name}</span>
                    <span className="text-[10px] text-stone-500">{table.zone} · {table.capacity}pax</span>
                  </div>
                  
                  <div className="flex-1 flex relative overflow-x-auto no-scrollbar">
                    {/* Background Grid Lines rendering */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timeSlots.map(time => (
                        <div key={time} className="flex-1 min-w-[100px] border-r border-stone-100 shrink-0"></div>
                      ))}
                    </div>

                    {/* Reservation Blocks */}
                    {tableRes.map(res => {
                       const pos = getSlotPosition(res.start_time, res.end_time);
                       const isSelected = selectedResId === res.id;
                       const isCancelled = res.status === "cancelled";
                       
                       let bgClass = "bg-green-50 border-green-500 text-green-700 hover:bg-green-100";
                       if (isCancelled) bgClass = "bg-red-50 border-red-500 text-red-700 hover:bg-red-100 opacity-80";
                       else if (isSelected) bgClass = "bg-primary/10 border-primary text-primary shadow-sm";

                       return (
                         <div 
                           key={res.id}
                           onClick={() => setSelectedResId(res.id)}
                           className={`absolute top-2 bottom-2 z-10 p-1 shrink-0 cursor-pointer`}
                           style={{ left: pos.left, width: pos.width }}
                         >
                           <div className={`h-full border-l-4 rounded-lg p-2 transition-all ${bgClass} ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.02]'}`}>
                             <div className="flex justify-between items-start">
                               <span className="text-[11px] font-bold truncate">{res.client_name}</span>
                               {isCancelled && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold">Canc.</span>}
                             </div>
                             <div className="flex items-center gap-1 mt-1 opacity-80">
                               <span className="material-symbols-outlined text-[14px]">group</span>
                               <span className="text-[10px] font-bold">{res.pax} pax</span>
                             </div>
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

        {/* Right Detail Panel */}
        {selectedRes && selectedTable && (
          <aside className="w-80 lg:w-96 flex-shrink-0 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white rounded-2xl shadow-lg border border-stone-200 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="bg-primary p-6 text-white rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold font-headline">{selectedRes.client_name}</h3>
                    <div className="flex items-center gap-2 text-xs font-semibold opacity-90 mt-2">
                       <span className="material-symbols-outlined text-[16px]">phone</span>
                       {selectedRes.client_phone || 'Sin teléfono'}
                    </div>
                  </div>
                  <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                    <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Capacidad</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined text-primary text-lg">groups</span>
                      <span className="font-bold text-stone-800">{selectedRes.pax} Personas</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Hora</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined text-primary text-lg">schedule</span>
                      <span className="font-bold text-stone-800">{selectedRes.start_time} - {selectedRes.end_time}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Ubicación</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined text-primary text-lg">restaurant</span>
                      <span className="font-bold text-stone-800">{selectedTable.name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Canal</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">AI</div>
                      <span className="font-bold text-stone-800">{selectedRes.channel}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-2">
                  <button className="w-full py-3 bg-tertiary text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-tertiary-container transition-all active:scale-95">
                     <span className="material-symbols-outlined text-[18px]">check_circle</span>
                     Confirmar llegada
                  </button>
                  <button className="w-full py-3 bg-stone-50 border border-stone-200 text-stone-800 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-100 transition-all active:scale-95 shadow-sm">
                     <span className="material-symbols-outlined text-[18px]">chair</span>
                     Sentar cliente
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
               <button className="w-full py-3 px-4 bg-stone-50 border border-stone-200 text-stone-600 rounded-xl font-bold flex items-center gap-3 hover:bg-stone-100 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                  Cambiar mesa
               </button>
               <button className="w-full py-3 px-4 bg-stone-50 border border-stone-200 text-stone-600 rounded-xl font-bold flex items-center gap-3 hover:bg-stone-100 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Editar reserva
               </button>
               <button className="w-full py-3 px-4 bg-red-50 border border-red-100 text-red-600 rounded-xl font-bold flex items-center gap-3 hover:bg-red-100 transition-all shadow-sm mt-2">
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Cancelar reserva
               </button>
            </div>
            
            {/* Ad/Tip Section */}
            <div className="mt-auto p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-900 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl"></div>
               <div className="flex gap-3 relative z-10">
                  <span className="material-symbols-outlined text-[24px] text-indigo-500">auto_awesome</span>
                  <div>
                     <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">Optimización IA</p>
                     <p className="text-xs leading-relaxed font-medium">Hemos detectado que puedes reorganizar 3 mesas para acomodar un grupo de 10 a las 21:00.</p>
                  </div>
               </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
