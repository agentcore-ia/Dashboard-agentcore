"use client";

// Force update to ensure deployment: 2026-03-18 01:00
import { useState, useEffect, useRef } from "react";
import { Search, Filter, Bot, User, Send, Paperclip, MoreVertical } from "lucide-react";
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

export default function ConversasPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [aiActive, setAiActive] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations from Supabase
  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      const { data: convs, error } = await supabase
        .from('conversaciones')
        .select(`
          id, status, ai_active, last_message_at, created_at,
          clientes!inner(name, phone)
        `)
        .eq('restaurant_id', RESTAURANT_ID)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
        return;
      }

      // Fetch last message and unread count for each conversation
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

  // Load messages when conversation changes
  useEffect(() => {
    if (!selected) return;
    setAiActive(selected.ai_active);

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', selected!.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from('mensajes')
        .update({ read: true })
        .eq('conversacion_id', selected!.id)
        .eq('sender', 'customer')
        .eq('read', false);
    }

    fetchMessages();
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

          // If the message belongs to the selected conversation, add it
          if (selected && newMsg.conversacion_id === selected.id) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }

          // Update the conversation list (last message, unread count)
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
          // Update selected conversation's ai_active
          if (selected && selected.id === updated.id) {
            setAiActive(updated.ai_active);
            setSelected(prev => prev ? { ...prev, ai_active: updated.ai_active } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected]);

  // Scroll to bottom when messages change
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
    // disable_ai: true => human is taking over manually from the dashboard
    const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
      body: {
        conversacion_id: selected.id,
        content: content,
        disable_ai: true
      }
    });

    if (error) {
      console.error('Error sending message:', error);
      // Fallback: If edge function fails (e.g. not deployed or secrets missing), 
      // just insert into DB so the user sees it in the chat, even if it didn't send to WA.
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
    setMobileView("chat");
    // Reset unread count
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
  };

  return (
    <div className="flex h-full lg:h-screen w-full relative overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
      {/* Left: conversation list */}
      <div
        className={`absolute inset-0 lg:static lg:block border-r transition-transform duration-300 z-10 lg:z-auto bg-gray-950 lg:bg-transparent lg:w-[320px] lg:min-w-[320px] lg:translate-x-0 ${
          mobileView === "list" ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ background: "rgba(10,10,20,0.95)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="w-full h-full flex flex-col">
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
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-20 lg:pb-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-white/40">No hay conversaciones</p>
              </div>
            ) : (
              filteredConvs.map((conv, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const isSelected = selected?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConv(conv)}
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
                        <span className="text-xs truncate text-white/50">
                          {conv.last_message || "..."}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {conv.unread_count > 0 && (
                            <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                          {conv.ai_active ? (
                            <span className="badge-ai flex-shrink-0 ml-1">IA</span>
                          ) : (
                            <span className="badge-human flex-shrink-0 ml-1">Humano</span>
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
      </div>

      {/* Right: chat window */}
      <div 
        className={`absolute inset-0 lg:static lg:flex lg:flex-1 bg-gray-950 lg:bg-transparent transition-transform duration-300 z-20 lg:z-auto lg:translate-x-0 ${
          mobileView === "chat" ? "translate-x-0 flex flex-col" : "translate-x-full lg:translate-x-0 hidden lg:flex lg:flex-col"
        }`} 
        style={{ background: "rgba(8,8,14,0.98)" }}
      >
        <div className="flex flex-col h-full w-full" style={{ background: "rgba(8,8,14,0.8)" }}>
          {selected ? (
            <>
              {/* Chat header */}
              <div
                className="flex items-center justify-between px-3 lg:px-5 py-3 border-b bg-gray-900/50 backdrop-blur-sm lg:bg-transparent"
                style={{ borderColor: "rgba(255,255,255,0.07)", minHeight: "64px" }}
              >
                <div className="flex items-center gap-2 lg:gap-3">
                  <button 
                    onClick={() => setMobileView("list")}
                    className="lg:hidden p-2 -ml-2 text-white/70 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div
                    className="w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "#f9731633", color: "#fb923c" }}
                  >
                    {getInitial(selected.customer_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{selected.customer_name}</p>
                    <p className="text-[10px] lg:text-xs truncate text-white/50">{selected.customer_phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
                  <button
                    onClick={toggleAI}
                    className={`text-[10px] lg:text-xs px-2 lg:px-3 py-1.5 rounded-lg font-medium transition-all ${
                      aiActive
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                        : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                    }`}
                  >
                    <span className="hidden sm:inline">{aiActive ? "Tomar Control" : "Volver a IA"}</span>
                    <span className="sm:hidden">{aiActive ? "Control" : "Auto IA"}</span>
                  </button>
                  <button className="btn-ghost w-8 h-8 p-0 flex items-center justify-center">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 lg:px-5 py-4 space-y-3 pb-20 lg:pb-4">
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
                      className={`max-w-[85%] lg:max-w-sm px-3 lg:px-4 py-2.5 text-sm leading-relaxed ${
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
                        <span className="text-[10px] lg:text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
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
                className="px-3 lg:px-4 py-3 border-t bg-gray-950 lg:bg-transparent absolute bottom-0 left-0 right-0 lg:static"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-2">
                  <button className="btn-ghost w-9 h-9 flex items-center justify-center p-0 flex-shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    className="input-dark flex-1 text-sm bg-white/5"
                    placeholder={aiActive ? "IA hablando (tome control)" : "Mensaje..."}
                    value={input}
                    disabled={aiActive}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    style={{ fontSize: "16px" /* Prevents iOS zoom */ }}
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
            <div className="flex-1 flex items-center justify-center hidden lg:flex">
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Seleccione una conversación</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
