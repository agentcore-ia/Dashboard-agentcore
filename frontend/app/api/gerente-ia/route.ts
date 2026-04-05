import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const openaiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Fetch all business context from Supabase ──────────────
async function fetchBusinessContext() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [pedidosHoy, pedidosMes, mesas, productos] = await Promise.allSettled([
    supabase
      .from('pedidos')
      .select('*')
      .gte('created_at', today)
      .order('created_at', { ascending: false }),
    supabase
      .from('pedidos')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    supabase.from('mesas').select('*'),
    supabase.from('productos').select('*'),
  ]);

  const pedidosHoyData = pedidosHoy.status === 'fulfilled' ? pedidosHoy.value.data || [] : [];
  const pedidosMesData = pedidosMes.status === 'fulfilled' ? pedidosMes.value.data || [] : [];
  const mesasData = mesas.status === 'fulfilled' ? mesas.value.data || [] : [];
  const productosData = productos.status === 'fulfilled' ? productos.value.data || [] : [];

  // ── Analytics calculations ──────────────────────────────
  const ventasHoy = pedidosHoyData.reduce((s: number, p: any) => s + (p.total || p.monto || 0), 0);
  const pedidosHoyCount = pedidosHoyData.length;
  const ticketPromedio = pedidosHoyCount > 0 ? Math.round(ventasHoy / pedidosHoyCount) : 0;

  // Sales by day of week (last 30 days)
  const ventasPorDia: Record<string, { total: number; count: number }> = {};
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  pedidosMesData.forEach((p: any) => {
    const d = dias[new Date(p.created_at).getDay()];
    if (!ventasPorDia[d]) ventasPorDia[d] = { total: 0, count: 0 };
    ventasPorDia[d].total += p.total || p.monto || 0;
    ventasPorDia[d].count += 1;
  });

  // Top products (from items in pedidos)
  const productCount: Record<string, number> = {};
  pedidosMesData.forEach((p: any) => {
    const items = p.items || p.productos || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const n = item.name || item.nombre || item.producto || 'Desconocido';
        productCount[n] = (productCount[n] || 0) + (item.quantity || item.cantidad || 1);
      });
    }
  });
  const topProductos = Object.entries(productCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([nombre, cant]) => ({ nombre, cantidad: cant }));

  // Sales per hour (today)
  const ventasPorHora: Record<number, number> = {};
  pedidosHoyData.forEach((p: any) => {
    const hora = new Date(p.created_at).getHours();
    ventasPorHora[hora] = (ventasPorHora[hora] || 0) + 1;
  });
  const horaPico = Object.entries(ventasPorHora).sort(([, a], [, b]) => b - a)[0];

  // Mesas status
  const mesasOcupadas = mesasData.filter((m: any) => m.status === 'occupied').length;
  const mesasLibres = mesasData.filter((m: any) => m.status === 'free').length;

  // Last 7 days comparison
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const ventasSemana = pedidosMesData
    .filter((p: any) => p.created_at >= sevenDaysAgo)
    .reduce((s: number, p: any) => s + (p.total || p.monto || 0), 0);
  const ventasSemanaAnterior = pedidosMesData
    .filter((p: any) => p.created_at >= fourteenDaysAgo && p.created_at < sevenDaysAgo)
    .reduce((s: number, p: any) => s + (p.total || p.monto || 0), 0);
  const cambioPorcentual =
    ventasSemanaAnterior > 0
      ? Math.round(((ventasSemana - ventasSemanaAnterior) / ventasSemanaAnterior) * 100)
      : 0;

  return {
    hoy: {
      ventas: ventasHoy,
      pedidos: pedidosHoyCount,
      ticketPromedio,
      horaPico: horaPico ? `${horaPico[0]}:00hs (${horaPico[1]} pedidos)` : 'Sin datos',
    },
    semana: {
      ventas: ventasSemana,
      cambio: cambioPorcentual,
    },
    mes: {
      pedidos: pedidosMesData.length,
      ventasPorDia,
    },
    mesas: {
      ocupadas: mesasOcupadas,
      libres: mesasLibres,
      total: mesasData.length,
    },
    productos: {
      total: productosData.length,
      topVentas: topProductos,
      catalogo: productosData
        .slice(0, 30)
        .map((p: any) => ({ nombre: p.name || p.nombre, precio: p.price || p.precio, categoria: p.category || p.categoria })),
    },
  };
}

// ── Auto-insights generator ───────────────────────────────
async function generateInsights(ctx: any) {
  const insights: Array<{ tipo: 'warning' | 'trend' | 'stock' | 'info'; mensaje: string }> = [];

  if (ctx.semana.cambio < -10) {
    insights.push({ tipo: 'warning', mensaje: `Ventas bajaron ${Math.abs(ctx.semana.cambio)}% vs la semana anterior` });
  } else if (ctx.semana.cambio > 15) {
    insights.push({ tipo: 'trend', mensaje: `Ventas crecieron ${ctx.semana.cambio}% vs la semana anterior 🚀` });
  }

  if (ctx.productos.topVentas.length > 0) {
    insights.push({ tipo: 'trend', mensaje: `Producto tendencia: ${ctx.productos.topVentas[0].nombre} (${ctx.productos.topVentas[0].cantidad} pedidos este mes)` });
  }

  if (ctx.mesas.ocupadas > 0) {
    insights.push({ tipo: 'info', mensaje: `${ctx.mesas.ocupadas} mesa${ctx.mesas.ocupadas !== 1 ? 's' : ''} ocupada${ctx.mesas.ocupadas !== 1 ? 's' : ''} ahora mismo` });
  }

  if (ctx.hoy.pedidos === 0) {
    insights.push({ tipo: 'warning', mensaje: 'No hay pedidos registrados hoy todavía' });
  }

  // Find slowest day
  const diasVentas = Object.entries(ctx.mes.ventasPorDia as Record<string, { total: number; count: number }>)
    .sort(([, a], [, b]) => a.total - b.total);
  if (diasVentas.length > 0) {
    insights.push({ tipo: 'info', mensaje: `Día con menos ventas del mes: ${diasVentas[0][0]}` });
  }

  return insights;
}

// ── Call AI (OpenAI or Gemini) ────────────────────────────
async function callAI(question: string, context: any): Promise<string> {
  const systemPrompt = `Eres el Gerente IA de un restaurante. Analizas datos del negocio y das respuestas claras, concisas y accionables en español. 
  
  Usa emojis para facilitar la lectura. Cuando corresponda, incluye:
  - Números específicos del negocio
  - Comparaciones con períodos anteriores
  - Recomendaciones concretas y accionables
  - Identifica oportunidades y riesgos
  
  Contexto actual del restaurante:
  ${JSON.stringify(context, null, 2)}
  
  Responde de forma estructurada, con secciones claras usando emojis. Sé directo y no uses más de 300 palabras a menos que sea necesario.`;

  // Try Gemini first
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\nPregunta del dueño: ${question}` }
                ]
              }
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          }),
        }
      );
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) {
      console.error('Gemini error:', e);
    }
  }

  // Fallback to OpenAI
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
    } catch (e) {
      console.error('OpenAI error:', e);
    }
  }

  // Fallback: rule-based response
  return generateRuleBasedResponse(question, context);
}

// ── Rule-based fallback when no AI key configured ─────────
function generateRuleBasedResponse(question: string, ctx: any): string {
  const q = question.toLowerCase();

  if (q.includes('ventas') || q.includes('resumen') || q.includes('hoy') || q.includes('día')) {
    return `📊 **Resumen del día**

💰 Ventas: $${ctx.hoy.ventas.toLocaleString('es-AR')}
📦 Pedidos: ${ctx.hoy.pedidos}
🎯 Ticket promedio: $${ctx.hoy.ticketPromedio.toLocaleString('es-AR')}
⏰ Hora pico: ${ctx.hoy.horaPico}

📈 Esta semana: $${ctx.semana.ventas.toLocaleString('es-AR')} (${ctx.semana.cambio > 0 ? '+' : ''}${ctx.semana.cambio}% vs semana anterior)

${ctx.productos.topVentas.length > 0 ? `🔥 Producto más vendido del mes: **${ctx.productos.topVentas[0]?.nombre}** (${ctx.productos.topVentas[0]?.cantidad} pedidos)` : ''}`;
  }

  if (q.includes('producto') || q.includes('promoci') || q.includes('vender')) {
    const tops = ctx.productos.topVentas.slice(0, 3).map((p: any, i: number) => `${i + 1}. ${p.nombre} (${p.cantidad} pedidos)`).join('\n');
    return `🏆 **Productos más vendidos del mes**\n\n${tops}\n\n💡 **Recomendación:** Destacá estos productos en el menú y creá combos con los más populares para aumentar el ticket promedio.`;
  }

  if (q.includes('hora') || q.includes('pico') || q.includes('tráfico')) {
    const horasMes = Object.entries(ctx.mes.ventasPorDia as Record<string, { total: number; count: number }>)
      .map(([dia, data]) => `${dia}: ${data.count} pedidos ($${data.total.toLocaleString('es-AR')})`)
      .join('\n');
    return `⏰ **Análisis de horarios y días**\n\nHora pico hoy: ${ctx.hoy.horaPico}\n\n📅 Ventas por día (último mes):\n${horasMes}\n\n💡 Los días con menos ventas son oportunidades para crear promociones especiales.`;
  }

  if (q.includes('mesa')) {
    return `🪑 **Estado de Mesas**\n\n✅ Ocupadas: ${ctx.mesas.ocupadas}\n⚪ Libres: ${ctx.mesas.libres}\n📊 Total: ${ctx.mesas.total}\n\nOcupación actual: ${Math.round((ctx.mesas.ocupadas / ctx.mesas.total) * 100)}%`;
  }

  return `🤖 **Gerente IA**\n\nEsta es una respuesta generada localmente. Para análisis avanzados con IA, configurá GEMINI_API_KEY o OPENAI_API_KEY en las variables de entorno.\n\n📊 **Resumen rápido:**\n• Ventas hoy: $${ctx.hoy.ventas.toLocaleString('es-AR')}\n• Pedidos hoy: ${ctx.hoy.pedidos}\n• Mesas ocupadas: ${ctx.mesas.ocupadas}/${ctx.mesas.total}`;
}

// ── Main POST handler ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: 'La pregunta no puede estar vacía' }, { status: 400 });
    }

    const [context, insights] = await Promise.all([
      fetchBusinessContext(),
      fetchBusinessContext().then(generateInsights),
    ]);

    const answer = await callAI(question, context);

    return NextResponse.json({ answer, insights, context: { hoy: context.hoy, semana: context.semana } });
  } catch (err: any) {
    console.error('Gerente IA error:', err);
    return NextResponse.json({ error: 'Error al procesar la consulta', details: err.message }, { status: 500 });
  }
}

// ── GET: fetch only insights (for auto-refresh) ───────────
export async function GET() {
  try {
    const context = await fetchBusinessContext();
    const insights = await generateInsights(context);
    return NextResponse.json({ insights, summary: context.hoy });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
