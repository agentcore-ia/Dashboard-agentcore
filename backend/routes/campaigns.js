const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const whatsapp = require('../services/whatsapp');
const OpenAI = require('openai');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GET campaigns
router.get('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    const result = await pool.query('SELECT * FROM campanhas WHERE restaurant_id = $1 ORDER BY created_at DESC', [restaurant_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create campaign
router.post('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', name, message, image_url } = req.body;
    const result = await pool.query(
      'INSERT INTO campanhas (restaurant_id, name, message, image_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [restaurant_id, name, message, image_url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI message variations
router.post('/generate-variations', async (req, res) => {
  try {
    const { message, count = 3 } = req.body;
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Crie ${count} variações da seguinte mensagem de marketing para WhatsApp. Mantenha o mesmo sentido mas mude as palavras, tom e emojis para evitar bloqueios. Retorne como JSON array de strings.

Mensagem original: "${message}"`
      }],
      response_format: { type: 'json_object' }
    });
    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json({ variations: parsed.variations || parsed.messages || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, variations: [req.body.message] });
  }
});

// POST send campaign to contacts
router.post('/:id/send', async (req, res) => {
  try {
    const { contacts, use_ai_variations = true } = req.body;
    const campaign = await pool.query('SELECT * FROM campanhas WHERE id = $1', [req.params.id]);
    if (campaign.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const msg = campaign.rows[0].message;
    let variations = [msg];

    if (use_ai_variations && process.env.OPENAI_API_KEY) {
      try {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          messages: [{ role: 'user', content: `Crie 5 variações de: "${msg}". JSON: {"variations": ["..."]}` }],
          response_format: { type: 'json_object' }
        });
        const parsed = JSON.parse(completion.choices[0].message.content);
        variations = parsed.variations || [msg];
      } catch (_) { variations = [msg]; }
    }

    // Update campaign status
    await pool.query('UPDATE campanhas SET status = $1, total_contacts = $2 WHERE id = $3', ['sending', contacts.length, req.params.id]);

    res.json({ success: true, total: contacts.length, message: 'Campaign started' });

    // Send in background with random delays
    (async () => {
      let sent = 0;
      for (const phone of contacts) {
        const variation = variations[Math.floor(Math.random() * variations.length)];
        const delay = Math.floor(Math.random() * (5 * 60 * 1000 - 30 * 1000) + 30 * 1000); // 30s to 5min

        await new Promise(resolve => setTimeout(resolve, delay));
        try {
          await whatsapp.sendText(phone, variation);
          sent++;
          await pool.query('UPDATE campanhas SET sent_count = $1 WHERE id = $2', [sent, req.params.id]);
        } catch (e) {
          console.warn('Failed to send to', phone, e.message);
        }
      }
      await pool.query('UPDATE campanhas SET status = $1, sent_at = NOW() WHERE id = $2', ['sent', req.params.id]);
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
