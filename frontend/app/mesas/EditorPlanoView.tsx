"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table } from "./PlanoView";

interface EditorPlanoViewProps {
  onClose: () => void;
}

export default function EditorPlanoView({ onClose }: EditorPlanoViewProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [deletedTableIds, setDeletedTableIds] = useState<string[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTables = async () => {
      const { data } = await supabase.from('mesas').select('*');
      if (data) setTables(data as Table[]);
    };
    fetchTables();
  }, []);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  // -- Drag & Drop from Sidebar --
  const handleDragStart = (e: React.DragEvent, shapeCode: string) => {
    e.dataTransfer.setData("shape", shapeCode);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const shape = e.dataTransfer.getData("shape");
    if (!shape) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate position inside canvas, considering scroll
    const x = e.clientX - rect.left + (canvasRef.current?.scrollLeft || 0);
    const y = e.clientY - rect.top + (canvasRef.current?.scrollTop || 0);

    const snap = 32;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;

    let width = 96;
    let height = 96;
    let defaultName = `Mesa ${tables.length + 1}`;
    let capacity = shape === 'circle' ? 2 : 4;

    if (shape === 'rectangle') { width = 128; height = 96; }
    else if (shape === 'barra') { width = 256; height = 64; defaultName = "ZONA BARRA"; capacity = 0; }
    else if (shape === 'pared') { width = 256; height = 16; defaultName = "PARED"; capacity = 0; }
    else if (shape === 'puerta') { width = 96; height = 16; defaultName = "PUERTA"; capacity = 0; }
    else if (shape === 'terraza') { width = 256; height = 256; defaultName = "ZONA TERRAZA"; capacity = 0; }

    const newTable: Table = {
      id: crypto.randomUUID(), // Assuming DB accepts UUID
      name: defaultName,
      capacity: capacity,
      shape: shape as any,
      status: "free",
      x: snappedX,
      y: snappedY,
      w: width,
      h: height,
      zone: "Interior"
    };
    
    setTables(prev => [...prev, newTable]);
    setSelectedTableId(newTable.id);
  };

  // -- Moving an existing table --
  const handlePointerDownMove = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click
    setSelectedTableId(id);

    const table = tables.find(t => t.id === id);
    if (!table) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialT = { x: table.x, y: table.y };
    
    const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const snap = 32;
        const newX = Math.max(0, Math.round((initialT.x + dx) / snap) * snap);
        const newY = Math.max(0, Math.round((initialT.y + dy) / snap) * snap);
        
        setTables(prev => prev.map(t => t.id === id ? { ...t, x: newX, y: newY } : t));
    };

    const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // -- Resize Handler --
  const handleResizePointerDown = (e: React.PointerEvent, id: string, corner: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const table = tables.find(t => t.id === id);
    if (!table) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialT = { x: table.x, y: table.y, w: table.w, h: table.h };
    const snap = 32;

    const onPointerMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        
        let newX = initialT.x;
        let newY = initialT.y;
        let newW = initialT.w;
        let newH = initialT.h;

        if (corner.includes('e')) newW = Math.max(snap, Math.round((initialT.w + dx) / snap) * snap);
        if (corner.includes('s')) newH = Math.max(snap, Math.round((initialT.h + dy) / snap) * snap);
        
        if (corner.includes('w')) {
            const potentialW = Math.max(snap, Math.round((initialT.w - dx) / snap) * snap);
            if (potentialW !== initialT.w) {
                newX = initialT.x + (initialT.w - potentialW);
                newW = potentialW;
            }
        }
        
        if (corner.includes('n')) {
            const potentialH = Math.max(snap, Math.round((initialT.h - dy) / snap) * snap);
            if (potentialH !== initialT.h) {
                newY = initialT.y + (initialT.h - potentialH);
                newH = potentialH;
            }
        }

        setTables(prev => prev.map(t => t.id === id ? { ...t, x: newX, y: newY, w: newW, h: newH } : t));
    };

    const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // -- Quick Actions --
  const handleDuplicate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedTable) return;
    const newTable: Table = {
      ...selectedTable,
      id: crypto.randomUUID(),
      name: `${selectedTable.name} (Copia)`,
      x: selectedTable.x + 32,
      y: selectedTable.y + 32,
    };
    setTables(prev => [...prev, newTable]);
    setSelectedTableId(newTable.id);
  };

  const handleRotate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedTable) return;
    setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, w: t.h, h: t.w } : t));
  };

  const handleDelete = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    setDeletedTableIds(prev => [...prev, id]);
    if (selectedTableId === id) setSelectedTableId(null);
  };

  const updateSelectedField = (field: keyof Table, value: any) => {
    if (!selectedTableId) return;
    setTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, [field]: value } : t));
  };

  const saveChanges = async () => {
    setIsSaving(true);
    
    try {
      // 1. Delete removed tables
      if (deletedTableIds.length > 0) {
        await supabase.from('mesas').delete().in('id', deletedTableIds);
      }

      // 2. Upsert/Update remaining tables
      const promises = tables.map(t => supabase.from('mesas').upsert({ 
          id: t.id,
          x: t.x, y: t.y, w: t.w, h: t.h, 
          name: t.name, capacity: t.capacity, zone: t.zone, shape: t.shape,
          status: t.status 
      }, { onConflict: 'id' }));
      
      await Promise.all(promises);
    } catch(err) {
      console.error(err);
    }

    setIsSaving(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#fdfaf7] text-stone-800 animate-in fade-in zoom-in-95 duration-200">
      {/* TopNavBar */}
      <header className="w-full bg-[#fdfaf7] z-50 flex justify-between items-center px-6 py-4 border-b border-stone-200 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black text-primary font-headline tracking-tight">Orden Pilot</span>
          <div className="h-6 w-px bg-stone-300 mx-1"></div>
          <h1 className="font-headline font-extrabold text-stone-900 text-lg tracking-tight">Editor de Plano</h1>
        </div>
        <nav className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-stone-500 hover:text-stone-800 transition-colors rounded-full text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">undo</span>
            <span>Deshacer</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-stone-500 hover:text-stone-800 transition-colors rounded-full text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">redo</span>
            <span>Rehacer</span>
          </button>
          <div className="flex items-center bg-stone-200/50 rounded-full px-2 mx-4 h-10 border border-stone-200">
            <button className="p-1 text-stone-600 hover:text-stone-900 transition-colors"><span className="material-symbols-outlined text-[18px]">remove</span></button>
            <span className="px-3 font-extrabold text-xs text-stone-800">85%</span>
            <button className="p-1 text-stone-600 hover:text-stone-900 transition-colors"><span className="material-symbols-outlined text-[18px]">add</span></button>
          </div>
          <button onClick={saveChanges} disabled={isSaving} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-container active:scale-95 transition-all disabled:opacity-50">
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </nav>
      </header>

      <main className="flex-1 flex min-h-0 relative">
        {/* Left Panel: Elements */}
        <aside className="w-[300px] bg-[#fdfaf7] border-r border-stone-200 flex flex-col py-8 px-6 gap-8 overflow-y-auto shrink-0 z-10">
          <div>
            <h2 className="font-headline text-lg font-black text-stone-900 mb-6 font-bold">Elementos</h2>
            
            <div className="space-y-8">
              {/* Tables Section */}
              <section>
                <p className="text-[10px] uppercase tracking-widest font-black text-stone-400 mb-4 px-1">Mesas</p>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing shadow-sm"
                    draggable onDragStart={(e) => handleDragStart(e, 'square')}
                  >
                    <span className="material-symbols-outlined text-4xl mb-3 text-stone-600">square_foot</span>
                    <span className="text-[11px] font-bold text-stone-600">Cuadrada</span>
                  </div>
                  <div 
                    className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing shadow-sm"
                    draggable onDragStart={(e) => handleDragStart(e, 'circle')}
                  >
                    <span className="material-symbols-outlined text-4xl mb-3 text-stone-600">radio_button_unchecked</span>
                    <span className="text-[11px] font-bold text-stone-600">Redonda</span>
                  </div>
                  <div 
                    className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing shadow-sm"
                    draggable onDragStart={(e) => handleDragStart(e, 'rectangle')}
                  >
                    <span className="material-symbols-outlined text-4xl mb-3 text-stone-600">rectangle</span>
                    <span className="text-[11px] font-bold text-stone-600">Familiar</span>
                  </div>
                  <div 
                    className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing shadow-sm"
                    draggable onDragStart={(e) => handleDragStart(e, 'tall')}
                  >
                    <span className="material-symbols-outlined text-4xl mb-3 text-stone-600">table_restaurant</span>
                    <span className="text-[11px] font-bold text-stone-600">Alta</span>
                  </div>
                </div>
              </section>

              {/* Infrastructure Section */}
              <section>
                <p className="text-[10px] uppercase tracking-widest font-black text-stone-400 mb-4 px-1">Infraestructura</p>
                <div className="flex flex-col gap-3">
                  <div 
                    draggable onDragStart={(e) => handleDragStart(e, 'pared')}
                    className="flex items-center gap-4 p-4 bg-white rounded-full border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                  >
                    <span className="material-symbols-outlined text-stone-600 text-xl pl-2">horizontal_rule</span>
                    <span className="text-xs font-bold text-stone-600">Pared</span>
                  </div>
                  <div 
                    draggable onDragStart={(e) => handleDragStart(e, 'puerta')}
                    className="flex items-center gap-4 p-4 bg-white rounded-full border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                  >
                    <span className="material-symbols-outlined text-stone-600 text-xl pl-2">door_open</span>
                    <span className="text-xs font-bold text-stone-600">Puerta / Entrada</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-full border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all" draggable onDragStart={(e) => handleDragStart(e, 'barra')}>
                    <span className="material-symbols-outlined text-stone-600 text-xl pl-2">liquor</span>
                    <span className="text-xs font-bold text-stone-600">Zona Barra</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-full border border-stone-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all" draggable onDragStart={(e) => handleDragStart(e, 'terraza')}>
                    <span className="material-symbols-outlined text-stone-600 text-xl pl-2">deck</span>
                    <span className="text-xs font-bold text-stone-600">Terraza</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <section 
          className="flex-1 bg-stone-100/50 p-10 overflow-auto flex items-center justify-center relative min-h-0"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedTableId(null);
            }
          }}
        >
          <div 
            ref={canvasRef}
            className="w-[1240px] h-[1000px] bg-white rounded-xl relative shadow-sm border border-stone-200"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedTableId(null);
              }
            }}
            style={{ 
                backgroundImage: 'radial-gradient(#e5e5e5 2px, transparent 2px)', 
                backgroundSize: '32px 32px' 
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {tables.map(table => {
              const isSelected = selectedTableId === table.id;
              const isCircle = table.shape === "circle";
              const isBarra = table.shape === "barra";
              
              if (isBarra || table.shape === 'terraza') {
                 return (
                   <div 
                     key={table.id}
                     onPointerDown={(e) => handlePointerDownMove(e, table.id)}
                     className={`absolute flex items-center justify-center font-bold transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5 z-20' : 'bg-transparent border-2 border-dashed border-stone-300 text-stone-400 z-10'} cursor-move hover:border-stone-400 select-none rounded-3xl`}
                     style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
                   >
                     <span className="uppercase tracking-widest text-[10px] md:text-xs opacity-50 font-black px-4 text-center break-words">{table.name || (isBarra ? "ZONA DE BARRA" : "ZONA TERRAZA")}</span>
                     
                     {/* Resize handles */}
                     {isSelected && (
                         <>
                           <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'nw')} className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize"></div>
                           <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'ne')} className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize"></div>
                           <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'sw')} className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize"></div>
                           <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'se')} className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize"></div>
                         </>
                     )}
                   </div>
                 );
              }

              if (table.shape === 'pared' || table.shape === 'puerta') {
                  const isPuerta = table.shape === 'puerta';
                  return (
                    <div 
                      key={table.id}
                      onPointerDown={(e) => handlePointerDownMove(e, table.id)}
                      className={`absolute flex items-center justify-center transition-all ${isSelected ? 'ring-2 ring-primary z-20' : 'z-10'} cursor-move select-none`}
                      style={{ 
                          left: table.x, 
                          top: table.y, 
                          width: table.w, 
                          height: table.h,
                          backgroundColor: isPuerta ? 'transparent' : '#a8a29e', // stone-400 for pared
                          backgroundImage: isPuerta ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(168, 162, 158, 0.4) 10px, rgba(168, 162, 158, 0.4) 20px)' : 'none',
                          borderRadius: '8px'
                      }}
                    >
                      {/* Name optionally shown on hover or when selected if needed, otherwise hidden for clean layout */}
                      {isSelected && (
                          <span className="absolute -top-6 text-[10px] font-bold text-stone-400 uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded">{table.name}</span>
                      )}

                      {/* Resize handles */}
                      {isSelected && (
                          <>
                            <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'w')} className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-ew-resize"></div>
                            <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'e')} className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-ew-resize"></div>
                          </>
                      )}
                    </div>
                  );
              }

              return (
                <div 
                  key={table.id}
                  className="absolute"
                  style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
                >
                  <div 
                    onPointerDown={(e) => handlePointerDownMove(e, table.id)}
                    className={`w-full h-full flex items-center justify-center font-bold text-sm ${isCircle ? "rounded-full" : "rounded-[24px]"} ${
                      isSelected 
                        ? 'bg-primary/5 border-[3px] border-primary text-primary shadow-[0_0_20px_rgba(158,32,22,0.15)] z-20' 
                        : 'bg-[#e9e8e5] border-0 text-stone-600 z-10 hover:bg-[#dfddda]'
                    } transition-all duration-75 cursor-move select-none`}
                  >
                    {table.name}
                  </div>

                  {isSelected && (
                      <>
                        {/* Corner Handles */}
                        <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'nw')} className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-30"></div>
                        <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'ne')} className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-30"></div>
                        <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'sw')} className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-30"></div>
                        <div onPointerDown={(e) => handleResizePointerDown(e, table.id, 'se')} className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-30"></div>
                        
                        {/* Floating Action Menu attached strictly to the element */}
                        <div className="absolute top-[100%] left-1/2 -translate-x-1/2 mt-3 bg-stone-800 text-stone-300 rounded-full flex gap-3 px-4 py-2.5 z-40 shadow-xl border border-stone-700/50">
                           <button onClick={handleDuplicate} className="hover:text-white transition-colors flex items-center" title="Duplicar"><span className="material-symbols-outlined text-[16px]">content_copy</span></button>
                           <button onClick={handleRotate} className="hover:text-white transition-colors flex items-center" title="Rotar"><span className="material-symbols-outlined text-[16px]">cached</span></button>
                           <button onClick={() => handleDelete(table.id)} className="hover:text-white transition-colors flex items-center" title="Eliminar"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                        </div>
                      </>
                  )}
                </div>
              );
            })}

            {/* Coordinates overlay helper */}
            <div className="absolute bottom-6 left-6 text-[10px] text-stone-400 font-mono font-bold tracking-widest pointer-events-none">
               .X: {selectedTable?.x || 0} Y: {selectedTable?.y || 0}
            </div>
          </div>
        </section>

        {/* Right Panel: Settings */}
        <aside className="w-[360px] bg-[#fdfaf7] border-l border-stone-200 flex flex-col py-8 px-6 gap-6 overflow-y-auto shrink-0 z-10">
          {selectedTable ? (
            <div className="animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-headline text-2xl font-black text-stone-900">{selectedTable.name}</h2>
                <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full tracking-wider uppercase">SELECCIONADA</span>
              </div>
              <p className="text-xs text-stone-600 mb-8 pb-6 border-b border-stone-200 font-medium">Ajusta los detalles del elemento seleccionado.</p>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-[11px] font-black text-stone-800 mb-2 ml-1">Identificador</label>
                  <input 
                    className="w-full bg-white border border-stone-200 shadow-sm rounded-xl py-4 px-4 font-bold text-lg text-stone-900 transition-all outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 hover:border-stone-300"
                    type="text" 
                    value={selectedTable.name}
                    onChange={(e) => updateSelectedField("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-800 mb-2 ml-1">Capacidad (Personas)</label>
                  <div className="flex items-center bg-white border border-stone-200 shadow-sm rounded-xl overflow-hidden hover:border-stone-300 transition-all">
                    <button 
                      onClick={() => updateSelectedField("capacity", Math.max(1, selectedTable.capacity - 1))}
                      className="p-5 text-primary hover:bg-stone-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px] font-bold">remove</span>
                    </button>
                    <input 
                      className="w-full text-center border-0 bg-transparent py-4 font-black text-2xl tracking-tighter focus:ring-0 text-stone-800 outline-none" 
                      type="number" 
                      value={selectedTable.capacity} 
                      onChange={(e) => updateSelectedField("capacity", parseInt(e.target.value) || 1)}
                    />
                    <button 
                      onClick={() => updateSelectedField("capacity", selectedTable.capacity + 1)}
                      className="p-5 text-primary hover:bg-stone-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px] font-bold">add</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-stone-800 mb-2 ml-1">Zona Asignada</label>
                  <div className="relative">
                    <select 
                      value={selectedTable.zone || "Interior"}
                      onChange={(e) => updateSelectedField("zone", e.target.value)}
                      className="w-full bg-white border border-stone-200 shadow-sm rounded-xl py-4 px-4 font-bold text-lg text-stone-900 appearance-none transition-all outline-none focus:ring-2 focus:border-primary focus:ring-primary/20 hover:border-stone-300"
                    >
                      <option value="Interior">Interior</option>
                      <option value="Terraza">Terraza</option>
                      <option value="Barra">Barra</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">expand_more</span>
                  </div>
                </div>
                
                <div className="pt-6">
                  <p className="text-[10px] uppercase tracking-widest font-black text-stone-400 mb-4 ml-1">ACCIONES RÁPIDAS</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <button onClick={handleDuplicate} className="flex items-center justify-center gap-2 py-4 bg-stone-100 rounded-full font-bold text-sm text-stone-700 hover:bg-stone-200 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                          Duplicar
                      </button>
                      <button onClick={handleRotate} className="flex items-center justify-center gap-2 py-4 bg-stone-100 rounded-full font-bold text-sm text-stone-700 hover:bg-stone-200 transition-colors">
                          <span className="material-symbols-outlined text-[18px]">cached</span>
                          Rotar
                      </button>
                  </div>
                  <button onClick={() => handleDelete(selectedTable.id)} className="w-full flex items-center justify-center gap-2 py-4 text-primary bg-primary/5 rounded-full hover:bg-primary/10 transition-all text-sm font-bold">
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
          <div className="mt-auto p-5 bg-primary/5 rounded-2xl">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 font-bold">lightbulb</span>
              <p className="text-xs text-primary leading-relaxed font-medium">
                <strong className="block mb-1 font-bold">Consejo:</strong> 
                Arrastra los elementos desde el panel izquierdo para añadirlos al plano. Puedes agrupar mesas seleccionando varias a la vez.
              </p>
            </div>
          </div>
        </aside>
      </main>
      
      {/* Footer Action Bar */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-between bg-white px-2 py-2 pl-6 rounded-full shadow-2xl border border-stone-200 z-[100] gap-8 min-w-[400px]">
        <button onClick={onClose} className="text-stone-500 font-bold tracking-tight text-sm px-2 hover:text-stone-800 transition-colors">
          Cancelar cambios
        </button>
        <button onClick={saveChanges} disabled={isSaving} className="px-8 py-3 bg-[#a81e14] text-white rounded-full font-bold text-sm shadow-md hover:bg-[#8f1911] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
          {isSaving ? "Guardando..." : "Finalizar Diseño"}
        </button>
      </footer>
    </div>
  );
}
