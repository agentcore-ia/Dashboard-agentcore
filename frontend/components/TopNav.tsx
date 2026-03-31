"use client";

export default function TopNav() {
  return (
    <header className="hidden lg:flex sticky top-0 h-16 items-center justify-between px-8 z-40 bg-white/80 backdrop-blur-md border-b border-stone-100">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="w-full bg-surface-container-highest border-none rounded-full pl-12 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest outline-none transition-all"
            placeholder="Buscar pedidos, clientes o chats..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="hover:bg-stone-50 rounded-full p-2 text-stone-600 transition-colors">
          <span className="material-symbols-outlined">sensors</span>
        </button>
        <button className="hover:bg-stone-50 rounded-full p-2 text-stone-600 transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-white"></span>
        </button>
        <div className="h-8 w-px bg-stone-100 mx-2"></div>
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-on-surface">Administrador</p>
            <p className="text-[10px] text-stone-500">Order Pilot</p>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-primary-fixed bg-stone-200 flex items-center justify-center text-stone-500">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
