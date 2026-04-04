"use client";

import { useState } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { Menu } from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plusJakartaSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <html lang="es" className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased overflow-x-hidden text-on-surface bg-surface font-body">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className="flex h-screen overflow-hidden">
          {/* Main Sidebar */}
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pl-[200px]">
             {/* Mobile Header (Shows only on small screens) */}
             <header className="lg:hidden flex justify-between items-center h-16 px-4 bg-white/80 backdrop-blur-md border-b border-stone-100 z-30">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-stone-600 hover:text-primary transition-colors"
                title="Abrir menú"
              >
                <Menu className="w-6 h-6" />
              </button>
                <span className="font-bold text-orange-900 tracking-tight leading-none text-lg">Neuro Rest</span>
            </header>

            {/* Desktop Top Nav (Shows on lg+) */}
            <TopNav />

            {/* Main scrollable area */}
            <main className="flex-1 overflow-y-auto w-full relative">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
