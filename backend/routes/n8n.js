const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// =========================================================
// 1. SYNC MESSAGES FROM n8n to DASHBOARD
// =========================================================
router.post('/message', async (req, res) => {
  try {
    const { phone, name, content, type = 'text', sender = 'customer', message_id } = req.body;
    const restaurantId = '00000000-0000-0000-0000-000000000001';

    if (!phone || !content) {
      return res.status(400).json({ error: 'phone and content are required' });
    }

    // Clean phone number (Evolution API sometimes includes @s.whatsapp.net)
    const cleanPhone = phone.replace('@s.whatsapp.net', '');

    // 1. Find or create customer
    let clienteResult = await pool.query('SELECT * FROM clientes WHERE phone = $1', [cleanPhone]);
    let cliente = clienteResult.rows[0];

    if (!cliente) {
      const insertResult = await pool.query(
        'INSERT INTO clientes (restaurant_id, phone, name) VALUES ($1, $2, $3) RETURNING *',
        [restaurantId, cleanPhone, name || '']
      );
      cliente = insertResult.rows[0];
    } else if (name && !cliente.name) {
      await pool.query('UPDATE clientes SET name = $1 WHERE id = $2', [name, cliente.id]);
    }

    // 2. Find or create conversation
    let convResult = await pool.query(
      'SELECT * FROM conversaciones WHERE cliente_id = $1 AND restaurant_id = $2 AND status = $3',
      [cliente.id, restaurantId, 'active']
    );
    let conversation = convResult.rows[0];

    if (!conversation) {
      const insertConv = await pool.query(
        'INSERT INTO conversaciones (restaurant_id, cliente_id) VALUES ($1, $2) RETURNING *',
        [restaurantId, cliente.id]
      );
      conversation = insertConv.rows[0];
    }

    // 3. Save message
    const msgResult = await pool.query(
      'INSERT INTO mensajes (conversacion_id, content, type, sender, wa_message_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [conversation.id, content, type, sender, message_id]
    );

    // 4. Update conversation timestamp
    await pool.query('UPDATE conversaciones SET last_message_at = NOW() WHERE id = $1', [conversation.id]);

    // 5. Emit to Socket.io (Dashboard Realtime)
    const io = req.app.get('io');
    if (io) {
      io.emit('new-message', {
        conversacion_id: conversation.id,
        content: content,
        sender: sender,
        message: msgResult.rows[0]
      });
    }

    res.status(200).json({ success: true, message: 'Message synced to dashboard' });
  } catch (err) {
    console.error('n8n /message error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// 2. CREATE KITCHEN ORDER FROM n8n
// =========================================================
router.post('/order', async (req, res) => {
  const client = await pool.connect();
  try {
    const { phone, customer_name, address, ordered_items_text } = req.body;
    const restaurantId = '00000000-0000-0000-0000-000000000001';

    if (!phone || !ordered_items_text) {
      return res.status(400).json({ error: 'phone and ordered_items_text are required' });
    }

    const cleanPhone = phone.replace('@s.whatsapp.net', '');

    await client.query('BEGIN');

    // 1. Get customer
    let clienteResult = await client.query('SELECT * FROM clientes WHERE phone = $1', [cleanPhone]);
    let cliente = clienteResult.rows[0];

    if (!cliente) {
      const insertResult = await client.query(
        'INSERT INTO clientes (restaurant_id, phone, name, address) VALUES ($1, $2, $3, $4) RETURNING *',
        [restaurantId, cleanPhone, customer_name || '', address || '']
      );
      cliente = insertResult.rows[0];
    } else {
      // Update address if new
      await client.query('UPDATE clientes SET address = $1 WHERE id = $2', [address || cliente.address, cliente.id]);
    }

    // 2. Get active conversation (for linking)
    let convResult = await client.query(
      'SELECT id FROM conversaciones WHERE cliente_id = $1 AND status = $2',
      [cliente.id, 'active']
    );
    let conversationId = convResult.rows[0]?.id || null;

    // 3. Create Order
    const orderResult = await client.query(`
      INSERT INTO pedidos (restaurant_id, cliente_id, conversacion_id, address, notes, status)
      VALUES ($1,$2,$3,$4,$5,'new') RETURNING *
    `, [restaurantId, cliente.id, conversationId, address || cliente.address, ordered_items_text]);

    const order = orderResult.rows[0];

    await client.query('COMMIT');

    // 4. Emit to Kitchen Board
    const io = req.app.get('io');
    if (io) {
      io.emit('new-order', {
        ...order,
        customer_name: cliente.name || customer_name,
        customer_phone: cliente.phone,
        items: [{ id: 1, name: ordered_items_text, price: 0, quantity: 1, notes: 'Ingresado por la IA' }]
      });
    }

    res.status(200).json({ success: true, order_id: order.id, message: 'Order sent to kitchen' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('n8n /order error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
