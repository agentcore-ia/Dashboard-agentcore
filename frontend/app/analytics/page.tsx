"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Metrics {
  ingresos_totales: number;
  pedidos_totales: number;
  pedidos_entregados: number;
  pedidos_semana: number;
  ingresos_semana: number;
  ticket_promedio: number;
  total_conversaciones: number;
  conversaciones_activas: number;
  por_whatsapp: number;
  por_instagram: number;
  humano_activo: number;
  loaded: boolean;
}

const defaultMetrics: Metrics = {
  ingresos_totales: 0,
  pedidos_totales: 0,
  pedidos_entregados: 0,
  pedidos_semana: 0,
  ingresos_semana: 0,
  ticket_promedio: 0,
  total_conversaciones: 0,
  conversaciones_activas: 0,
  por_whatsapp: 0,
  por_instagram: 0,
  humano_activo: 0,
  loaded: false,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n: number) { return new Intl.NumberFormat("es-AR").format(n); }

// ─── Sparkline (SVG bar chart) ─────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, badge, color, loading
}: {
  label: string; value: string; sub?: string; icon: string; badge?: string; color: string; loading: boolean;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-stone-100/70 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between mb-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white`} style={{ background: color }}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        {badge && (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 rounded-lg bg-stone-100 animate-pulse w-3/4" />
          <div className="h-4 rounded-lg bg-stone-50 animate-pulse w-1/2" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-black text-on-surface font-headline tracking-tight">{value}</p>
          <p className="text-xs text-stone-400 mt-1 font-medium">{label}</p>
          {sub && <p className="text-[11px] text-stone-300 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics>(defaultMetrics);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    loadMetrics(Number(period));
  }, [period]);

  async function loadMetrics(days: number) {
    setMetrics(prev => ({ ...prev, loaded: false }));

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [pedidosRes, convRes] = await Promise.all([
      supabase
        .from("pedidos")
        .select("total, status, created_at")
        .gte("created_at", since),
      supabase
        .from("conversaciones")
        .select("id, status, source, ai_active, created_at")
        .gte("created_at", since),
    ]);

    const pedidos = pedidosRes.data ?? [];
    const convs   = convRes.data   ?? [];

    const ingresos_totales  = pedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    const pedidos_entregados = pedidos.filter(p => p.status === "delivered").length;
    const pedidos_semana    = pedidos.filter(p => p.created_at >= weekAgo).length;
    const ingresos_semana   = pedidos
      .filter(p => p.created_at >= weekAgo)
      .reduce((acc, p) => acc + (Number(p.total) || 0), 0);

    setMetrics({
      ingresos_totales,
      pedidos_totales: pedidos.length,
      pedidos_entregados,
      pedidos_semana,
      ingresos_semana,
      ticket_promedio: pedidos.length > 0 ? ingresos_totales / pedidos.length : 0,
      total_conversaciones: convs.length,
      conversaciones_activas: convs.filter(c => c.status === "active").length,
      por_whatsapp: convs.filter(c => c.source === "whatsapp").length,
      por_instagram: convs.filter(c => c.source === "instagram").length,
      humano_activo: convs.filter(c => !c.ai_active).length,
      loaded: true,
    });
  }

  const loading = !metrics.loaded;
  const convRate = metrics.total_conversaciones > 0
    ? ((metrics.pedidos_entregados / metrics.total_conversaciones) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Analíticas</h2>
          <p className="text-stone-400 mt-1 font-body">Datos en tiempo real de tu operación</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low rounded-xl p-1.5">
          {[["7", "7 días"], ["30", "30 días"], ["90", "90 días"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all tracking-wide ${
                period === v
                  ? "bg-primary text-white shadow-sm"
                  : "text-stone-400 hover:text-stone-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label="Ingresos totales"
          value={fmtCurrency(metrics.ingresos_totales)}
          sub={`Esta semana: ${fmtCurrency(metrics.ingresos_semana)}`}
          icon="payments"
          color="#16a34a"
          badge={metrics.ingresos_semana > 0 ? "Activo" : undefined}
          loading={loading}
        />
        <KpiCard
          label="Pedidos totales"
          value={fmtNum(metrics.pedidos_totales)}
          sub={`Esta semana: ${metrics.pedidos_semana}`}
          icon="shopping_bag"
          color="#2563eb"
          loading={loading}
        />
        <KpiCard
          label="Pedidos entregados"
          value={fmtNum(metrics.pedidos_entregados)}
          sub={metrics.pedidos_totales > 0 ? `${((metrics.pedidos_entregados / metrics.pedidos_totales) * 100).toFixed(0)}% de completación` : "—"}
          icon="check_circle"
          color="#7c3aed"
          loading={loading}
        />
        <KpiCard
          label="Ticket promedio"
          value={fmtCurrency(metrics.ticket_promedio)}
          sub="por pedido"
          icon="receipt_long"
          color="#d97706"
          loading={loading}
        />
      </div>

      {/* Row 2: Conversation KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Conversaciones"
          value={fmtNum(metrics.total_conversaciones)}
          sub={`${metrics.conversaciones_activas} activas ahora`}
          icon="forum"
          color="#0891b2"
          loading={loading}
        />
        <KpiCard
          label="WhatsApp"
          value={fmtNum(metrics.por_whatsapp)}
          sub="mensajes de canal"
          icon="chat"
          color="#25d366"
          loading={loading}
        />
        <KpiCard
          label="Instagram"
          value={fmtNum(metrics.por_instagram)}
          sub="mensajes de canal"
          icon="photo_camera"
          color="#e1306c"
          loading={loading}
        />
        <KpiCard
          label="Tasa de conversión"
          value={`${convRate}%`}
          sub="pedidos / conversaciones"
          icon="trending_up"
          color="#ef4444"
          loading={loading}
        />
      </div>

      {/* Row 3: Charts section */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Canal breakdown */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-stone-100/70">
          <h3 className="font-headline text-base font-bold text-on-surface mb-6">Canales de Comunicación</h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-stone-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-5">
              {[
                { label: "WhatsApp", value: metrics.por_whatsapp, color: "#25d366", icon: "chat" },
                { label: "Instagram", value: metrics.por_instagram, color: "#e1306c", icon: "photo_camera" },
                {
                  label: "Control Humano",
                  value: metrics.humano_activo,
                  color: "#f59e0b",
                  icon: "support_agent",
                },
              ].map(item => {
                const max = Math.max(metrics.por_whatsapp, metrics.por_instagram, metrics.humano_activo, 1);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ color: item.color }}>{item.icon}</span>
                        <span className="text-sm font-semibold text-on-surface">{item.label}</span>
                      </div>
                      <span className="text-sm font-black text-on-surface">{item.value}</span>
                    </div>
                    <MiniBar value={item.value} max={max} color={item.color} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Estado de IA */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-stone-100/70">
          <h3 className="font-headline text-base font-bold text-on-surface mb-6">Estado del Agente IA</h3>
          {loading ? (
            <div className="space-y-3">
              <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
              <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* IA Active ring */}
              <div className="flex items-center gap-5 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="relative shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#d1fae5" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3"
                      strokeDasharray={`${metrics.total_conversaciones > 0 ? ((metrics.total_conversaciones - metrics.humano_activo) / metrics.total_conversaciones) * 100 : 0} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-emerald-700">
                    {metrics.total_conversaciones > 0
                      ? `${Math.round(((metrics.total_conversaciones - metrics.humano_activo) / metrics.total_conversaciones) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-emerald-800 text-sm">IA Activa</p>
                  <p className="text-emerald-600 text-xs mt-0.5">{metrics.total_conversaciones - metrics.humano_activo} conversaciones gestionadas por IA</p>
                </div>
              </div>
              <div className="flex items-center gap-5 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="relative shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#fef3c7" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray={`${metrics.total_conversaciones > 0 ? (metrics.humano_activo / metrics.total_conversaciones) * 100 : 0} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-amber-700">
                    {metrics.total_conversaciones > 0
                      ? `${Math.round((metrics.humano_activo / metrics.total_conversaciones) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-amber-800 text-sm">Control Humano</p>
                  <p className="text-amber-600 text-xs mt-0.5">{metrics.humano_activo} conversaciones bajo control manual</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom insights row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Pedidos esta semana",
            value: loading ? "—" : fmtNum(metrics.pedidos_semana),
            sub: "últimos 7 días",
            icon: "calendar_today",
            color: "#6366f1",
          },
          {
            label: "Ingresos esta semana",
            value: loading ? "—" : fmtCurrency(metrics.ingresos_semana),
            sub: "últimos 7 días",
            icon: "trending_up",
            color: "#059669",
          },
          {
            label: "Conversaciones activas",
            value: loading ? "—" : fmtNum(metrics.conversaciones_activas),
            sub: "en este momento",
            icon: "bolt",
            color: "#dc2626",
          },
        ].map(item => (
          <div
            key={item.label}
            className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-stone-100/70 flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: item.color }}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
            </div>
            <div>
              <p className="font-black text-xl text-on-surface font-headline">
                {loading ? <span className="inline-block w-16 h-5 bg-stone-100 rounded animate-pulse" /> : item.value}
              </p>
              <p className="text-xs font-semibold text-stone-500">{item.label}</p>
              <p className="text-[10px] text-stone-300">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
