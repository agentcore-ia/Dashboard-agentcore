"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const navItems = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/conversaciones", label: "Chats", icon: "chat" },
  { href: "/pedidos", label: "Pedidos", icon: "restaurant_menu" },
  { href: "/menu", label: "Menú", icon: "menu_book" },
  { href: "/mesas", label: "Mesas", icon: "table_restaurant" },
  { href: "/analytics", label: "Analíticas", icon: "analytics" },
  { href: "/gerente-ia", label: "Gerente IA", icon: "smart_toy", highlight: true },
  { href: "/modulos", label: "Módulos", icon: "extension" },
  { href: "/ajustes", label: "Ajustes", icon: "settings" },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col pt-6 pb-6 bg-stone-50 h-screen border-r border-stone-200 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "var(--sidebar-width)", minWidth: "var(--sidebar-width)" }}
      >
        {/* Logo Section */}
        <div className="px-6 mb-10 flex items-center gap-4">
          <div className="w-14 h-14 overflow-hidden flex items-center justify-center shrink-0">
             <Image 
                src="/logo.png" 
                alt="Neuro Rest Logo" 
                width={56} 
                height={56}
                className="object-contain w-full h-full"
             />
          </div>
          <div>
            <h1 className="text-2xl font-black text-orange-900 tracking-tight leading-none font-headline">
              Neuro Rest
            </h1>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map(({ href, label, icon, highlight }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-headline font-semibold text-sm transition-all duration-200 ${
                  active
                    ? "text-orange-900 border-r-4 border-orange-900 bg-orange-50 scale-[0.98] active:opacity-80"
                    : highlight
                    ? "text-blue-700 hover:text-blue-900 hover:bg-blue-50 border border-blue-100 bg-blue-50/50"
                    : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                <span className={`material-symbols-outlined ${active ? "" : highlight ? "text-blue-600" : ""}`}>{icon}</span>
                <span>{label}</span>
                {highlight && !active && (
                  <span className="ml-auto text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    IA
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom CTA Action */}
        <div className="px-4 mt-auto pt-6">
          <button className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-container transition-all">
            <span className="material-symbols-outlined">add_circle</span>
            <span>Nuevo Pedido</span>
          </button>
        </div>
      </aside>
    </>
  );
}
