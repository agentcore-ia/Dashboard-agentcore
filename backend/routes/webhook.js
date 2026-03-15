const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const aiService = require('../services/ai');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Webhook verification (GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Receive messages (POST)
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) {
      return res.sendStatus(200);
    }

    const msg = value.messages[0];
    const from = msg.from; // phone number
    const messageContent = msg.type === 'text' ? msg.text?.body : `[${msg.type}]`;
    const restaurantId = '00000000-0000-0000-0000-000000000001';

    // Find or create customer
    let clienteResult = await pool.query('SELECT * FROM clientes WHERE phone = $1', [from]);
    let cliente = clienteResult.rows[0];

    if (!cliente) {
      const insertResult = await pool.query(
        'INSERT INTO clientes (restaurant_id, phone) VALUES ($1, $2) RETURNING *',
        [restaurantId, from]
      );
      cliente = insertResult.rows[0];
    }

    // Find or create conversation
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

    // Save incoming message
    await pool.query(
      'INSERT INTO mensajes (conversacion_id, content, type, sender, wa_message_id) VALUES ($1,$2,$3,$4,$5)',
      [conversation.id, messageContent, msg.type, 'customer', msg.id]
    );

    // Update last_message_at
    await pool.query('UPDATE conversaciones SET last_message_at = NOW() WHERE id = $1', [conversation.id]);

    // Emit to dashboard
    const io = req.app.get('io');
    io.emit('new-message', { conversacion_id: conversation.id, content: messageContent, sender: 'customer' });

    // If AI is active, get AI response
    if (conversation.ai_active) {
      // Process asynchronously
      aiService.handleMessage(conversation.id, cliente, messageContent, restaurantId).catch(console.error);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200); // Always return 200 to WhatsApp
  }
});

module.exports = router;
