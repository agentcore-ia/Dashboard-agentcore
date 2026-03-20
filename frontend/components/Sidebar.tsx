"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  ShoppingBag,
  BarChart2,
  Megaphone,
  Settings,
  Zap,
  UtensilsCrossed,
  X,
} from "lucide-react";

const navItems = [
  { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/menu", label: "Menú y Stock", icon: UtensilsCrossed },
  { href: "/analytics", label: "Analítica", icon: BarChart2 },
  { href: "/campanas", label: "Campañas", icon: Megaphone },
  { href: "/configuracion-ia", label: "Configuración IA", icon: Settings },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="lg:hidden mobile-overlay" onClick={onClose} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col h-screen border-r transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          background: "rgba(10,10,15,0.98)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Beastie</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Beast Burgers
              </p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-1 mt-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "nav-active"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4">
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p
              className="text-xs font-semibold"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              🟢 Beast Burgers
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              São Paulo, SP
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
