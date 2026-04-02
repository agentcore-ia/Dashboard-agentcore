"use client";

import { useState } from "react";
import PlanoView from "./PlanoView";
import ReservasView from "./ReservasView";
import EditorPlanoView from "./EditorPlanoView";

export default function MesasPage() {
  const [activeTab, setActiveTab] = useState<"plano" | "reservas">("plano");
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-hidden">
        <EditorPlanoView onClose={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
       <div className="flex justify-between items-end mb-2 shrink-0">
         <div>
           <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">Gestión de Mesas</h2>
           <p className="text-on-surface-variant mt-1 text-sm">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
           
           <div className="flex items-center gap-6 mt-6 border-b border-stone-200">
             <button
               onClick={() => setActiveTab("plano")}
               className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === "plano" ? "border-red-800 text-red-800" : "border-transparent text-stone-500 hover:text-stone-800"}`}
             >
               Plano
             </button>
             <button
               onClick={() => setActiveTab("reservas")}
               className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === "reservas" ? "border-red-800 text-red-800" : "border-transparent text-stone-500 hover:text-stone-800"}`}
             >
               Reservas
             </button>
           </div>
         </div>
         {activeTab === "plano" && (
           <div className="flex gap-3 mb-2">
             <button className="bg-primary hover:bg-primary-container text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all active:scale-95 text-sm shadow-sm">
               <span className="material-symbols-outlined text-[18px]">add</span>
               Nueva reserva
             </button>
             <button onClick={() => setIsEditing(true)} className="bg-surface-container-highest hover:bg-surface-variant text-on-surface px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all active:scale-95 text-sm border border-outline-variant/30 shadow-sm">
               <span className="material-symbols-outlined text-[18px]">edit</span>
               Editar plano
             </button>
           </div>
         )}
         {activeTab === "reservas" && (
           <div className="flex gap-3 mb-2">
             <button className="bg-primary hover:bg-primary-container text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all active:scale-95 text-sm shadow-sm">
               <span className="material-symbols-outlined text-[18px]">post_add</span>
               Crear Reserva
             </button>
           </div>
         )}
       </div>

       {activeTab === "plano" && <PlanoView />}
       {activeTab === "reservas" && <ReservasView />}
    </div>
  );
}
