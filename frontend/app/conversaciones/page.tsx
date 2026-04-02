"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Bot, User, Send, Paperclip, ArrowLeft, UserCircle, X, Package } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Conversation {
  id: string;
  customer_name: string;
  customer_phone: string;
  last_message: string | null;
  last_message_at: string;
  ai_active: boolean;
  status: string;
  unread_count: number;
  source: string;
  customer_id?: string;
}

interface Message {
  id: string;
  conversacion_id: string;
  content: string;
  type: string;
  sender: string;
  created_at: string;
  read: boolean;
}

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
const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001';

function IGIcon({ size = 12 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e1306c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

function WAIcon({ size = 12 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="#25d366" className="flex-shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

export default function ConversasPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // aiActive is always derived from selected conversation — single source of truth
  const aiActive = selected?.ai_active ?? true;

  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      const { data: convs, error } = await supabase
        .from('conversaciones')
        .select(`id, status, ai_active, last_message_at, created_at, source, cliente_id, clientes!inner(id, name, phone)`)
        .eq('restaurant_id', RESTAURANT_ID)
        .order('last_message_at', { ascending: false });

      if (error) { setLoading(false); return; }

      const enrichedConvs: Conversation[] = await Promise.all(
        (convs || []).map(async (c: any) => {
          const { data: lastMsg } = await supabase.from('mensajes').select('content').eq('conversacion_id', c.id).order('created_at', { ascending: false }).limit(1).single();
          const { count } = await supabase.from('mensajes').select('*', { count: 'exact', head: true }).eq('conversacion_id', c.id).eq('read', false).eq('sender', 'customer');
          const cliente = Array.isArray(c.clientes) ? c.clientes[0] : c.clientes;
          const phoneStr = cliente?.phone || '';
          // Reliable source detection based on phone format:
          // - WhatsApp: contains @s.whatsapp.net OR is a standard phone number ≤13 digits
          // - Instagram: pure numeric ID ≥15 digits (no @ symbol)
          let source: string;
          if (phoneStr.includes('@s.whatsapp.net')) {
            source = 'whatsapp';
          } else if (/^\d{15,}$/.test(phoneStr.replace(/\\D/g, '')) && !phoneStr.includes('@')) {
            source = 'instagram';
          } else if (c.source === 'instagram' && !phoneStr.includes('@')) {
            source = 'instagram';
          } else {
            source = 'whatsapp';
          }
          
          const cleanPhone = phoneStr.includes('@s.whatsapp.net') 
            ? phoneStr.replace('@s.whatsapp.net', '') 
            : phoneStr;

          return {
            id: c.id,
            customer_name: cliente?.name || 'Sin nombre',
            customer_phone: cleanPhone,
            customer_id: cliente?.id || c.cliente_id || null,
            last_message: lastMsg?.content || null,
            last_message_at: c.last_message_at,
            ai_active: c.ai_active,
            status: c.status,
            unread_count: count || 0,
            source,
          };
        })
      );
      setConversations(enrichedConvs);
      if (enrichedConvs.length > 0 && !selected) setSelected(enrichedConvs[0]);
      setLoading(false);
    }
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selected) return;
    async function fetchMessages() {
      const { data } = await supabase.from('mensajes').select('*').eq('conversacion_id', selected!.id).order('created_at', { ascending: true });
      setMessages(data || []);
      await supabase.from('mensajes').update({ read: true }).eq('conversacion_id', selected!.id).eq('sender', 'customer').eq('read', false);
    }
    fetchMessages();
  }, [selected?.id]);

  useEffect(() => {
    // Use unique channel name per selected conversation to avoid conflicts
    const channelName = `realtime-conv-${selected?.id ?? 'global'}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        const newMsg = payload.new as Message;
        if (selected && newMsg.conversacion_id === selected.id) {
          setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
        setConversations(prev => prev.map(c => c.id === newMsg.conversacion_id ? { ...c, last_message: newMsg.content, last_message_at: newMsg.created_at, unread_count: (selected && selected.id === c.id) ? c.unread_count : c.unread_count + 1 } : c).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones' }, (payload) => {
        const updated = payload.new as any;
        setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, ai_active: updated.ai_active, status: updated.status } : c));
        if (selected && selected.id === updated.id) {
          setSelected(prev => prev ? { ...prev, ai_active: updated.ai_active } : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const filteredConvs = conversations.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) || c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!input.trim() || !selected) return;
    const content = input.trim();
    setInput("");
    const { error } = await supabase.functions.invoke('send-whatsapp-message', { body: { conversacion_id: selected.id, content } });
    if (error) {
      await supabase.from('mensajes').insert({ conversacion_id: selected.id, content, type: 'text', sender: 'human' });
      await supabase.from('conversaciones').update({ last_message_at: new Date().toISOString(), ai_active: false }).eq('id', selected.id);
    }
  };

  const toggleAI = async () => {
    if (!selected) return;
    const newVal = !selected.ai_active;   // read from source of truth, not stale local state
    // Optimistic update: update selected and conversations immediately
    setSelected(prev => prev ? { ...prev, ai_active: newVal } : prev);
    setConversations(c => c.map(x => x.id === selected.id ? { ...x, ai_active: newVal } : x));
    // Persist to DB
    const { error } = await supabase.from('conversaciones').update({ ai_active: newVal }).eq('id', selected.id);
    if (error) {
      // Rollback on error
      console.error('Error toggling AI:', error);
      setSelected(prev => prev ? { ...prev, ai_active: !newVal } : prev);
      setConversations(c => c.map(x => x.id === selected.id ? { ...x, ai_active: !newVal } : x));
    }
  };

  const handleSelectConv = (conv: Conversation) => {
    setSelected(conv);
    setMobileView("chat");
    setShowProfile(false);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
  };

  const handleShowProfile = async () => {
    setShowProfile(p => !p);
    if (!selected?.customer_id) return;
    const { data } = await supabase
      .from('pedidos')
      .select('id, order_number, status, total, created_at, notes')
      .eq('cliente_id', selected.customer_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setCustomerOrders(data || []);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-8 pb-12">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-extrabold text-orange-900 tracking-tight font-headline">Conversaciones</h2>
        <p className="text-stone-500 font-medium text-sm mt-1">{conversations.length} chats activos</p>
      </div>

      {/* Chat Layout */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        <div className="flex h-full">

          {/* Left: List */}
          <div className={`w-full lg:w-80 lg:min-w-80 border-r border-stone-100 flex flex-col ${mobileView === "chat" ? "hidden lg:flex" : "flex"}`}>
            {/* Search */}
            <div className="p-4 border-b border-stone-100">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                <input
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 rounded-xl text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 text-stone-700 placeholder:text-stone-400"
                  placeholder="Buscar conversación..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400">
                  <p className="text-sm">No hay conversaciones</p>
                </div>
              ) : (
                filteredConvs.map((conv, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const isSelected = selected?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConv(conv)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-stone-50 ${isSelected ? "bg-orange-50 border-l-2 border-l-orange-500" : "hover:bg-stone-50"}`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: color + "22", color }}>
                        {getInitial(conv.customer_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {conv.source === 'instagram' ? <IGIcon size={11} /> : <WAIcon size={11} />}
                            <span className="text-sm font-semibold text-stone-800 truncate">{conv.customer_name}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 flex-shrink-0 ml-2">{timeAgo(conv.last_message_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs text-stone-500 truncate">{conv.last_message || "..."}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {conv.unread_count > 0 && (
                              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">{conv.unread_count}</span>
                            )}
                            {conv.ai_active ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-600">IA</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-green-100 text-green-700">Humano</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Chat window */}
          <div className={`flex-1 flex flex-col relative ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
            {selected ? (
              <>
                {/* Chat header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-white">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMobileView("list")} className="lg:hidden p-1.5 -ml-1 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "#f9731622", color: "#fb923c" }}>
                      {getInitial(selected.customer_name)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-stone-800">{selected.customer_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {selected.source === 'instagram' ? (
                          <><IGIcon size={12} /><span className="text-xs text-stone-500 font-medium">Instagram</span></>
                        ) : (
                          <><WAIcon size={12} /><span className="text-xs text-stone-500 font-medium">WhatsApp{selected.customer_phone ? ` · ${selected.customer_phone}` : ''}</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleShowProfile}
                      className={`p-1.5 rounded-lg transition-all ${showProfile ? 'bg-orange-100 text-orange-600' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
                      title="Ver perfil del cliente"
                    >
                      <UserCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={toggleAI}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${aiActive ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
                    >
                      {aiActive ? "Tomar Control" : "Volver a IA"}
                    </button>


                  </div>
                </div>

                {/* Customer Profile Panel (slide in from right, overlays messages) */}
                {showProfile && (
                  <div className="absolute inset-y-0 right-0 w-72 bg-white border-l border-stone-100 z-10 flex flex-col shadow-xl overflow-y-auto">
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-100">
                      <span className="font-semibold text-sm text-stone-800">Perfil del cliente</span>
                      <button onClick={() => setShowProfile(false)} className="p-1 rounded-lg hover:bg-stone-100 text-stone-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      {/* Avatar + info */}
                      <div className="flex flex-col items-center text-center mb-5 pb-5 border-b border-stone-100">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-3" style={{ background: "#f9731622", color: "#fb923c" }}>
                          {getInitial(selected.customer_name)}
                        </div>
                        <p className="font-bold text-stone-800 text-sm">{selected.customer_name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {selected.source === 'instagram' ? (
                            <><IGIcon size={11} /><span className="text-[11px] text-stone-500">Instagram</span></>
                          ) : (
                            <><WAIcon size={11} /><span className="text-[11px] text-stone-500">WhatsApp</span></>
                          )}
                        </div>
                        {selected.customer_phone && selected.source !== 'instagram' && (
                          <p className="text-sm font-medium text-stone-500 mt-1">{selected.customer_phone}</p>
                        )}
                      </div>

                      {/* Order history */}
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Historial de pedidos</h4>
                        {customerOrders.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-stone-300">
                            <Package className="w-8 h-8 mb-2" />
                            <p className="text-xs text-stone-400">Sin pedidos registrados</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {customerOrders.map(order => (
                              <div key={order.id} className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-stone-700">#{order.order_number}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                    order.status === 'delivered' ? 'bg-green-100 text-green-700'
                                    : order.status === 'new' ? 'bg-red-100 text-red-600'
                                    : order.status === 'preparing' ? 'bg-orange-100 text-orange-700'
                                    : 'bg-blue-100 text-blue-700'
                                  }`}>{order.status}</span>
                                </div>
                                {order.notes && <p className="text-[11px] text-stone-500 truncate">{order.notes}</p>}
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-[11px] font-bold text-stone-800">${Number(order.total).toFixed(2)}</span>
                                  <span className="text-[10px] text-stone-400">{new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-stone-50 relative">
                  {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-stone-400">No hay mensajes aún</p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.sender === "customer"
                          ? "bg-white text-stone-800 rounded-bl-sm border border-stone-100"
                          : msg.sender === "ai"
                          ? "bg-orange-500 text-white rounded-br-sm"
                          : "bg-blue-500 text-white rounded-br-sm"
                      }`} style={{ whiteSpace: "pre-wrap" }}>
                        {msg.sender !== "customer" && (
                          <div className="flex items-center gap-1 mb-1 opacity-80">
                            {msg.sender === "ai" ? (
                              <><Bot className="w-3 h-3" /><span className="text-[10px] font-semibold">IA</span></>
                            ) : (
                              <><User className="w-3 h-3" /><span className="text-[10px] font-semibold">Agente</span></>
                            )}
                          </div>
                        )}
                        {msg.content}
                        <div className="text-right mt-1">
                          <span className={`text-[10px] ${msg.sender === "customer" ? "text-stone-400" : "text-white/70"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-stone-100 bg-white">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors flex-shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      className="flex-1 px-4 py-2 bg-stone-100 rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-orange-200 text-stone-800 placeholder:text-stone-400"
                      placeholder={aiActive ? "IA está respondiendo (toma control para escribir)" : "Escribe un mensaje..."}
                      value={input}
                      disabled={aiActive}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSend()}
                      style={{ fontSize: "16px" }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || aiActive}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: input.trim() && !aiActive ? "linear-gradient(135deg,#f97316,#ef4444)" : "#e7e5e4", opacity: !input.trim() || aiActive ? 0.5 : 1 }}
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-stone-50">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-orange-500 text-3xl">chat</span>
                  </div>
                  <p className="text-stone-500 text-sm font-medium">Selecciona una conversación</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
