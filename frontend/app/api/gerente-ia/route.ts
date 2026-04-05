import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── Same Supabase config used by the rest of the app ──────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eqnjyygokjinmsfvogxi.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Fetch business context ────────────────────────────────
async function fetchBusinessContext() {
  const empty = {
    hoy: { ventas: 0, pedidos: 0, ticketPromedio: 0, horaPico: 'Sin datos' },
    semana: { ventas: 0, cambio: 0 },
    mes: { pedidos: 0, ventasPorDia: {} as Record<string, { total: number; count: number }> },
    mesas: { ocupadas: 0, libres: 0, total: 0 },
    productos: { total: 0, topVentas: [] as Array<{ nombre: string; cantidad: number }>, catalogo: [] as any[] },
  };

  try {
    // FIX TZ: Use exact minus hours to avoid UTC midnight crossover issues
    const now = Date.now();
    const past24Hours = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [pedidosHoyRes, pedidosMesRes, mesasRes, productosRes] = await Promise.allSettled([
      supabase.from('pedidos').select('*, items_pedido(*)').gte('created_at', past24Hours),
      supabase.from('pedidos').select('*, items_pedido(*)').gte('created_at', thirtyDaysAgo),
      supabase.from('mesas').select('*'),
      supabase.from('productos').select('*'),
    ]);

    const pedidosHoy: any[] = pedidosHoyRes.status === 'fulfilled' ? (pedidosHoyRes.value.data || []) : [];
    const pedidosMes: any[] = pedidosMesRes.status === 'fulfilled' ? (pedidosMesRes.value.data || []) : [];
    const mesas: any[] = mesasRes.status === 'fulfilled' ? (mesasRes.value.data || []) : [];
    const productos: any[] = productosRes.status === 'fulfilled' ? (productosRes.value.data || []) : [];

    // Daily stats (last 24 hours to avoid UTC split)
    const ventasHoy = pedidosHoy.reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
    const ticketPromedio = pedidosHoy.length > 0 ? Math.round(ventasHoy / pedidosHoy.length) : 0;

    // Hour peak
    const ventasPorHora: Record<number, number> = {};
    pedidosHoy.forEach((p) => {
      const h = new Date(p.created_at).getHours();
      ventasPorHora[h] = (ventasPorHora[h] || 0) + 1;
    });
    const horaPicoEntry = Object.entries(ventasPorHora).sort(([, a], [, b]) => b - a)[0];
    const horaPico = horaPicoEntry ? `${horaPicoEntry[0]}:00hs (${horaPicoEntry[1]} pedidos)` : 'Sin datos';

    // Day of week distribution
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const ventasPorDia: Record<string, { total: number; count: number }> = {};
    pedidosMes.forEach((p) => {
      const d = dias[new Date(p.created_at).getDay()];
      if (!ventasPorDia[d]) ventasPorDia[d] = { total: 0, count: 0 };
      ventasPorDia[d].total += Number(p.total) || Number(p.monto) || 0;
      ventasPorDia[d].count += 1;
    });

    // Top products from order items
    const productCount: Record<string, number> = {};
    pedidosMes.forEach((p) => {
      const items = Array.isArray(p.items_pedido) ? p.items_pedido : Array.isArray(p.items) ? p.items : Array.isArray(p.productos) ? p.productos : [];
      items.forEach((item: any) => {
        const n = item.name || item.nombre || item.producto || 'Desconocido';
        productCount[n] = (productCount[n] || 0) + (Number(item.quantity) || Number(item.cantidad) || 1);
      });
    });
    const topVentas = Object.entries(productCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    // Weekly comparison
    const ventasSemana = pedidosMes
      .filter((p) => p.created_at >= sevenDaysAgo)
      .reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
    const ventasSemanaAnt = pedidosMes
      .filter((p) => p.created_at >= fourteenDaysAgo && p.created_at < sevenDaysAgo)
      .reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
    const cambio = ventasSemanaAnt > 0
      ? Math.round(((ventasSemana - ventasSemanaAnt) / ventasSemanaAnt) * 100) : 0;

    return {
      hoy: { ventas: ventasHoy, pedidos: pedidosHoy.length, ticketPromedio, horaPico },
      semana: { ventas: ventasSemana, cambio },
      mes: { pedidos: pedidosMes.length, ventasPorDia },
      mesas: {
        ocupadas: mesas.filter((m) => m.status === 'occupied').length,
        libres: mesas.filter((m) => m.status === 'free').length,
        total: mesas.length,
      },
      productos: {
        total: productos.length,
        topVentas,
        catalogo: productos.slice(0, 20).map((p) => ({
          nombre: p.name || p.nombre,
          precio: p.price || p.precio,
          categoria: p.category || p.categoria,
        })),
      },
    };
  } catch (e) {
    console.error('fetchBusinessContext error:', e);
    return empty;
  }
}

// ── Auto insights ─────────────────────────────────────────
function generateInsights(ctx: Awaited<ReturnType<typeof fetchBusinessContext>>) {
  const insights: Array<{ tipo: string; mensaje: string }> = [];

  if (ctx.semana.cambio < -10)
    insights.push({ tipo: 'warning', mensaje: `Ventas bajaron ${Math.abs(ctx.semana.cambio)}% vs semana anterior` });
  else if (ctx.semana.cambio > 15)
    insights.push({ tipo: 'trend', mensaje: `Ventas crecieron ${ctx.semana.cambio}% vs semana anterior 🚀` });

  if (ctx.productos.topVentas.length > 0)
    insights.push({ tipo: 'trend', mensaje: `Tendencia: ${ctx.productos.topVentas[0].nombre} (${ctx.productos.topVentas[0].cantidad} pedidos este mes)` });

  if (ctx.mesas.ocupadas > 0)
    insights.push({ tipo: 'info', mensaje: `${ctx.mesas.ocupadas} mesa${ctx.mesas.ocupadas !== 1 ? 's' : ''} ocupada${ctx.mesas.ocupadas !== 1 ? 's' : ''} ahora` });

  if (ctx.hoy.pedidos === 0)
    insights.push({ tipo: 'warning', mensaje: 'Pocos pedidos registrados en las últimas 24 hs' });

  const diasVentas = Object.entries(ctx.mes.ventasPorDia).sort(([, a], [, b]) => a.total - b.total);
  if (diasVentas.length > 0)
    insights.push({ tipo: 'info', mensaje: `Día con menos ventas del mes: ${diasVentas[0][0]}` });

  return insights;
}

// ── Call AI ───────────────────────────────────────────────
async function callAI(question: string, ctx: Awaited<ReturnType<typeof fetchBusinessContext>>): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const ctxStr = JSON.stringify({
    hoy: ctx.hoy,
    semana: ctx.semana,
    mesas: ctx.mesas,
    topProductos: ctx.productos.topVentas.slice(0, 5),
    ventasPorDia: ctx.mes.ventasPorDia,
    totalProductosCatalogo: ctx.productos.total,
  });

  const systemPrompt = `Eres el Gerente IA de un restaurante argentino. Analizás datos reales del negocio y das respuestas claras, directas y accionables en español rioplatense. Usá emojis para facilitar la lectura. Incluí números reales, comparaciones y recomendaciones concretas. Datos actuales del restaurante: ${ctxStr}. Respondé de forma estructurada, máximo 300 palabras.`;

  // Try Gemini first
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nPregunta: ${question}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) { console.error('Gemini error:', e); }
  }

  // Try OpenAI
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;
      console.error('OpenAI issue:', JSON.stringify(data));
    } catch (e) { console.error('OpenAI fetch error:', e); }
  }

  // Rule-based fallback (always works, uses real data)
  const q = question.toLowerCase();

  // If no AI is available and the query is complex, advise the user.
  const isBasicQuery = q.includes('ventas') || q.includes('resumen') || q.includes('hoy') || q.includes('día') || 
                       q.includes('dia') || q.includes('product') || q.includes('promoci') || q.includes('vend') || 
                       q.includes('popular') || q.includes('mesa') || q.includes('hora') || q.includes('pico') || 
                       q.includes('tráfico') || q.includes('trafico') || q.includes('semana') || q.includes('seman');

  if (!isBasicQuery) {
    return `⚠️ **Cerebro Inteligente Apagado**
    
Actualmente estoy funcionando en "Modo de Emergencia" (solo datos básicos) porque no pudo conectar a OpenAI o Gemini.
Intentá hacer preguntas simples como "resumen del día", "top productos" o "mesas libres" o revisa tus tokens de OpenAI en Easypanel (OPENAI_API_KEY).`;
  }

  if (q.includes('ventas') || q.includes('resumen') || q.includes('hoy') || q.includes('día') || q.includes('dia'))
    return `📊 **Resumen de las últimas 24 horas**\n\n💰 Ventas: $${ctx.hoy.ventas.toLocaleString('es-AR')}\n📦 Pedidos: ${ctx.hoy.pedidos}\n🎯 Ticket promedio: $${ctx.hoy.ticketPromedio.toLocaleString('es-AR')}\n⏰ Hora pico: ${ctx.hoy.horaPico}\n\n📈 Últimos 7 días vs anterior: ${ctx.semana.cambio > 0 ? '+' : ''}${ctx.semana.cambio}%${ctx.productos.topVentas[0] ? `\n\n🔥 Más vendido: **${ctx.productos.topVentas[0].nombre}** (${ctx.productos.topVentas[0].cantidad} pedidos)` : ''}`;

  if (q.includes('product') || q.includes('promoci') || q.includes('vend') || q.includes('popular'))
    return `🏆 **Top productos (último mes)**\n\n${ctx.productos.topVentas.slice(0, 5).map((p, i) => `${i + 1}. ${p.nombre}: ${p.cantidad} pedidos`).join('\n') || 'Sin datos de ventas aún'}\n\n💡 Creá combos o promociones con los más vendidos para aumentar el ticket promedio.`;

  if (q.includes('mesa'))
    return `🪑 **Estado de mesas**\n\n✅ Ocupadas: ${ctx.mesas.ocupadas}\n⚪ Libres: ${ctx.mesas.libres}\n📊 Total: ${ctx.mesas.total}\n📈 Ocupación: ${ctx.mesas.total > 0 ? Math.round((ctx.mesas.ocupadas / ctx.mesas.total) * 100) : 0}%`;

  if (q.includes('hora') || q.includes('pico') || q.includes('tráfico') || q.includes('trafico'))
    return `⏰ **Análisis horario**\n\nHora pico (últimas 24hs): ${ctx.hoy.horaPico}\n\n📅 **Ventas por día (último mes):**\n${Object.entries(ctx.mes.ventasPorDia).map(([d, v]) => `• ${d}: ${v.count} pedidos ($${v.total.toLocaleString('es-AR')})`).join('\n') || 'Sin datos aún'}\n\n💡 Identificá los días flojos y creá promos especiales para potenciar esos momentos.`;

  if (q.includes('semana') || q.includes('seman'))
    return `📅 **Resumen últimos 7 días**\n\n💰 Ventas: $${ctx.semana.ventas.toLocaleString('es-AR')}\n📊 Variación vs semana anterior: ${ctx.semana.cambio > 0 ? '+' : ''}${ctx.semana.cambio}%\n\n${ctx.semana.cambio < 0 ? '⚠️ Las ventas bajaron. Considerá activar promociones para recuperar el ritmo.' : ctx.semana.cambio > 10 ? '🚀 Excelente semana! Las ventas crecen.' : '✅ Ventas estables.'}`;

  return `🤖 Hola! Soy el Gerente IA.\n\n📊 **Estado actual:**\n• Ventas (24hs): $${ctx.hoy.ventas.toLocaleString('es-AR')}\n• Pedidos (24hs): ${ctx.hoy.pedidos}\n• Mesas: ${ctx.mesas.ocupadas}/${ctx.mesas.total}\n• Crecimiento semanal: ${ctx.semana.cambio > 0 ? '+' : ''}${ctx.semana.cambio}%`;
}

// ── POST ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = body?.question?.trim();
    if (!question) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 });

    const ctx = await fetchBusinessContext();
    const [answer, insights] = await Promise.all([
      callAI(question, ctx),
      Promise.resolve(generateInsights(ctx)),
    ]);

    return NextResponse.json({ answer, insights, context: { hoy: ctx.hoy, semana: ctx.semana } });
  } catch (err: any) {
    console.error('Gerente IA POST error:', err);
    return NextResponse.json({
      answer: `⚠️ Error inesperado: ${err.message}. Intentá de nuevo en unos segundos.`,
      insights: [],
    });
  }
}

// ── GET (insights only) ───────────────────────────────────
export async function GET() {
  try {
    const ctx = await fetchBusinessContext();
    return NextResponse.json({ insights: generateInsights(ctx), summary: ctx.hoy });
  } catch {
    return NextResponse.json({ insights: [], summary: null });
  }
}
