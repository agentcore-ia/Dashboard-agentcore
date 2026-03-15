const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET AI config
router.get('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    const result = await pool.query('SELECT * FROM ai_config WHERE restaurant_id = $1', [restaurant_id]);
    if (result.rows.length === 0) {
      return res.json({ mode: 'active', system_prompt: '', temperature: 0.7, max_tokens: 1000 });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update AI config
router.put('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', mode, system_prompt, temperature, max_tokens } = req.body;
    const result = await pool.query(`
      INSERT INTO ai_config (restaurant_id, mode, system_prompt, temperature, max_tokens)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (restaurant_id) DO UPDATE SET mode=$2, system_prompt=$3, temperature=$4, max_tokens=$5, updated_at=NOW()
      RETURNING *
    `, [restaurant_id, mode, system_prompt, temperature, max_tokens]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET corrections (learning log)
router.get('/corrections', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    const result = await pool.query('SELECT * FROM ai_corrections WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 50', [restaurant_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST log a correction
router.post('/corrections', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', original_response, corrected_response, context } = req.body;
    const result = await pool.query(
      'INSERT INTO ai_corrections (restaurant_id, original_response, corrected_response, context) VALUES ($1,$2,$3,$4) RETURNING *',
      [restaurant_id, original_response, corrected_response, context]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
