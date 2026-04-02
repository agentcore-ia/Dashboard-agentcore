"use client";

import { useState } from "react";
import { Table, initialTables } from "./PlanoView";

interface EditorPlanoViewProps {
  onClose: () => void;
}

export default function EditorPlanoView({ onClose }: EditorPlanoViewProps) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-screen w-full bg-surface text-on-surface animate-in fade-in zoom-in-95 duration-200">
      {/* TopNavBar */}
      <header className="w-full bg-stone-50/80 backdrop-blur-md shadow-sm z-50 flex justify-between items-center px-6 py-3 border-b border-stone-200">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold text-red-800 font-headline">Orden Pilot</span>
          <div className="h-6 w-px bg-stone-200 mx-2"></div>
          <h1 className="font-headline font-bold text-stone-800 text-lg tracking-tight">Editor de Plano</h1>
        </div>
        <nav className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-stone-500 hover:bg-stone-100 transition-colors rounded-full text-sm font-semibold">
            <span className="material-symbols-outlined text-sm">undo</span>
            <span>Deshacer</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-stone-500 hover:bg-stone-100 transition-colors rounded-full text-sm font-semibold">
            <span className="material-symbols-outlined text-sm">redo</span>
            <span>Rehacer</span>
          </button>
          <div className="flex items-center bg-stone-100 border border-stone-200 rounded-full px-2 mx-2">
            <button className="p-2 text-stone-500 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[18px]">remove_circle_outline</span></button>
            <span className="px-2 font-bold text-xs text-stone-700">85%</span>
            <button className="p-2 text-stone-500 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[18px]">add_circle_outline</span></button>
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-full text-sm font-bold shadow-md hover:bg-primary-container active:scale-95 transition-all">
            Guardar Plano
          </button>
        </nav>
      </header>

      <main className="flex-1 flex min-h-0 relative">
        {/* Left Panel: Elements */}
        <aside className="w-72 bg-stone-50 border-r border-stone-200 flex flex-col py-6 px-4 gap-6 overflow-y-auto shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div>
            <h2 className="font-headline text-lg font-extrabold text-stone-800 mb-4 px-2">Elementos</h2>
            <div className="space-y-6">
              <section>
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-3 px-2">Mesas</p>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-stone-200 hover:border-primary/50 hover:shadow-sm transition-all group shadow-sm">
                    <span className="material-symbols-outlined text-[28px] mb-2 text-stone-400 group-hover:text-primary transition-colors">square_foot</span>
                    <span className="text-xs font-semibold text-stone-700">Cuadrada</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-stone-200 hover:border-primary/50 hover:shadow-sm transition-all group shadow-sm">
                    <span className="material-symbols-outlined text-[28px] mb-2 text-stone-400 group-hover:text-primary transition-colors">radio_button_unchecked</span>
                    <span className="text-xs font-semibold text-stone-700">Redonda</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-stone-200 hover:border-primary/50 hover:shadow-sm transition-all group shadow-sm">
                    <span className="material-symbols-outlined text-[28px] mb-2 text-stone-400 group-hover:text-primary transition-colors">rectangle</span>
                    <span className="text-xs font-semibold text-stone-700">Familiar</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-stone-200 hover:border-primary/50 hover:shadow-sm transition-all group shadow-sm">
                    <span className="material-symbols-outlined text-[28px] mb-2 text-stone-400 group-hover:text-primary transition-colors">table_restaurant</span>
                    <span className="text-xs font-semibold text-stone-700">Alta</span>
                  </button>
                </div>
              </section>
              <section>
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-3 px-2">Infraestructura</p>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-xl hover:border-stone-300 transition-all shadow-sm">
                    <span className="material-symbols-outlined text-stone-400 text-lg">horizontal_rule</span>
                    <span className="text-xs font-bold text-stone-700">Pared / Divisor</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-xl hover:border-stone-300 transition-all shadow-sm">
                    <span className="material-symbols-outlined text-stone-400 text-lg">door_open</span>
                    <span className="text-xs font-bold text-stone-700">Puerta / Entrada</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-xl hover:border-stone-300 transition-all shadow-sm">
                    <span className="material-symbols-outlined text-stone-400 text-lg">liquor</span>
                    <span className="text-xs font-bold text-stone-700">Zona Barra</span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <section 
          className="flex-1 bg-stone-100/50 p-8 overflow-auto flex items-center justify-center relative cursor-crosshair min-h-0"
          onClick={() => setSelectedTableId(null)}
        >
          <div className="w-[1200px] h-[800px] bg-white rounded-2xl relative overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-stone-200"
               style={{ backgroundImage: 'radial-gradient(#d1cfca 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
            
            {tables.map(table => {
              const isSelected = selectedTableId === table.id;
              const isCircle = table.shape === "circle";
              const isBarra = table.shape === "barra";
              
              if (isBarra) {
                 return (
                   <div 
                     key={table.id}
                     onClick={(e) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                     className={`absolute flex items-center justify-center font-bold transition-shadow ${isSelected ? 'ring-2 ring-primary bg-primary/5 shadow-md z-20' : 'bg-stone-50 border-2 border-stone-200 text-stone-400 z-10'} cursor-move hover:border-primary/50`}
                     style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
                   >
                     <span className="uppercase tracking-widest text-xs opacity-50">{table.name}</span>
                     {isSelected && (
                      <>
                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nw-resize shadow-sm"></div>
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-ne-resize shadow-sm"></div>
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-sw-resize shadow-sm"></div>
                        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-se-resize shadow-sm"></div>
                      </>
                     )}
                   </div>
                 );
              }

              return (
                <div 
                  key={table.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedTableId(table.id); }}
                  className={`absolute flex items-center justify-center font-bold text-lg transition-all ${isCircle ? "rounded-full" : "rounded-xl"} ${
                    isSelected 
                      ? 'bg-primary/10 border-4 border-primary text-primary shadow-[0_0_20px_rgba(158,32,22,0.15)] z-20 scale-100' 
                      : 'bg-white border-2 border-stone-300 text-stone-500 z-10 scale-95 hover:border-stone-400 hover:scale-100'
                  } cursor-move`}
                  style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
                >
                  {table.name}
                  {isSelected && (
                    <>
                      <div className="absolute -top-3 -left-3 w-5 h-5 bg-white border-2 border-primary rounded-full cursor-nw-resize shadow-sm"></div>
                      <div className="absolute -top-3 -right-3 w-5 h-5 bg-white border-2 border-primary rounded-full cursor-ne-resize shadow-sm"></div>
                      <div className="absolute -bottom-3 -left-3 w-5 h-5 bg-white border-2 border-primary rounded-full cursor-sw-resize shadow-sm"></div>
                      <div className="absolute -bottom-3 -right-3 w-5 h-5 bg-white border-2 border-primary rounded-full cursor-se-resize shadow-sm"></div>
                      
                      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex bg-stone-800 rounded-full p-1 gap-1 shadow-xl whitespace-nowrap">
                        <button className="p-1.5 text-white hover:text-primary transition-colors flex items-center justify-center rounded-full"><span className="material-symbols-outlined text-[18px]">content_copy</span></button>
                        <button className="p-1.5 text-white hover:text-primary transition-colors flex items-center justify-center rounded-full"><span className="material-symbols-outlined text-[18px]">rotate_right</span></button>
                        <button className="p-1.5 text-red-400 hover:text-red-300 transition-colors flex items-center justify-center rounded-full"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Helper grid numbers (Decorative) */}
            <div className="absolute bottom-4 left-4 text-[10px] text-stone-300 font-mono font-bold tracking-widest shadow-sm">
               GRID 32px
            </div>
          </div>
        </section>

        {/* Right Panel: Settings */}
        <aside className="w-80 bg-stone-50 border-l border-stone-200 flex flex-col py-6 px-6 gap-8 overflow-y-auto shrink-0 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
          {selectedTable ? (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-headline text-lg font-extrabold text-stone-800">{selectedTable.name}</h2>
                <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-[10px] font-black rounded-full tracking-widest uppercase">Select</span>
              </div>
              <p className="text-xs text-stone-500 mb-6 pb-4 border-b border-stone-200 font-medium">Ajusta los detalles de la mesa.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2 ml-1">Identificador</label>
                  <input 
                    className="w-full bg-white border border-stone-200 shadow-sm rounded-xl focus:ring-2 focus:border-primary focus:ring-primary/20 hover:border-stone-300 py-3 px-4 font-black tracking-tight text-stone-800 transition-all outline-none" 
                    type="text" 
                    defaultValue={selectedTable.name}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2 ml-1">Capacidad (Pax)</label>
                  <div className="flex items-center bg-white border border-stone-200 shadow-sm rounded-xl overflow-hidden hover:border-stone-300 transition-all">
                    <button className="p-3 text-primary hover:bg-stone-50 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">remove</span>
                    </button>
                    <input className="w-full text-center border-0 bg-transparent py-3 font-black text-xl tracking-tighter focus:ring-0 text-stone-800 outline-none" type="number" defaultValue={selectedTable.capacity} />
                    <button className="p-3 text-primary hover:bg-stone-50 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2 ml-1">Zona Asignada</label>
                  <div className="relative">
                    <select className="w-full bg-white border border-stone-200 shadow-sm rounded-xl focus:ring-2 focus:border-primary focus:ring-primary/20 hover:border-stone-300 py-3 px-4 font-bold text-stone-800 appearance-none transition-all outline-none">
                      <option selected={selectedTable.zone === "Interior"}>Interior</option>
                      <option selected={selectedTable.zone === "Terraza"}>Terraza</option>
                      <option selected={selectedTable.zone === "Barra"}>Barra</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">expand_content</span>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-stone-200">
                  <button className="w-full flex items-center justify-center gap-2 py-3 text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 hover:border-red-200 transition-all text-sm font-bold shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Eliminar Mesa
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <span className="material-symbols-outlined text-4xl text-stone-400 mb-4">touch_app</span>
              <p className="text-sm font-bold text-stone-500 text-center uppercase tracking-widest px-8">Selecciona una mesa en el plano para editarla</p>
            </div>
          )}

          {/* Contextual Help */}
          <div className="mt-auto p-4 bg-orange-50/80 rounded-xl border border-orange-100">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-[20px]">lightbulb</span>
              <p className="text-[11px] text-orange-900 leading-relaxed font-medium">
                <strong className="block mb-1 font-bold">Consejo:</strong> 
                Arrastra los elementos desde el panel izquierdo. Usa las esquinas para redimensionar con precisión.
              </p>
            </div>
          </div>
        </aside>
      </main>
      
      {/* Footer Action Bar */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-stone-900/95 backdrop-blur-xl px-2 py-2 pr-6 rounded-full shadow-2xl border border-stone-800/50 z-[100]">
        <button onClick={onClose} className="text-stone-300 font-bold tracking-tight text-sm px-6 py-2 hover:text-white hover:bg-stone-800 rounded-full transition-colors h-10 flex items-center">
          Cancelar
        </button>
        <button onClick={onClose} className="px-8 h-10 bg-primary text-white rounded-full font-extrabold text-sm shadow-[0_0_15px_rgba(158,32,22,0.4)] hover:bg-primary-container hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check</span>
          Guardar Cambios
        </button>
      </footer>
    </div>
  );
}
