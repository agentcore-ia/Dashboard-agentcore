const OpenAI = require('openai');
const { Pool } = require('pg');
const whatsapp = require('./whatsapp');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory context per conversation (in production: use Redis)
const conversationContexts = {};

const DEFAULT_SYSTEM_PROMPT = `Você é o Beastie, o assistente virtual da Beast Burgers 🍔

Sua função é atender clientes pelo WhatsApp de forma simpática e eficiente.

## MENU BEAST BURGERS
**Hambúrgueres:**
- Beast Classic (blend 180g, cheddar, alface, tomate, cebola caramelizada) — R$ 32,90
- Beast Double (blend duplo 360g, cheddar duplo, bacon) — R$ 44,90
- Beast Crispy (frango empanado, queijo prato, alface, tomate) — R$ 29,90

**Acompanhamentos:**
- Batata c/ Cheddar e Bacon - média — R$ 22,90
- Batata c/ Cheddar e Bacon - grande — R$ 29,90
- Onion Rings — R$ 18,90

**Bebidas:**
- Refri 600ml (Coca-Cola, Guaraná, Fanta) — R$ 9,00
- Suco Natural 500ml — R$ 12,90
- Água Mineral 500ml — R$ 5,00

## FLUXO DE ATENDIMENTO
1. Saudar o cliente pelo nome (se souber)
2. Apresentar o menu ou responder a pergunta
3. Quando pedir algo: confirmar e fazer UPSELL (adicionar bebida, batata, combo)
4. Coletar: endereço OU "retirada no local"
5. Perguntar forma de pagamento: Cartão, Dinheiro ou Pix
6. Mostrar RESUMO completo do pedido com total
7. Perguntar "Confirmar pedido? ✅"
8. Quando confirmar: responder que o pedido foi recebido e dar previsão (30-45 min)

## REGRAS
- Use emojis com moderação (máximo 2 por mensagem)
- Seja direto e simpático
- Sempre ofereça bebida quando pedirem só hambúrguer
- Sempre ofereça hambúrguer quando pedirem só acompanhamento
- Quando o pedido for confirmado, retorne JSON no formato especial ao final:
  [PEDIDO_CONFIRMADO:{"items":[{"name":"...","price":0,"quantity":1}],"delivery_type":"delivery|pickup","payment_method":"card|cash|pix","address":"...","subtotal":0,"delivery_fee":5,"total":0}]

## IDIOMA
Responda sempre em português brasileiro.`;

async function getSystemPrompt(restaurantId) {
  try {
    const result = await pool.query('SELECT system_prompt FROM ai_config WHERE restaurant_id = $1', [restaurantId]);
    if (result.rows.length > 0 && result.rows[0].system_prompt) {
      return result.rows[0].system_prompt;
    }
  } catch (_) {}
  return DEFAULT_SYSTEM_PROMPT;
}

async function getAIMode(restaurantId) {
  try {
    const result = await pool.query('SELECT mode FROM ai_config WHERE restaurant_id = $1', [restaurantId]);
    if (result.rows.length > 0) return result.rows[0].mode;
  } catch (_) {}
  return 'active';
}

async function handleMessage(conversationId, cliente, messageContent, restaurantId) {
  try {
    const aiMode = await getAIMode(restaurantId);
    if (aiMode === 'disabled') return;

    // Build conversation history
    const historyResult = await pool.query(`
      SELECT content, sender FROM mensajes 
      WHERE conversacion_id = $1 
      ORDER BY created_at DESC LIMIT 20
    `, [conversationId]);

    const messages = historyResult.rows.reverse().map(msg => ({
      role: msg.sender === 'customer' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const systemPrompt = await getSystemPrompt(restaurantId);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;

    // Check for order confirmation signal
    const orderMatch = aiResponse.match(/\[PEDIDO_CONFIRMADO:(.*?)\]/s);
    const cleanResponse = aiResponse.replace(/\[PEDIDO_CONFIRMADO:.*?\]/s, '').trim();

    if (aiMode === 'review') {
      // Save as pending approval
      await pool.query(`
        INSERT INTO mensajes (conversacion_id, content, type, sender, pending_approval) VALUES ($1,$2,'text','ai',true)
      `, [conversationId, cleanResponse]);
      return;
    }

    // Save AI message
    await pool.query(`
      INSERT INTO mensajes (conversacion_id, content, type, sender) VALUES ($1,$2,'text','ai')
    `, [conversationId, cleanResponse]);

    await pool.query('UPDATE conversaciones SET last_message_at = NOW() WHERE id = $1', [conversationId]);

    // Send via WhatsApp
    if (cliente.phone) {
      await whatsapp.sendText(cliente.phone, cleanResponse);
    }

    // Process order if confirmed
    if (orderMatch) {
      try {
        const orderData = JSON.parse(orderMatch[1]);
        await createOrderFromAI(restaurantId, cliente, conversationId, orderData);
      } catch (parseErr) {
        console.error('Order parse error:', parseErr.message);
      }
    }

  } catch (err) {
    console.error('AI service error:', err.message);
  }
}

async function createOrderFromAI(restaurantId, cliente, conversationId, orderData) {
  const { Pool } = require('pg');
  const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool2.connect();
  
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(`
      INSERT INTO pedidos (restaurant_id, cliente_id, conversacion_id, delivery_type, payment_method, address, subtotal, delivery_fee, total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [restaurantId, cliente.id, conversationId, orderData.delivery_type, orderData.payment_method,
        orderData.address, orderData.subtotal, orderData.delivery_fee || 5.00, orderData.total]);

    const order = orderResult.rows[0];

    for (const item of (orderData.items || [])) {
      // Try to find product
      const productResult = await client.query('SELECT id FROM products WHERE restaurant_id = $1 AND LOWER(name) LIKE $2 LIMIT 1', [restaurantId, `%${item.name.toLowerCase().substring(0, 10)}%`]);
      const productId = productResult.rows[0]?.id || null;

      await client.query(`
        INSERT INTO items_pedido (pedido_id, product_id, name, price, quantity) VALUES ($1,$2,$3,$4,$5)
      `, [order.id, productId, item.name, item.price, item.quantity]);
    }

    await client.query('COMMIT');
    console.log('✅ Order created from AI:', order.id);
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    pool2.end();
  }
}

module.exports = { handleMessage, createOrderFromAI };
