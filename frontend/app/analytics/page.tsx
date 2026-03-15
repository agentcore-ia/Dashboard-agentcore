"use client";

import { useState } from "react";
import { TrendingUp, ShoppingBag, MessageSquare, Percent, DollarSign, CheckSquare, Users, Clock } from "lucide-react";

const DEMO_METRICS = {
  revenue: 0, orders_closed: 0, total_conversations: 805,
  conversion_rate: "0.00", avg_ticket: 0.0,
  deals_closed: 0, pending_leads: 0, response_time: 0,
  funnel: { iniciadas: 805, presentadas: 603, cotizaciones: 297, cerradas: 0 },
  top_products: [],
};

const METRIC_CARDS = [
  { key: "revenue", label: "Ingresos Totales (IA)", icon: DollarSign, color: "icon-green", format: (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}` },
  { key: "orders_closed", label: "Pedidos Cerrados", icon: ShoppingBag, color: "icon-blue", format: (v: number) => String(v) },
  { key: "total_conversations", label: "Conversaciones Totales", icon: MessageSquare, color: "icon-purple", format: (v: number) => String(v) },
  { key: "conversion_rate", label: "Tasa de Conversión", icon: Percent, color: "icon-orange", format: (v: string | number) => `${v}%` },
  { key: "avg_ticket", label: "Ticket Medio", icon: DollarSign, color: "icon-green", format: (v: number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}` },
  { key: "deals_closed", label: "Negocios Cerrados", icon: CheckSquare, color: "icon-teal", format: (v: number) => String(v) },
  { key: "pending_leads", label: "Leads Pendientes", icon: Users, color: "icon-red", format: (v: number) => String(v) },
  { key: "response_time", label: "Tiempo de Respuesta (IA)", icon: Clock, color: "icon-purple", format: (v: number) => v === 0 ? "0s" : `${v}s` },
];

const FUNNEL_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316"];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30");
  const m = DEMO_METRICS;

  const funnelRows = [
    { label: "Conversaciones Iniciadas", value: m.funnel.iniciadas, pct: 100, color: FUNNEL_COLORS[0] },
    { label: "Productos Presentados", value: m.funnel.presentadas, pct: Math.round((m.funnel.presentadas / (m.funnel.iniciadas || 1)) * 100), color: FUNNEL_COLORS[1] },
    { label: "Cotizaciones Enviadas", value: m.funnel.cotizaciones, pct: Math.round((m.funnel.cotizaciones / (m.funnel.iniciadas || 1)) * 100), color: FUNNEL_COLORS[2] },
    { label: "Pedidos Cerrados", value: m.funnel.cerradas, pct: Math.round((m.funnel.cerradas / (m.funnel.iniciadas || 1)) * 100), color: FUNNEL_COLORS[3] },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-xl">Analítica</h1>
        <div className="flex items-center gap-2">
          {["7", "30", "90"].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`text-xs px-3 py-1.5 rounded-lg ${period === d ? "btn-primary" : "btn-ghost"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {METRIC_CARDS.map(card => {
          const Icon = card.icon;
          const value = (m as any)[card.key] ?? 0;
          return (
            <div key={card.key} className="glass-card glass-card-hover p-4 fade-in">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
                  → 0%
                </span>
              </div>
              <p className="text-2xl font-bold mb-1">{card.format(value)}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{card.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>vs período anterior</p>
            </div>
          );
        })}
      </div>

      {/* Funnel + Top Products */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-sm mb-4">Embudo de Conversión</h2>
          <div className="space-y-4">
            {funnelRows.map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{row.label}</span>
                  <span className="font-semibold">{row.value} <span style={{ color: "rgba(255,255,255,0.4)" }}>({row.pct}%)</span></span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${row.pct}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-sm mb-4">Productos más vendidos por la IA</h2>
          {m.top_products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <span className="text-3xl mb-2">🍔</span>
              <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Sin productos vendidos aún</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Esperando las primeras ventas de la IA</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(m.top_products as any[]).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                      {i + 1}
                    </span>
                    {p.name}
                  </span>
                  <span className="font-semibold text-xs" style={{ color: "#4ade80" }}>
                    {p.qty}x · R$ {Number(p.total).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance insights */}
      <div className="glass-card p-5 mt-6">
        <h2 className="font-semibold text-sm mb-4">Métricas de Rendimiento</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Horario pico", value: "19:00–21:00", sub: "mayor volumen de pedidos" },
            { label: "Día más fuerte", value: "Viernes", sub: "basado en el histórico" },
            { label: "Satisfacción estimada", value: "4.8 ⭐", sub: "basado en recompras" },
          ].map(item => (
            <div key={item.label} className="glass-card p-4">
              <p className="font-bold text-lg">{item.value}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{item.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
