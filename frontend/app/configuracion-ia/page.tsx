"use client";

import { useState } from "react";
import { Settings, Bot, Eye, PowerOff, Save, Plus, BookOpen } from "lucide-react";

const MODES = [
  { key: "active", label: "IA Activa", desc: "La IA responde automáticamente a todos los clientes", icon: Bot, color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" },
  { key: "review", label: "Modo Revisión", desc: "La IA genera la respuesta, pero un humano debe aprobarla antes de enviarla", icon: Eye, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  { key: "disabled", label: "IA Desactivada", desc: "Todos los chats quedan en modo manual humano", icon: PowerOff, color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
];

const DEFAULT_PROMPT = `Eres Beastie, el asistente virtual de Beast Burgers 🍔

Tu función es atender a los clientes por WhatsApp de forma amable y eficiente.

## MENÚ
- Beast Classic — R$ 32,90
- Beast Double — R$ 44,90
- Beast Crispy (pollo) — R$ 29,90

## ACOMPAÑAMIENTOS
- Papas con Cheddar y Bacon - medianas — R$ 22,90
- Onion Rings — R$ 18,90

## BEBIDAS
- Refresco 600ml — R$ 9,00
- Jugo Natural 500ml — R$ 12,90

## REGLAS
1. Saludar por el nombre
2. Presentar el menú
3. Hacer upsell (bebida + papas)
4. Recopilar dirección o "retiro en el local"
5. Confirmar método de pago
6. Mostrar resumen y confirmar pedido`;

const DEMO_CORRECTIONS = [
  { id: "1", original_response: "¡Hola! ¿Cómo puedo ayudar?", corrected_response: "¡Hola Pedro! 👋 ¡Bienvenido a Beast Burgers! ¿Cómo puedo ayudarte hoy?", created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
];

export default function ConfigIAPage() {
  const [mode, setMode] = useState("active");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [temperature, setTemperature] = useState(0.7);
  const [saved, setSaved] = useState(false);
  const [corrections, setCorrections] = useState(DEMO_CORRECTIONS);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-xl">Configuración de la IA</h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Configure el comportamiento del agente de atención</p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="glass-card p-5 mb-6">
        <h2 className="font-semibold text-sm mb-1">Modo de Operación</h2>
        <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Controle cómo se comporta la IA en las conversaciones</p>
        <div className="grid md:grid-cols-3 gap-3">
          {MODES.map(m => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  background: active ? m.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? m.border : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: active ? m.color : "rgba(255,255,255,0.4)" }} />
                  <span className="text-sm font-semibold" style={{ color: active ? m.color : "rgba(255,255,255,0.7)" }}>{m.label}</span>
                  {active && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ background: m.color + "33", color: m.color }}>Activo</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* System prompt editor */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><BookOpen className="w-4 h-4" /> Prompt del Sistema</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Instruya a la IA sobre su restaurante, menú y tono de voz</p>
          </div>
        </div>
        <textarea
          className="input-dark text-xs font-mono resize-none w-full"
          rows={18}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
      </div>

      {/* Temperature */}
      <div className="glass-card p-5 mb-6">
        <h2 className="font-semibold text-sm mb-1">Creatividad de la Respuesta</h2>
        <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Temperatura: <span className="text-white font-bold">{temperature}</span> — {temperature < 0.4 ? "más precisa y enfocada" : temperature < 0.7 ? "equilibrada" : "más creativa y variada"}
        </p>
        <input
          type="range" min="0" max="1" step="0.1"
          value={temperature}
          onChange={e => setTemperature(parseFloat(e.target.value))}
          className="w-full accent-orange-500"
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
          <span>Precisa (0.0)</span><span>Creativa (1.0)</span>
        </div>
      </div>

      {/* Corrections log */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm">Log de Aprendizaje</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Cuando un agente humano edita una respuesta de la IA, ella aprende</p>
          </div>
          <button className="btn-ghost text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Agregar corrección
          </button>
        </div>
        {corrections.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "rgba(255,255,255,0.3)" }}>Ninguna corrección registrada aún</p>
        ) : (
          <div className="space-y-3">
            {corrections.map(c => (
              <div key={c.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-medium mb-1" style={{ color: "#ef4444" }}>❌ Original</p>
                    <p style={{ color: "rgba(255,255,255,0.6)" }}>{c.original_response}</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1" style={{ color: "#4ade80" }}>✅ Corregida</p>
                    <p style={{ color: "rgba(255,255,255,0.6)" }}>{c.corrected_response}</p>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {new Date(c.created_at).toLocaleDateString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <button onClick={handleSave} className="btn-primary flex items-center gap-2 px-6">
        <Save className="w-4 h-4" />
        {saved ? "✅ Guardado!" : "Guardar Configuraciones"}
      </button>
    </div>
  );
}
