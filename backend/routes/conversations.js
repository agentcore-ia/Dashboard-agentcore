const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET all conversations (with last message and customer info)
router.get('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    const result = await pool.query(`
      SELECT 
        c.id, c.status, c.ai_active, c.last_message_at, c.created_at,
        cl.name AS customer_name, cl.phone AS customer_phone,
        (SELECT content FROM mensajes WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM mensajes WHERE conversacion_id = c.id AND read = false AND sender = 'customer') AS unread_count
      FROM conversaciones c
      JOIN clientes cl ON cl.id = c.cliente_id
      WHERE c.restaurant_id = $1
      ORDER BY c.last_message_at DESC
    `, [restaurant_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET single conversation with messages
router.get('/:id', async (req, res) => {
  try {
    const convResult = await pool.query(`
      SELECT c.*, cl.name AS customer_name, cl.phone AS customer_phone, cl.address AS customer_address,
      (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = cl.id) AS customer_compras,
      (SELECT COALESCE(SUM(p.total), 0) FROM pedidos p WHERE p.cliente_id = cl.id) AS customer_gastado
      FROM conversaciones c JOIN clientes cl ON cl.id = c.cliente_id
      WHERE c.id = $1
    `, [req.params.id]);

    if (convResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const msgsResult = await pool.query(`
      SELECT * FROM mensajes WHERE conversacion_id = $1 ORDER BY created_at ASC
    `, [req.params.id]);

    // Mark messages as read
    await pool.query(`UPDATE mensajes SET read = true WHERE conversacion_id = $1 AND sender = 'customer'`, [req.params.id]);

    res.json({ ...convResult.rows[0], messages: msgsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST send message (human agent)
router.post('/:id/messages', async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;
    const io = req.app.get('io');

    // Insert message
    const msgResult = await pool.query(`
      INSERT INTO mensajes (conversacion_id, content, type, sender) VALUES ($1, $2, $3, 'human')
      RETURNING *
    `, [req.params.id, content, type]);

    // Update conversation timestamp and disable AI (human took over)
    await pool.query(`
      UPDATE conversaciones SET last_message_at = NOW(), ai_active = false WHERE id = $1
    `, [req.params.id]);

    const msg = msgResult.rows[0];

    // Send via WhatsApp
    try {
      const whatsapp = require('../services/whatsapp');
      const convResult = await pool.query('SELECT cl.phone FROM conversaciones c JOIN clientes cl ON cl.id = c.cliente_id WHERE c.id = $1', [req.params.id]);
      if (convResult.rows.length > 0) {
        await whatsapp.sendText(convResult.rows[0].phone, content);
      }
    } catch (waErr) {
      console.warn('WhatsApp send failed (check credentials):', waErr.message);
    }

    io.emit('new-message', { conversacion_id: req.params.id, message: msg });
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle AI active
router.patch('/:id/ai', async (req, res) => {
  try {
    const { ai_active } = req.body;
    const io = req.app.get('io');

    await pool.query('UPDATE conversaciones SET ai_active = $1 WHERE id = $2', [ai_active, req.params.id]);
    io.emit('conversation-updated', { id: req.params.id, ai_active });
    res.json({ success: true, ai_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
