import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ── Lazy Supabase init (avoids build-time env errors) ─────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key);
}

// ── Fetch business context from Supabase ──────────────────
async function fetchBusinessContext() {
  const sb = getSupabase();
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [pedidosHoyRes, pedidosMesRes, mesasRes, productosRes] = await Promise.allSettled([
    sb.from('pedidos').select('*').gte('created_at', today).order('created_at', { ascending: false }),
    sb.from('pedidos').select('*').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }),
    sb.from('mesas').select('*'),
    sb.from('productos').select('*'),
  ]);

  const pedidosHoy: any[] = pedidosHoyRes.status === 'fulfilled' ? (pedidosHoyRes.value.data || []) : [];
  const pedidosMes: any[] = pedidosMesRes.status === 'fulfilled' ? (pedidosMesRes.value.data || []) : [];
  const mesas: any[] = mesasRes.status === 'fulfilled' ? (mesasRes.value.data || []) : [];
  const productos: any[] = productosRes.status === 'fulfilled' ? (productosRes.value.data || []) : [];

  // Daily stats
  const ventasHoy = pedidosHoy.reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
  const ticketPromedio = pedidosHoy.length > 0 ? Math.round(ventasHoy / pedidosHoy.length) : 0;

  // Hour distribution
  const ventasPorHora: Record<number, number> = {};
  pedidosHoy.forEach((p) => {
    const hora = new Date(p.created_at).getHours();
    ventasPorHora[hora] = (ventasPorHora[hora] || 0) + 1;
  });
  const horaPicoEntry = Object.entries(ventasPorHora).sort(([, a], [, b]) => b - a)[0];
  const horaPico = horaPicoEntry ? `${horaPicoEntry[0]}:00hs (${horaPicoEntry[1]} pedidos)` : 'Sin datos';

  // Day of week distribution
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const ventasPorDia: Record<string, { total: number; count: number }> = {};
  pedidosMes.forEach((p) => {
    const d = dias[new Date(p.created_at).getDay()];
    if (!ventasPorDia[d]) ventasPorDia[d] = { total: 0, count: 0 };
    ventasPorDia[d].total += Number(p.total) || Number(p.monto) || 0;
    ventasPorDia[d].count += 1;
  });

  // Top products
  const productCount: Record<string, number> = {};
  pedidosMes.forEach((p) => {
    const items = p.items || p.productos || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const n = item.name || item.nombre || item.producto || 'Desconocido';
        productCount[n] = (productCount[n] || 0) + (Number(item.quantity) || Number(item.cantidad) || 1);
      });
    }
  });
  const topVentas = Object.entries(productCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));

  // Weekly comparison
  const ventasSemana = pedidosMes
    .filter((p) => p.created_at >= sevenDaysAgo)
    .reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
  const ventasSemanaAnterior = pedidosMes
    .filter((p) => p.created_at >= fourteenDaysAgo && p.created_at < sevenDaysAgo)
    .reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
  const cambioPorcentual = ventasSemanaAnterior > 0
    ? Math.round(((ventasSemana - ventasSemanaAnterior) / ventasSemanaAnterior) * 100)
    : 0;

  return {
    hoy: { ventas: ventasHoy, pedidos: pedidosHoy.length, ticketPromedio, horaPico },
    semana: { ventas: ventasSemana, cambio: cambioPorcentual },
    mes: { pedidos: pedidosMes.length, ventasPorDia },
    mesas: {
      ocupadas: mesas.filter((m) => m.status === 'occupied').length,
      libres: mesas.filter((m) => m.status === 'free').length,
      total: mesas.length,
    },
    productos: {
      total: productos.length,
      topVentas,
      catalogo: productos.slice(0, 30).map((p) => ({
        nombre: p.name || p.nombre,
        precio: p.price || p.precio,
        categoria: p.category || p.categoria,
      })),
    },
  };
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
    insights.push({ tipo: 'warning', mensaje: 'No hay pedidos registrados hoy todavía' });

  const diasVentas = Object.entries(ctx.mes.ventasPorDia).sort(([, a], [, b]) => a.total - b.total);
  if (diasVentas.length > 0)
    insights.push({ tipo: 'info', mensaje: `Día con menos ventas del mes: ${diasVentas[0][0]}` });

  return insights;
}

// ── Call AI ───────────────────────────────────────────────
async function callAI(question: string, ctx: Awaited<ReturnType<typeof fetchBusinessContext>>): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `Eres el Gerente IA de un restaurante. Analizas los datos del negocio y das respuestas claras, concisas y accionables en español. Usa emojis. Incluye números reales, comparaciones y recomendaciones accionables. Datos actuales del restaurante: ${JSON.stringify(ctx)}. Responde de forma estructurada. Máximo 300 palabras.`;

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
    } catch (e) { console.error('OpenAI error:', e); }
  }

  // Fallback rule-based
  const q = question.toLowerCase();
  if (q.includes('ventas') || q.includes('resumen') || q.includes('hoy') || q.includes('día'))
    return `📊 **Resumen del día**\n\n💰 Ventas: $${ctx.hoy.ventas.toLocaleString('es-AR')}\n📦 Pedidos: ${ctx.hoy.pedidos}\n🎯 Ticket promedio: $${ctx.hoy.ticketPromedio.toLocaleString('es-AR')}\n⏰ Hora pico: ${ctx.hoy.horaPico}\n\n📈 Esta semana vs anterior: ${ctx.semana.cambio > 0 ? '+' : ''}${ctx.semana.cambio}%\n${ctx.productos.topVentas[0] ? `\n🔥 Más vendido: **${ctx.productos.topVentas[0].nombre}**` : ''}`;

  if (q.includes('producto') || q.includes('promoci'))
    return `🏆 **Top productos (último mes)**\n\n${ctx.productos.topVentas.slice(0, 5).map((p, i) => `${i + 1}. ${p.nombre}: ${p.cantidad} pedidos`).join('\n')}\n\n💡 Creá combos o promociones con los más vendidos para subir el ticket promedio.`;

  if (q.includes('mesa'))
    return `🪑 **Mesas ahora**\n\n✅ Ocupadas: ${ctx.mesas.ocupadas}\n⚪ Libres: ${ctx.mesas.libres}\n📊 Total: ${ctx.mesas.total}\nOcupación: ${ctx.mesas.total > 0 ? Math.round((ctx.mesas.ocupadas / ctx.mesas.total) * 100) : 0}%`;

  return `🤖 **Gerente IA**\n\nResumen rápido:\n• Ventas hoy: $${ctx.hoy.ventas.toLocaleString('es-AR')}\n• Pedidos: ${ctx.hoy.pedidos}\n• Mesas ocupadas: ${ctx.mesas.ocupadas}/${ctx.mesas.total}\n\nConfigurá OPENAI_API_KEY en environment para respuestas avanzadas con IA.`;
}

// ── POST ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question?.trim()) return NextResponse.json({ error: 'Pregunta vacía' }, { status: 400 });
    const ctx = await fetchBusinessContext();
    const [answer, insights] = await Promise.all([callAI(question, ctx), Promise.resolve(generateInsights(ctx))]);
    return NextResponse.json({ answer, insights, context: { hoy: ctx.hoy, semana: ctx.semana } });
  } catch (err: any) {
    console.error('Gerente IA POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── GET (insights only) ───────────────────────────────────
export async function GET() {
  try {
    const ctx = await fetchBusinessContext();
    return NextResponse.json({ insights: generateInsights(ctx), summary: ctx.hoy });
  } catch (err: any) {
    console.error('Gerente IA GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
