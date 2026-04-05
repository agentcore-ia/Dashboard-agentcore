"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Insight {
  tipo: "warning" | "trend" | "stock" | "info";
  mensaje: string;
}

interface DailySummary {
  ventas: number;
  pedidos: number;
  ticketPromedio: number;
  horaPico: string;
}

const QUICK_QUESTIONS = [
  "¿Qué producto debería promocionar?",
  "¿Por qué bajaron las ventas?",
  "¿Cuáles son mis horas pico?",
  "Resumen del día",
  "¿Qué clientes debería recuperar?",
  "¿Cómo están las mesas ahora?",
];

const insightIcon: Record<string, string> = {
  warning: "⚠️",
  trend: "🔥",
  stock: "📦",
  info: "ℹ️",
};

const insightBg: Record<string, string> = {
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  trend: "bg-emerald-50 border-emerald-200 text-emerald-800",
  stock: "bg-orange-50 border-orange-200 text-orange-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

function fmt(n: number) {
  return "$" + (n || 0).toLocaleString("es-AR");
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-end mb-4`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
          isUser ? "bg-stone-700 text-white" : "bg-blue-600 text-white"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-stone-800 text-white rounded-br-sm"
            : "bg-white border border-stone-200 text-stone-800 rounded-bl-sm"
        }`}
      >
        {msg.content.split("\n").map((line, i) => {
          // Bold markdown support
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <p key={i} className={line === "" ? "h-2" : ""}>
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-bold">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </p>
          );
        })}
        <p
          className={`text-[10px] mt-2 ${
            isUser ? "text-stone-400 text-right" : "text-stone-400"
          }`}
        >
          {msg.timestamp.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex gap-3 items-end mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
        🤖
      </div>
      <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-5">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default function GerenteIAPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "¡Hola! Soy tu **Gerente IA** 🤖\n\nEstoy conectado a los datos de tu restaurante en tiempo real. Podés preguntarme sobre ventas, productos, mesas, tendencias y mucho más.\n\n¿En qué puedo ayudarte hoy?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load insights on mount
  useEffect(() => {
    fetch("/api/gerente-ia")
      .then((r) => r.json())
      .then((data) => {
        if (data.insights) setInsights(data.insights);
        if (data.summary) setSummary(data.summary);
      })
      .catch(console.error)
      .finally(() => setInsightsLoading(false));
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/gerente-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text.trim() }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "No pude obtener una respuesta. Intentá de nuevo.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Update insights and summary if returned
      if (data.insights) setInsights(data.insights);
      if (data.context?.hoy) setSummary(data.context.hoy);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: "❌ Error al conectar con el servidor. Verificá tu conexión e intentá de nuevo.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-2xl shadow-md">
              🤖
            </div>
            <div>
              <h1 className="text-lg font-black text-stone-900">Gerente IA del Restaurante</h1>
              <p className="text-xs text-stone-500">Pregúntale a tu negocio</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700">Conectado a los datos</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* ── Insights Panel (left on desktop) ──────────────── */}
        <div className="lg:w-72 xl:w-80 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-stone-200 overflow-y-auto">
          <div className="p-4">
            {/* Daily summary */}
            <div className="mb-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-3">
                Resumen de hoy
              </h2>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : summary ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 col-span-2">
                    <p className="text-[10px] font-bold uppercase text-stone-400 mb-0.5">Ventas</p>
                    <p className="text-2xl font-black text-stone-900">{fmt(summary.ventas)}</p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-stone-400 mb-0.5">Pedidos</p>
                    <p className="text-xl font-black text-stone-900">{summary.pedidos}</p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-stone-400 mb-0.5">Ticket</p>
                    <p className="text-xl font-black text-stone-900">{fmt(summary.ticketPromedio)}</p>
                  </div>
                  {summary.horaPico && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 col-span-2">
                      <p className="text-[10px] font-bold uppercase text-blue-500 mb-0.5">Hora pico</p>
                      <p className="text-sm font-bold text-blue-900">{summary.horaPico}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-400 text-center py-4">Sin datos disponibles</p>
              )}
            </div>

            {/* Auto insights */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-3">
                Insights automáticos
              </h2>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-stone-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : insights.length === 0 ? (
                <div className="text-center py-6 text-stone-400">
                  <p className="text-2xl mb-2">✨</p>
                  <p className="text-xs">Sin alertas por ahora</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${insightBg[ins.tipo]}`}
                    >
                      <span className="shrink-0 mt-0.5">{insightIcon[ins.tipo]}</span>
                      <span>{ins.mensaje}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Chat Area ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isLoading && <LoadingBubble />}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ── */}
          <div className="shrink-0 border-t border-stone-200 bg-white px-4 sm:px-6 py-4">
            {/* Quick question chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-100 hover:bg-blue-100 hover:text-blue-800 text-stone-600 border border-stone-200 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Text input row */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 bg-stone-50 border border-stone-300 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pregúntale algo a tu restaurante…"
                  rows={1}
                  className="w-full bg-transparent text-sm text-stone-800 placeholder:text-stone-400 outline-none resize-none leading-relaxed"
                  style={{ maxHeight: "120px", overflowY: "auto" }}
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                title="Enviar (Enter)"
              >
                <span className="material-symbols-outlined text-[22px]">send</span>
              </button>
            </div>
            <p className="text-[11px] text-stone-400 mt-2 text-center">
              Presioná <kbd className="bg-stone-100 border border-stone-300 rounded px-1 py-0.5 text-[10px] font-mono">Enter</kbd> para enviar · <kbd className="bg-stone-100 border border-stone-300 rounded px-1 py-0.5 text-[10px] font-mono">Shift + Enter</kbd> para nueva línea
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
