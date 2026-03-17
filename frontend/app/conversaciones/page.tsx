"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Filter, Bot, User, Send, Paperclip, MoreVertical, Phone } from "lucide-react";

const DEMO_CONVERSATIONS = [
  { id: "00000000-0000-0000-0000-000000000020", customer_name: "Pedro Machado", customer_phone: "+5511987654321", last_message: "Sí, por favor", last_message_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), ai_active: true, status: "active", unread_count: "1" },
  { id: "00000000-0000-0000-0000-000000000021", customer_name: "Kaua Parizzi", customer_phone: "+5511976543210", last_message: "Gracias", last_message_at: new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString(), ai_active: true, status: "active", unread_count: "0" },
  { id: "00000000-0000-0000-0000-000000000022", customer_name: "Natalia", customer_phone: "+18972544744", last_message: "Confirmado", last_message_at: new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString(), ai_active: true, status: "active", unread_count: "0" },
  { id: "00000000-0000-0000-0000-000000000023", customer_name: "Vanessa Souza", customer_phone: "+5511965432109", last_message: "Quiero una hamburguesa doble", last_message_at: new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString(), ai_active: true, status: "active", unread_count: "0" },
  { id: "00000000-0000-0000-0000-000000000024", customer_name: "Kamila Vieira", customer_phone: "+5511954321098", last_message: "Ya realicé el pago", last_message_at: new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString(), ai_active: true, status: "active", unread_count: "0" },
  { id: "00000000-0000-0000-0000-000000000025", customer_name: "Vini", customer_phone: "+5511943210987", last_message: "Muchas gracias", last_message_at: new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString(), ai_active: true, status: "active", unread_count: "0" },
  { id: "00000000-0000-0000-0000-000000000026", customer_name: "Azeredo", customer_phone: "+5511932109876", last_message: "Hablé con el repartidor", last_message_at: new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString(), ai_active: false, status: "active", unread_count: "0" },
];

const DEMO_MESSAGES = [
  { id: "1", content: "Hola, quiero pedir una hamburguesa", sender: "customer", created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  { id: "2", content: "¡Hola Pedro! 👋 ¡Bienvenido a Beast Burgers!\n\n🍔 *Beast Classic* — $32.90\n🍔 *Beast Double* — $44.90\n🍔 *Beast Crispy* (pollo) — $29.90\n\n¿Cuál de ellas te gustaría probar hoy?", sender: "ai", created_at: new Date(Date.now() - 9 * 60 * 1000).toISOString() },
  { id: "3", content: "Beast Classic por favor", sender: "customer", created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
  { id: "4", content: "¡Excelente elección! 🔥\n\n¿Quieres añadir un combo?\n🍟 Papas con Cheddar y Bacon — $22.90\n🥤 Refresco 600ml — $9.00\n\n¡Los dos juntos quedan por solo $31.90!", sender: "ai", created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString() },
  { id: "5", content: "Sí, quiero el combo", sender: "customer", created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
  { id: "6", content: "📋 *Resumen de tu pedido:*\n\n1x Beast Classic — $32.90\n1x Papas con Cheddar y Bacon — $22.90\n1x Refresco 600ml — $9.00\n\nSubtotal: $64.80\nCosto de envío: $5.00\n*TOTAL: $69.80*\n\n📍 Av. Principal, 1500, Apto 42\n\n¿Forma de pago? (Tarjeta / Efectivo / Pix)", sender: "ai", created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
  { id: "7", content: "Tarjeta", sender: "customer", created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { id: "8", content: "Sí, por favor", sender: "customer", created_at: new Date(Date.now() - 1 * 60 * 1000).toISOString() },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function getInitial(name: string) {
  return name ? name[0].toUpperCase() : "?";
}

const AVATAR_COLORS = ["#f97316","#ef4444","#3b82f6","#8b5cf6","#14b8a6","#f59e0b","#ec4899"];

export default function ConversasPage() {
  const [conversations, setConversations] = useState(DEMO_CONVERSATIONS);
  const [selected, setSelected] = useState(DEMO_CONVERSATIONS[0]);
  const [messages, setMessages] = useState(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [aiActive, setAiActive] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAiActive(selected.ai_active);
    setMessages(selected.id === DEMO_CONVERSATIONS[0].id ? DEMO_MESSAGES : []);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConvs = conversations.filter(
    c => c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
         c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = { id: Date.now().toString(), content: input, sender: "human", created_at: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    setInput("");
  };

  const toggleAI = () => {
    setAiActive(prev => !prev);
    setConversations(convs => convs.map(c =>
      c.id === selected.id ? { ...c, ai_active: !c.ai_active } : c
    ));
  };

  return (
    <div className="flex h-screen" style={{ height: "100vh" }}>
      {/* Left: conversation list */}
      <div
        className="flex flex-col border-r"
        style={{ width: "320px", minWidth: "320px", background: "rgba(10,10,20,0.7)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-bold text-base">Conversaciones</h1>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{filteredConvs.length} chats activos</p>
            </div>
            <button className="btn-ghost text-xs">
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              className="input-dark pl-8 text-sm"
              placeholder="Buscar conversación..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-2">
            <span className="text-xs font-medium px-2 py-1 rounded-lg" style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
              Conversaciones {filteredConvs.length}
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {filteredConvs.map((conv, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const isSelected = selected?.id === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-100 ${
                  isSelected
                    ? "bg-white/8 border border-white/10"
                    : "hover:bg-white/4"
                }`}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: color + "33", color }}
                >
                  {getInitial(conv.customer_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{conv.customer_name}</span>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {timeAgo(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-1">
                    <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {conv.last_message || "..."}
                    </span>
                    {conv.ai_active ? (
                      <span className="badge-ai flex-shrink-0 ml-1">IA Activa</span>
                    ) : (
                      <span className="badge-human flex-shrink-0 ml-1">Humano</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full dot-active flex-shrink-0" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Activo</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: chat window */}
      <div className="flex-1 flex flex-col" style={{ background: "rgba(8,8,14,0.8)" }}>
        {selected ? (
          <>
            {/* Chat header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: "#f9731633", color: "#fb923c" }}
                >
                  {getInitial(selected.customer_name)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selected.customer_name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{selected.customer_phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {aiActive ? (
                  <span className="badge-ai">IA Activa</span>
                ) : (
                  <span className="badge-human">Humano</span>
                )}
                <button
                  onClick={toggleAI}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    aiActive
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                      : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                  }`}
                >
                  {aiActive ? "Tomar Control" : "Volver a IA"}
                </button>
                <button className="btn-ghost w-8 h-8 p-0 flex items-center justify-center">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No hay mensajes aún</p>
                </div>
              )}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"} fade-in`}
                >
                  <div
                    className={`max-w-sm px-4 py-2.5 text-sm leading-relaxed ${
                      msg.sender === "customer"
                        ? "bubble-customer"
                        : msg.sender === "ai"
                        ? "bubble-ai"
                        : "bubble-human"
                    }`}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {msg.sender !== "customer" && (
                      <div className="flex items-center gap-1 mb-1">
                        {msg.sender === "ai" ? (
                          <><Bot className="w-3 h-3" style={{ color: "#fb923c" }} /><span className="text-xs font-medium" style={{ color: "#fb923c" }}>IA</span></>
                        ) : (
                          <><User className="w-3 h-3" style={{ color: "#60a5fa" }} /><span className="text-xs font-medium" style={{ color: "#60a5fa" }}>Agente</span></>
                        )}
                      </div>
                    )}
                    {msg.content}
                    <div className="text-right mt-1">
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="px-4 py-3 border-t"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-2">
                <button className="btn-ghost w-9 h-9 flex items-center justify-center p-0 flex-shrink-0">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  className="input-dark flex-1 text-sm"
                  placeholder={aiActive ? "IA está respondiendo... (tome el control para escribir)" : "Escribe un mensaje..."}
                  value={input}
                  disabled={aiActive}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || aiActive}
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
                  style={{
                    background: input.trim() && !aiActive
                      ? "linear-gradient(135deg,#f97316,#ef4444)"
                      : "rgba(255,255,255,0.06)",
                    opacity: !input.trim() || aiActive ? 0.4 : 1,
                  }}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Seleccione una conversación</p>
          </div>
        )}
      </div>
    </div>
  );
}
