"use client";

// Force update to ensure deployment: 2026-03-22
import { useState, useEffect, useRef } from "react";
import { Search, Bot, User, Send, Paperclip, MoreVertical, PersonStanding } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Conversation {
  id: string;
  cliente_id: string;
  customer_name: string;
  customer_phone: string;
  last_message: string | null;
  last_message_at: string;
  ai_active: boolean;
  status: string;
  unread_count: number;
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

interface CustomerOrder {
  id: string;
  order_number: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
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

export default function ConversasPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [customerTotalSpent, setCustomerTotalSpent] = useState(0);
  
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [aiActive, setAiActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations from Supabase
  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      const { data: convs, error } = await supabase
        .from('conversaciones')
        .select(`
          id, status, ai_active, last_message_at, created_at, cliente_id,
          clientes!inner(name, phone)
        `)
        .eq('restaurant_id', RESTAURANT_ID)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
        return;
      }

      const enrichedConvs: Conversation[] = await Promise.all(
        (convs || []).map(async (c: any) => {
          const { data: lastMsg } = await supabase
            .from('mensajes')
            .select('content')
            .eq('conversacion_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count } = await supabase
            .from('mensajes')
            .select('*', { count: 'exact', head: true })
            .eq('conversacion_id', c.id)
            .eq('read', false)
            .eq('sender', 'customer');

          const cliente = Array.isArray(c.clientes) ? c.clientes[0] : c.clientes;

          return {
            id: c.id,
            cliente_id: c.cliente_id,
            customer_name: cliente?.name || 'Sin nombre',
            customer_phone: cliente?.phone || '',
            last_message: lastMsg?.content || null,
            last_message_at: c.last_message_at,
            ai_active: c.ai_active,
            status: c.status,
            unread_count: count || 0,
          };
        })
      );

      setConversations(enrichedConvs);
      if (enrichedConvs.length > 0 && !selected) {
        setSelected(enrichedConvs[0]);
      }
      setLoading(false);
    }

    fetchConversations();
  }, []);

  // Load messages & order history when conversation changes
  useEffect(() => {
    if (!selected) return;
    setAiActive(selected.ai_active);

    async function fetchData() {
      // Fetch Messages
      const { data: msgsData, error: msgsError } = await supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', selected!.id)
        .order('created_at', { ascending: true });

      if (msgsError) console.error('Error fetching messages:', msgsError);
      else setMessages(msgsData || []);

      // Mark messages as read
      await supabase
        .from('mensajes')
        .update({ read: true })
        .eq('conversacion_id', selected!.id)
        .eq('sender', 'customer')
        .eq('read', false);

      // Fetch Order history for customer profile
      if (selected?.cliente_id) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('pedidos')
          .select('id, order_number, total, status, notes, created_at')
          .eq('cliente_id', selected.cliente_id)
          .order('created_at', { ascending: false });
        
        if (ordersError) {
          console.error("Error fetching orders for customer:", ordersError);
        } else {
          setCustomerOrders(ordersData || []);
          const totalSpent = (ordersData || []).reduce((sum, order) => sum + Number(order.total || 0), 0);
          setCustomerTotalSpent(totalSpent);
        }
      }
    }

    fetchData();
  }, [selected]);

  // Subscribe to new messages in realtime
  useEffect(() => {
    const channel = supabase
      .channel('realtime-mensajes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selected && newMsg.conversacion_id === selected.id) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          setConversations(prev =>
            prev.map(c => {
              if (c.id === newMsg.conversacion_id) {
                return {
                  ...c,
                  last_message: newMsg.content,
                  last_message_at: newMsg.created_at,
                  unread_count: (selected && selected.id === c.id) ? c.unread_count : c.unread_count + 1,
                };
              }
              return c;
            }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversaciones' },
        (payload) => {
          const updated = payload.new as any;
          setConversations(prev =>
            prev.map(c =>
              c.id === updated.id
                ? { ...c, ai_active: updated.ai_active, status: updated.status, last_message_at: updated.last_message_at }
                : c
            )
          );
          if (selected && selected.id === updated.id) {
            setAiActive(updated.ai_active);
            setSelected(prev => prev ? { ...prev, ai_active: updated.ai_active } : prev);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConvs = conversations.filter(
    c => c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
         c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!input.trim() || !selected) return;
    const content = input.trim();
    setInput("");

    // Invoke the send-whatsapp-message Edge Function
    const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
      body: {
        conversacion_id: selected.id,
        content: content,
        disable_ai: true
      }
    });

    if (error) {
      console.error('Error sending message:', error);
      // Fallback
      await supabase.from('mensajes').insert({
        conversacion_id: selected.id,
        content,
        type: 'text',
        sender: 'human',
      });
      await supabase
        .from('conversaciones')
        .update({ last_message_at: new Date().toISOString(), ai_active: false })
        .eq('id', selected.id);
      return;
    }
  };

  const toggleAI = async () => {
    if (!selected) return;
    const newAiActive = !aiActive;
    setAiActive(newAiActive);

    await supabase
      .from('conversaciones')
      .update({ ai_active: newAiActive })
      .eq('id', selected.id);

    setConversations(convs => convs.map(c =>
      c.id === selected.id ? { ...c, ai_active: newAiActive } : c
    ));
    setSelected(prev => prev ? { ...prev, ai_active: newAiActive } : prev);
  };

  const handleSelectConv = (conv: Conversation) => {
    setSelected(conv);
    // Reset unread count
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
  };

  return (
    <div className="flex w-full h-full bg-surface-container-low overflow-hidden rounded-2xl shadow-sm border border-stone-200" style={{ height: "calc(100vh - 120px)" }}>
      {/* 1. Chat List Panel */}
      <section className="w-[380px] min-w-[380px] bg-surface flex flex-col border-r border-stone-200 overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-black font-headline text-stone-900 leading-none">Chats</h1>
          <p className="text-stone-500 text-sm mt-1">{filteredConvs.length} conversaciones activas</p>
          <div className="mt-4 relative w-full focus-within:ring-2 focus-within:ring-primary/50 rounded-full">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-stone-400 text-lg">search</span>
             <input 
                className="w-full pl-10 pr-4 py-2 bg-stone-100 border-none rounded-full focus:ring-0 text-sm font-body text-stone-700 outline-none" 
                placeholder="Buscar conversaciones..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
             />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2 no-scrollbar">
          {loading ? (
             <div className="flex justify-center p-8"><div className="animate-spin w-6 h-6 border-b-2 border-primary rounded-full"></div></div>
          ) : filteredConvs.length === 0 ? (
             <div className="text-center p-8 text-stone-400 text-sm">No hay conversaciones activas.</div>
          ) : (
            filteredConvs.map((conv, i) => {
              const isSelected = selected?.id === conv.id;
              
              // Calculate status tags
              const hasUnread = conv.unread_count > 0;
              let statusTag = '';
              let statusClass = '';

              if (hasUnread) {
                 statusTag = "NUEVO";
                 statusClass = "bg-tertiary text-on-tertiary";
              } else if (conv.ai_active) {
                 statusTag = "IA RESPONDIENDO";
                 statusClass = "bg-primary-fixed text-on-primary-fixed-variant";
              } else {
                 statusTag = "INTERVENIDO POR HUMANO";
                 statusClass = "bg-secondary-container text-on-secondary-container";
              }

              return (
                <div 
                  key={conv.id}
                  onClick={() => handleSelectConv(conv)}
                  className={`p-4 rounded-2xl transition-all cursor-pointer shadow-sm border ${
                    isSelected 
                      ? "bg-surface-container-low border-l-4 border-l-primary border-transparent" 
                      : "hover:bg-surface-container-low border-transparent bg-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-headline font-bold text-stone-900">{conv.customer_name}</span>
                    <span className="text-[10px] font-medium text-stone-400">{timeAgo(conv.last_message_at)}</span>
                  </div>
                  <p className={`text-xs ${hasUnread ? 'text-stone-800 font-semibold' : 'text-stone-500'} line-clamp-1 mb-2`}>
                    {conv.last_message || "..."}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`${statusClass} text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider`}>
                      {statusTag}
                    </span>
                    {hasUnread && (
                       <div className="w-5 h-5 flex items-center justify-center bg-primary rounded-full text-white font-bold text-[10px]">
                         {conv.unread_count}
                       </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2. Chat Window Panel */}
      <section className="flex-1 bg-surface-container-low flex flex-col relative overflow-hidden">
        {selected ? (
          <>
            {/* Header Ventana */}
            <div className="h-20 flex-shrink-0 bg-surface-container-lowest px-8 flex items-center justify-between border-b border-stone-200">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-headline font-bold uppercase">
                  {getInitial(selected.customer_name)}
                </div>
                <div>
                  <h2 className="font-headline font-extrabold text-stone-900 leading-tight">{selected.customer_name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-stone-400">{selected.customer_phone} • WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* Botones Accionables IA */}
              <div className="flex items-center gap-3">
                <div className={`px-4 py-2 ${aiActive ? 'bg-primary-fixed' : 'bg-surface-container-high'} rounded-full flex items-center gap-2 transition-colors`}>
                  <span className={`material-symbols-outlined text-sm ${aiActive ? 'text-primary' : 'text-stone-400'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                  <span className={`text-xs font-bold ${aiActive ? 'text-on-primary-fixed-variant' : 'text-stone-500'}`}>
                    {aiActive ? "IA Activa" : "IA Pausada"}
                  </span>
                </div>
                <button 
                  onClick={toggleAI}
                  className={`${aiActive ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-primary border-2 border-primary'} px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-primary/10 hover:scale-105 transition-transform active:scale-95`}
                >
                  {aiActive ? "Tomar Control" : "Reactivar IA"}
                </button>
                <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-stone-500">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
              {messages.length === 0 && (
                <div className="flex justify-center mt-10 text-stone-400 text-sm">
                   Aún no hay mensajes en esta conversación.
                </div>
              )}
              {messages.map((msg) => {
                const isCustomer = msg.sender === 'customer';
                const isAi = msg.sender === 'ai';
                const time = new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

                if (isCustomer) {
                  return (
                    <div key={msg.id} className="flex flex-col items-start max-w-[75%] md:max-w-[70%]">
                      <div className="bg-surface-container-lowest p-4 rounded-2xl rounded-tl-none shadow-sm text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-stone-400 mt-2 ml-1">{time}</span>
                    </div>
                  );
                } else {
                  return (
                    <div key={msg.id} className="flex flex-col items-end ml-auto max-w-[75%] md:max-w-[70%]">
                      <div className={`p-4 rounded-2xl rounded-tr-none shadow-md text-sm leading-relaxed relative whitespace-pre-wrap ${
                        isAi 
                          ? 'bg-primary-container text-on-primary-container' 
                          : 'bg-stone-800 text-white'
                      }`}>
                        {msg.content}
                        <div className="absolute -left-10 lg:-left-12 top-0 flex flex-col items-center">
                           <span className="material-symbols-outlined text-stone-400 text-lg" style={{ fontVariationSettings: isAi ? "'FILL' 1" : "'FILL' 0", color: isAi ? "var(--color-primary)" : "var(--color-stone-400)" }}>
                             {isAi ? "smart_toy" : "person"}
                           </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-400 mt-2 mr-1">
                        {isAi ? "IA" : "Agente"} • {time}
                      </span>
                    </div>
                  );
                }
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-surface-container-lowest border-t border-stone-100 flex-shrink-0">
              <div className="flex items-end gap-2 md:gap-4 bg-surface-container-high rounded-3xl p-2 px-2 md:px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
                <button className="p-2 text-stone-500 hover:text-primary transition-colors hidden sm:block">
                  <span className="material-symbols-outlined">add_circle</span>
                </button>
                <textarea 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 min-h-[44px] max-h-32 resize-none leading-relaxed text-stone-800 outline-none" 
                  placeholder={aiActive ? "La IA está manejando este chat. Toma el control para responder." : `Escribe un mensaje para ${selected.customer_name}...`}
                  rows={1}
                  value={input}
                  disabled={aiActive}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button className="p-2 text-stone-500 hover:text-primary transition-colors hidden sm:block">
                  <span className="material-symbols-outlined">mood</span>
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || aiActive}
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    input.trim() && !aiActive 
                      ? "bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95" 
                      : "bg-surface text-stone-400"
                  } mb-1`}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-4">
             <span className="material-symbols-outlined text-6xl opacity-20">forum</span>
             <p className="font-body text-sm font-medium">Selecciona una conversación para leer y enviar mensajes</p>
          </div>
        )}
      </section>

      {/* 3. Order History Sidebar (Right) */}
      <aside className="hidden lg:flex w-[320px] bg-surface flex-col border-l border-stone-200">
        {selected ? (
          <>
            <div className="p-6 border-b border-stone-100 bg-surface-container-low/50">
              <h3 className="font-headline font-bold text-stone-900 mb-4">Perfil del Cliente</h3>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-stone-800 truncate">{selected.customer_name}</p>
                  <p className="text-xs text-stone-500 truncate">{selected.customer_phone}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-lowest p-3 rounded-2xl shadow-sm border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Pedidos Totales</p>
                  <p className="text-xl font-headline font-black text-primary">{customerOrders.length}</p>
                </div>
                <div className="bg-surface-container-lowest p-3 rounded-2xl shadow-sm border border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Gasto Total</p>
                  <p className="text-xl font-headline font-black text-primary">${customerTotalSpent.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-headline font-bold text-stone-800 text-sm">Historial de Pedidos</h4>
              </div>

              {customerOrders.length > 0 ? (
                <div className="space-y-4">
                  {customerOrders.map(order => (
                    <div key={order.id} className="p-4 rounded-2xl bg-surface-container-low border border-transparent hover:border-outline-variant/20 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-stone-900">#ORD-{order.order_number}</span>
                        <span className="text-[10px] font-medium text-stone-400">
                           {new Date(order.created_at).toLocaleDateString("es-ES", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mb-3 line-clamp-2">
                        {order.notes || "Sin descripción"}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-stone-900">${Number(order.total).toFixed(2)}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest text-stone-500 font-bold capitalize">
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-stone-400 text-xs text-center py-6 border border-dashed border-stone-200 rounded-xl">
                  Sin pedidos anteriores
                </div>
              )}
            </div>

            <div className="mt-auto p-6 border-t border-stone-100 bg-surface-container-lowest">
              <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <p className="text-xs font-bold text-orange-900 mb-2">Notas del Concierge</p>
                <p className="text-[11px] text-orange-800 leading-relaxed italic">
                  Las notas automatizadas y preferencias de clientes se mostrarán aquí próximamente en base a su historial.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-300 gap-4">
             <span className="material-symbols-outlined text-4xl opacity-20">person_off</span>
             <p className="text-xs font-medium">No hay selección</p>
          </div>
        )}
      </aside>
    </div>
  );
}
