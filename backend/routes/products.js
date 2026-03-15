const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET products
router.get('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    const result = await pool.query(
      'SELECT * FROM products WHERE restaurant_id = $1 ORDER BY category, name',
      [restaurant_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', name, description, price, category, image_url } = req.body;
    const result = await pool.query(
      'INSERT INTO products (restaurant_id, name, description, price, category, image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [restaurant_id, name, description, price, category, image_url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const { name, description, price, category, available } = req.body;
    const result = await pool.query(
      'UPDATE products SET name=$1, description=$2, price=$3, category=$4, available=$5 WHERE id=$6 RETURNING *',
      [name, description, price, category, available, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
