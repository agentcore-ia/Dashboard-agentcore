import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Safe Supabase context fetch (never throws) ────────────
async function fetchBusinessContext() {
  const empty = {
    hoy: { ventas: 0, pedidos: 0, ticketPromedio: 0, horaPico: 'Sin datos' },
    semana: { ventas: 0, cambio: 0 },
    mes: { pedidos: 0, ventasPorDia: {} as Record<string, { total: number; count: number }> },
    mesas: { ocupadas: 0, libres: 0, total: 0 },
    productos: { total: 0, topVentas: [] as Array<{ nombre: string; cantidad: number }>, catalogo: [] },
  };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return empty;

    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [pedidosHoyRes, pedidosMesRes, mesasRes, productosRes] = await Promise.allSettled([
      sb.from('pedidos').select('*').gte('created_at', today),
      sb.from('pedidos').select('*').gte('created_at', thirtyDaysAgo),
      sb.from('mesas').select('*'),
      sb.from('productos').select('*'),
    ]);

    const pedidosHoy: any[] = pedidosHoyRes.status === 'fulfilled' ? (pedidosHoyRes.value.data || []) : [];
    const pedidosMes: any[] = pedidosMesRes.status === 'fulfilled' ? (pedidosMesRes.value.data || []) : [];
    const mesas: any[] = mesasRes.status === 'fulfilled' ? (mesasRes.value.data || []) : [];
    const productos: any[] = productosRes.status === 'fulfilled' ? (productosRes.value.data || []) : [];

    const ventasHoy = pedidosHoy.reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
    const ticketPromedio = pedidosHoy.length > 0 ? Math.round(ventasHoy / pedidosHoy.length) : 0;

    const ventasPorHora: Record<number, number> = {};
    pedidosHoy.forEach((p) => {
      const h = new Date(p.created_at).getHours();
      ventasPorHora[h] = (ventasPorHora[h] || 0) + 1;
    });
    const horaPicoEntry = Object.entries(ventasPorHora).sort(([, a], [, b]) => b - a)[0];
    const horaPico = horaPicoEntry ? `${horaPicoEntry[0]}:00hs (${horaPicoEntry[1]} pedidos)` : 'Sin datos';

    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const ventasPorDia: Record<string, { total: number; count: number }> = {};
    pedidosMes.forEach((p) => {
      const d = dias[new Date(p.created_at).getDay()];
      if (!ventasPorDia[d]) ventasPorDia[d] = { total: 0, count: 0 };
      ventasPorDia[d].total += Number(p.total) || Number(p.monto) || 0;
      ventasPorDia[d].count += 1;
    });

    const productCount: Record<string, number> = {};
    pedidosMes.forEach((p) => {
      const items = Array.isArray(p.items) ? p.items : Array.isArray(p.productos) ? p.productos : [];
      items.forEach((item: any) => {
        const n = item.name || item.nombre || item.producto || 'Desconocido';
        productCount[n] = (productCount[n] || 0) + (Number(item.quantity) || Number(item.cantidad) || 1);
      });
    });
    const topVentas = Object.entries(productCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    const ventasSemana = pedidosMes
      .filter((p) => p.created_at >= sevenDaysAgo)
      .reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
    const ventasSemanaAnt = pedidosMes
      .filter((p) => p.created_at >= fourteenDaysAgo && p.created_at < sevenDaysAgo)
      .reduce((s, p) => s + (Number(p.total) || Number(p.monto) || 0), 0);
    const cambio = ventasSemanaAnt > 0 ? Math.round(((ventasSemana - ventasSemanaAnt) / ventasSemanaAnt) * 100) : 0;

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
        catalogo: productos.slice(0, 20).map((p) => ({ nombre: p.name || p.nombre, precio: p.price || p.precio })),
      },
    };
  } catch (e) {
    console.error('fetchBusinessContext error:', e);
    return empty;
  }
}

// ── Auto insights ─────────────────────────────────────────
function generateInsights(ctx: { semana: { cambio: number }; productos: { topVentas: Array<{nombre:string;cantidad:number}> }; mesas: { ocupadas: number }; hoy: { pedidos: number }; mes: { ventasPorDia: Record<string,{total:number;count:number}> } }) {
  const insights: Array<{ tipo: string; mensaje: string }> = [];
  if (ctx.semana.cambio < -10) insights.push({ tipo: 'warning', mensaje: `Ventas bajaron ${Math.abs(ctx.semana.cambio)}% vs semana anterior` });
  else if (ctx.semana.cambio > 15) insights.push({ tipo: 'trend', mensaje: `Ventas crecieron ${ctx.semana.cambio}% vs semana anterior 🚀` });
  if (ctx.productos.topVentas.length > 0) insights.push({ tipo: 'trend', mensaje: `Tendencia: ${ctx.productos.topVentas[0].nombre} (${ctx.productos.topVentas[0].cantidad} pedidos este mes)` });
  if (ctx.mesas.ocupadas > 0) insights.push({ tipo: 'info', mensaje: `${ctx.mesas.ocupadas} mesa${ctx.mesas.ocupadas !== 1 ? 's' : ''} ocupada${ctx.mesas.ocupadas !== 1 ? 's' : ''} ahora` });
  if (ctx.hoy.pedidos === 0) insights.push({ tipo: 'warning', mensaje: 'No hay pedidos registrados hoy todavía' });
  const diasVentas = Object.entries(ctx.mes.ventasPorDia).sort(([, a], [, b]) => a.total - b.total);
  if (diasVentas.length > 0) insights.push({ tipo: 'info', mensaje: `Día con menos ventas del mes: ${diasVentas[0][0]}` });
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
  });

  const systemPrompt = `Eres el Gerente IA de un restaurante argentino. Analizás datos del negocio y das respuestas claras, directas y accionables en español rioplatense. Usá emojis para facilitar la lectura. Incluí números reales, comparaciones y recomendaciones concretas. Datos actuales: ${ctxStr}. Respondé de forma estructurada, máximo 300 palabras.`;

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
      // Log OpenAI error detail
      console.error('OpenAI response error:', JSON.stringify(data));
    } catch (e) { console.error('OpenAI fetch error:', e); }
  }

  // Rule-based fallback (always works)
  const q = question.toLowerCase();
  if (q.includes('ventas') || q.includes('resumen') || q.includes('hoy') || q.includes('día'))
    return `📊 **Resumen del día**\n\n💰 Ventas: $${ctx.hoy.ventas.toLocaleString('es-AR')}\n📦 Pedidos: ${ctx.hoy.pedidos}\n🎯 Ticket promedio: $${ctx.hoy.ticketPromedio.toLocaleString('es-AR')}\n⏰ Hora pico: ${ctx.hoy.horaPico}\n\n📈 Esta semana: ${ctx.semana.cambio > 0 ? '+' : ''}${ctx.semana.cambio}% vs semana anterior\n${ctx.productos.topVentas[0] ? `\n🔥 Más vendido: **${ctx.productos.topVentas[0].nombre}** (${ctx.productos.topVentas[0].cantidad} pedidos)` : ''}`;

  if (q.includes('producto') || q.includes('promoci') || q.includes('vend'))
    return `🏆 **Top productos (último mes)**\n\n${ctx.productos.topVentas.slice(0, 5).map((p, i) => `${i + 1}. ${p.nombre}: ${p.cantidad} pedidos`).join('\n') || 'Sin datos aún'}\n\n💡 Destacá tus productos más vendidos y creá combos para subir el ticket promedio.`;

  if (q.includes('mesa'))
    return `🪑 **Estado de mesas**\n\n✅ Ocupadas: ${ctx.mesas.ocupadas}\n⚪ Libres: ${ctx.mesas.libres}\n📊 Total: ${ctx.mesas.total}\n📈 Ocupación: ${ctx.mesas.total > 0 ? Math.round((ctx.mesas.ocupadas / ctx.mesas.total) * 100) : 0}%`;

  if (q.includes('hora') || q.includes('pico'))
    return `⏰ **Análisis horario**\n\n🕐 Hora pico hoy: ${ctx.hoy.horaPico}\n\n📅 **Ventas por día (último mes):**\n${Object.entries(ctx.mes.ventasPorDia).map(([d, v]) => `• ${d}: ${v.count} pedidos ($${v.total.toLocaleString('es-AR')})`).join('\n') || 'Sin datos aún'}\n\n💡 Identificá los días flojos y creá promos especiales para esos momentos.`;

  return `🤖 Hola! Soy el Gerente IA.\n\n📊 **Resumen rápido:**\n• Ventas hoy: $${ctx.hoy.ventas.toLocaleString('es-AR')}\n• Pedidos: ${ctx.hoy.pedidos}\n• Mesas ocupadas: ${ctx.mesas.ocupadas}/${ctx.mesas.total}\n\nPodés preguntarme sobre ventas, productos, mesas, horas pico o pedirme un resumen del día.`;
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
    // Return a graceful answer even on unexpected errors
    return NextResponse.json({
      answer: `⚠️ Hubo un error interno: ${err.message}. Intentá de nuevo en unos segundos.`,
      insights: [],
    });
  }
}

// ── GET (insights only) ───────────────────────────────────
export async function GET() {
  try {
    const ctx = await fetchBusinessContext();
    return NextResponse.json({ insights: generateInsights(ctx), summary: ctx.hoy });
  } catch (err: any) {
    return NextResponse.json({ insights: [], summary: null });
  }
}
