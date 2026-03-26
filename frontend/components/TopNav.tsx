"use client";

export default function TopNav() {
  return (
    <header className="hidden lg:flex sticky top-0 h-20 items-center justify-between px-8 z-40 bg-white/80 backdrop-blur-md border-b border-stone-100 shadow-[0_4px_40px_0_rgba(173,44,0,0.04)]">
      <div className="flex-1 max-w-xl">
        <div className="flex items-center bg-surface-container-low px-4 py-2 rounded-full w-96 relative group">
          <span className="material-symbols-outlined text-stone-400 mr-2 group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm w-full font-body outline-none"
            placeholder="Buscar pedidos, clientes o chats..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200/50 transition-colors">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200/50 transition-colors">
          <span className="material-symbols-outlined">help</span>
        </button>
        <div className="h-10 w-px bg-stone-200 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-on-surface leading-none">Chef Antonio</p>
            <p className="text-[10px] text-stone-500 font-medium leading-none mt-1">Administrador</p>
          </div>
          <img 
            alt="User profile avatar" 
            className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10" 
            src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?q=80&w=1977&auto=format&fit=crop"
          />
        </div>
      </div>
    </header>
  );
}
