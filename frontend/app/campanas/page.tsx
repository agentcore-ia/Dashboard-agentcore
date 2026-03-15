"use client";

import { useState } from "react";
import { Megaphone, Send, Wand2, Plus, Users, Trash2 } from "lucide-react";

const DEMO_CONTACTS = [
  "+5511987654321", "+5511976543210", "+18972544744",
  "+5511965432109", "+5511954321098", "+5511943210987",
];

const DEMO_CAMPAIGNS = [
  { id: "1", name: "Promo Viernes", message: "🍔 ¡Promo del día! 50% OFF en la Beast Classic. ¡Solo hoy!", status: "sent", sent_count: 5, total_contacts: 5, created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "rgba(34,197,94,0.15)", sending: "rgba(59,130,246,0.15)", draft: "rgba(107,114,128,0.15)"
};
const STATUS_TEXT: Record<string, string> = { sent: "#4ade80", sending: "#60a5fa", draft: "#9ca3af" };

const VARIATIONS = [
  "🍔 ¡Promo especial hoy! Ven a probar nuestras hamburguesas con un descuento especial.",
  "No te pierdas la promoción de hoy 🔥 ¡Hamburguesas a un precio especial por tiempo limitado!",
  "¡Buenas tardes! Tenemos una oferta imperdible esperándote 👀",
];

export default function DisparadorPage() {
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showVariations, setShowVariations] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const toggleContact = (phone: string) => {
    setSelectedContacts(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const toggleAll = () => {
    if (selectAll) { setSelectedContacts([]); setSelectAll(false); }
    else { setSelectedContacts([...DEMO_CONTACTS]); setSelectAll(true); }
  };

  const handleSend = () => {
    if (!name || !message || selectedContacts.length === 0) return;
    setSending(true);
    setTimeout(() => {
      setCampaigns(prev => [{
        id: Date.now().toString(), name, message,
        status: "sent", sent_count: selectedContacts.length,
        total_contacts: selectedContacts.length,
        created_at: new Date().toISOString(),
      }, ...prev]);
      setName(""); setMessage(""); setSelectedContacts([]); setSelectAll(false);
      setSending(false);
    }, 1500);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-xl">Disparador de Campañas</h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Envía promociones vía WhatsApp con variaciones de IA</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create Campaign */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva Campaña
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Nombre de la campaña</label>
              <input className="input-dark text-sm" placeholder="Ej: Promoción de Viernes" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Mensaje base</label>
              <textarea
                className="input-dark text-sm resize-none"
                rows={4}
                placeholder="La IA creará variaciones de este mensaje automáticamente..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            {/* AI Variations Preview */}
            {message.length > 10 && (
              <div>
                <button
                  onClick={() => setShowVariations(v => !v)}
                  className="btn-ghost text-xs flex items-center gap-1.5 w-full justify-center"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {showVariations ? "Ocultar" : "Ver"} variaciones de IA (demo)
                </button>
                {showVariations && (
                  <div className="mt-2 space-y-2">
                    {VARIATIONS.map((v, i) => (
                      <div key={i} className="text-xs p-2 rounded-lg" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "rgba(255,255,255,0.7)" }}>
                        {i + 1}. {v}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delay info */}
            <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <p style={{ color: "#60a5fa" }}>⏱ Envíos con intervalos aleatorios: 30s a 5min</p>
              <p className="mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Evita el bloqueo de WhatsApp</p>
            </div>

            <button onClick={handleSend} disabled={!name || !message || selectedContacts.length === 0 || sending} className="btn-primary w-full flex items-center justify-center gap-2">
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4" /> Disparar a {selectedContacts.length} contactos</>
              )}
            </button>
          </div>
        </div>

        {/* Contact list */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Contactos ({DEMO_CONTACTS.length})
            </h2>
            <button onClick={toggleAll} className="text-xs btn-ghost">
              {selectAll ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>
          <div className="space-y-2">
            {DEMO_CONTACTS.map((phone, i) => {
              const names = ["Pedro Machado", "Kaua Parizzi", "Natalia", "Vanessa Souza", "Kamila Vieira", "Vini"];
              const isSelected = selectedContacts.includes(phone);
              return (
                <button
                  key={phone}
                  onClick={() => toggleContact(phone)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${isSelected ? "bg-green-500/10 border border-green-500/25" : "glass-card-hover"}`}
                  style={!isSelected ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" } : {}}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-green-500 border-green-500" : "border-gray-600"}`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-sm">{names[i] || phone}</span>
                  <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{phone}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Campaign history */}
      <div className="glass-card p-5 mt-6">
        <h2 className="font-semibold text-sm mb-4">Historial de Campañas</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Sin campañas aún</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{c.message.substring(0, 60)}...</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-semibold">{c.sent_count}/{c.total_contacts}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>enviados</p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: STATUS_COLORS[c.status], color: STATUS_TEXT[c.status] }}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
