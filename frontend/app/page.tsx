"use client";

import Image from "next/image";

export default function DashboardInicio() {
  return (
    <>
      {/* Hero Heading */}
      <div className="mb-10">
        <h2 className="text-4xl font-extrabold text-orange-900 tracking-tight mb-2 font-headline">
          Panel de Control
        </h2>
        <p className="text-stone-500 font-medium">¡Buenos días! Así va tu negocio hoy.</p>
      </div>

      {/* Metric Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {/* Metric Card 1 */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-tertiary-fixed text-tertiary rounded-lg">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                restaurant
              </span>
            </div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Hoy</span>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-on-surface font-headline">42</p>
            <p className="text-sm font-medium text-stone-500 mt-1 italic">Pedidos de hoy</p>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-secondary-fixed text-secondary rounded-lg">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                chat_bubble
              </span>
            </div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Activas</span>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-on-surface font-headline">18</p>
            <p className="text-sm font-medium text-stone-500 mt-1 italic">Conversaciones</p>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-none shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary-fixed text-primary rounded-lg">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                payments
              </span>
            </div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Ingresos</span>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-on-surface font-headline">$1,284</p>
            <p className="text-sm font-medium text-stone-500 mt-1 italic">Ventas del día</p>
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="bg-primary text-on-primary p-6 rounded-xl border-none shadow-xl shadow-primary/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                pending_actions
              </span>
            </div>
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Atención</span>
          </div>
          <div>
            <p className="text-4xl font-extrabold font-headline">7</p>
            <p className="text-sm font-medium text-white/80 mt-1 italic">Pendientes ahora</p>
          </div>
        </div>
      </div>

      {/* Content Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Activity Chart Section */}
          <section className="bg-surface-container-low p-8 rounded-lg">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-on-surface font-headline">Actividad por Hora</h3>
                <p className="text-stone-500 text-sm">Distribución de demanda de pedidos</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-primary rounded-full"></span>
                <span className="text-xs font-bold text-stone-600">Pedidos Reales</span>
              </div>
            </div>

            {/* Mock Chart Visualization */}
            <div className="h-64 flex items-end justify-between gap-4 px-2">
              <div className="flex-1 bg-primary/10 rounded-t-lg relative group h-[20%]">
                <div className="absolute inset-x-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                  <span className="bg-stone-800 text-white text-[10px] px-2 py-1 rounded">8 pts</span>
                </div>
              </div>
              <div className="flex-1 bg-primary/20 rounded-t-lg relative group h-[35%]"></div>
              <div className="flex-1 bg-primary/40 rounded-t-lg relative group h-[60%]"></div>
              <div className="flex-1 bg-primary/60 rounded-t-lg relative group h-[45%]"></div>
              <div className="flex-1 bg-primary rounded-t-lg relative group h-[90%] flex flex-col justify-end">
                <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center">
                  <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full">Peak</span>
                </div>
              </div>
              <div className="flex-1 bg-primary/50 rounded-t-lg relative group h-[70%]"></div>
              <div className="flex-1 bg-primary/30 rounded-t-lg relative group h-[50%]"></div>
              <div className="flex-1 bg-primary/15 rounded-t-lg relative group h-[30%]"></div>
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-bold text-stone-400 uppercase tracking-tighter px-2">
              <span>08:00</span>
              <span>10:00</span>
              <span>12:00</span>
              <span>14:00</span>
              <span>16:00</span>
              <span>18:00</span>
              <span>20:00</span>
              <span>22:00</span>
            </div>
          </section>

          {/* New Orders Highlight */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-on-surface font-headline">Pedidos Prioritarios</h3>
              <button className="text-primary text-sm font-bold hover:underline">Ver todos</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Order Card 1 */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-transparent hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden">
                       <span className="material-symbols-outlined text-stone-500">person</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface leading-none">Lucía Fernández</p>
                      <p className="text-[10px] text-stone-400 font-medium">Hace 4 minutos</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase tracking-widest">
                    Nuevo
                  </span>
                </div>
                <p className="text-stone-700 text-sm mb-4 line-clamp-1 italic">
                  "Quisiera dos pizzas margarita y una pasta carbonara por favor..."
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                  <span className="text-lg font-black text-on-surface">$34.50</span>
                  <button className="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-fixed transition-colors">
                    Atender
                  </button>
                </div>
              </div>

              {/* Order Card 2 */}
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-transparent hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden">
                       <span className="material-symbols-outlined text-stone-500">person</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface leading-none">Carlos Ruiz</p>
                      <p className="text-[10px] text-stone-400 font-medium">Hace 12 minutos</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-primary-fixed text-primary text-[10px] font-bold rounded-full uppercase tracking-widest">
                    En preparación
                  </span>
                </div>
                <p className="text-stone-700 text-sm mb-4 line-clamp-1 italic">
                  "¿Podrían agregarle extra queso a la hamburguesa gourmet?"
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                  <span className="text-lg font-black text-on-surface">$18.20</span>
                  <button className="bg-stone-100 text-stone-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-stone-200 transition-colors">
                    Detalles
                  </button>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Sidebar Activity Feed */}
        <div className="space-y-6">
          <section className="bg-surface-container-low p-6 rounded-lg">
            <h3 className="text-lg font-bold text-on-surface font-headline mb-6">Actividad Reciente</h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-xl">payments</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-surface-container-low"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface leading-snug">Pago Recibido</p>
                  <p className="text-xs text-stone-500">Orden #4502 de Roberto M. ha sido pagada.</p>
                  <span className="text-[10px] font-bold text-stone-400 mt-1 block uppercase">14:32</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-xl">chat</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface leading-snug">Nuevo Mensaje</p>
                  <p className="text-xs text-stone-500">Sofía G. pregunta por opciones vegetarianas.</p>
                  <span className="text-[10px] font-bold text-stone-400 mt-1 block uppercase">14:28</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-600">
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface leading-snug">Pedido Entregado</p>
                  <p className="text-xs text-stone-500">Domi-Express recogió el pedido de Calle 5.</p>
                  <span className="text-[10px] font-bold text-stone-400 mt-1 block uppercase">14:15</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-error">
                  <span className="material-symbols-outlined text-xl">warning</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface leading-snug">Alerta de Stock</p>
                  <p className="text-xs text-stone-500">Se han agotado las existencias de "Pasta Alfredo".</p>
                  <span className="text-[10px] font-bold text-stone-400 mt-1 block uppercase">13:50</span>
                </div>
              </div>
            </div>

            <button className="w-full mt-8 py-3 bg-stone-200/50 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-colors">
              Descargar Reporte Diario
            </button>
          </section>

          {/* Quick Stats Mini Card */}
          <div className="bg-gradient-to-br from-orange-900 to-orange-800 p-6 rounded-xl text-white">
            <h4 className="text-xs font-bold opacity-60 uppercase tracking-widest mb-4">Promedio de Respuesta</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black font-headline">1.4m</p>
                <p className="text-[10px] text-white/70">Mejor que el promedio (2.1m)</p>
              </div>
              <span className="material-symbols-outlined text-4xl opacity-20">bolt</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
