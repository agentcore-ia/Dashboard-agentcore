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
} from "lucide-react";

const navItems = [
  { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/analytics", label: "Analítica", icon: BarChart2 },
  { href: "/campanas", label: "Campañas", icon: Megaphone },
  { href: "/configuracion-ia", label: "Configuración IA", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col h-screen border-r"
      style={{
        width: "220px",
        minWidth: "220px",
        background: "rgba(10,10,15,0.95)",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
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

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-1 mt-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
  );
}
