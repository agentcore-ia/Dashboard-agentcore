const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const notifications = require('../services/notifications');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET orders grouped by status (Kanban)
router.get('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', status } = req.query;
    
    let query = `
      SELECT 
        p.*, cl.name AS customer_name, cl.phone AS customer_phone,
        json_agg(json_build_object(
          'id', ip.id, 'name', ip.name, 'price', ip.price,
          'quantity', ip.quantity, 'notes', ip.notes
        ) ORDER BY ip.name) AS items
      FROM pedidos p
      JOIN clientes cl ON cl.id = p.cliente_id
      LEFT JOIN items_pedido ip ON ip.pedido_id = p.id
      WHERE p.restaurant_id = $1
    `;
    const params = [restaurant_id];

    if (status) {
      query += ` AND p.status = $2`;
      params.push(status);
    }

    query += ' GROUP BY p.id, cl.name, cl.phone ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, cl.name AS customer_name, cl.phone AS customer_phone,
        json_agg(json_build_object('name', ip.name, 'price', ip.price, 'quantity', ip.quantity, 'notes', ip.notes)) AS items
      FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id
      LEFT JOIN items_pedido ip ON ip.pedido_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, cl.name, cl.phone
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create order
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', cliente_id, conversacion_id, delivery_type, payment_method, address, subtotal, delivery_fee, total, items, notes } = req.body;
    const io = req.app.get('io');

    await client.query('BEGIN');

    const orderResult = await client.query(`
      INSERT INTO pedidos (restaurant_id, cliente_id, conversacion_id, delivery_type, payment_method, address, subtotal, delivery_fee, total, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [restaurant_id, cliente_id, conversacion_id, delivery_type, payment_method, address, subtotal, delivery_fee, total, notes]);

    const order = orderResult.rows[0];

    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(`
          INSERT INTO items_pedido (pedido_id, product_id, name, price, quantity, notes) VALUES ($1,$2,$3,$4,$5,$6)
        `, [order.id, item.product_id, item.name, item.price, item.quantity, item.notes]);
      }
    }

    await client.query('COMMIT');

    io.emit('new-order', order);
    res.json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const io = req.app.get('io');

    const result = await pool.query(`
      UPDATE pedidos SET status = $1, updated_at = NOW() WHERE id = $2
      RETURNING *, (SELECT name FROM clientes WHERE id = pedidos.cliente_id) AS customer_name,
                   (SELECT phone FROM clientes WHERE id = pedidos.cliente_id) AS customer_phone
    `, [status, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const order = result.rows[0];

    // Send WhatsApp notification
    try {
      await notifications.sendStatusUpdate(order.customer_phone, status, order.order_number);
    } catch (notifErr) {
      console.warn('Notification failed:', notifErr.message);
    }

    io.emit('order-updated', { id: order.id, status: order.status, order });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
