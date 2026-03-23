"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const navItems = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/conversaciones", label: "Chats", icon: "chat" },
  { href: "/pedidos", label: "Pedidos", icon: "restaurant_menu" },
  { href: "/analytics", label: "Analíticas", icon: "analytics" },
  { href: "/modulos", label: "Módulos", icon: "smart_toy" },
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
        <div className="px-6 mb-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 overflow-hidden flex items-center justify-center shrink-0">
             <Image 
                src="/logo.png" 
                alt="Order Pilot Logo" 
                width={40} 
                height={40}
                className="object-cover w-full h-full"
             />
          </div>
          <div>
            <h1 className="text-2xl font-black text-orange-900 tracking-tight leading-none font-headline">
              Order Pilot
            </h1>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map(({ href, label, icon }) => {
            // Note: Since Home is "/", exact match is preferred for active state,
            // otherwise all routes starting with "/" will trigger it.
            const active = href === "/" ? pathname === href : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-headline font-semibold text-sm transition-all duration-200 ${
                  active
                    ? "text-orange-900 border-r-4 border-orange-900 bg-orange-50 scale-[0.98] active:opacity-80"
                    : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                <span className="material-symbols-outlined">{icon}</span>
                <span>{label}</span>
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
