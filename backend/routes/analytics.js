const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET analytics
router.get('/', async (req, res) => {
  try {
    const { restaurant_id = '00000000-0000-0000-0000-000000000001', period = '30' } = req.query;
    const days = parseInt(period);
    const since = `NOW() - interval '${days} days'`;

    const [revenue, orders, conversations, avgTicket, topProducts, funnel] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM pedidos WHERE restaurant_id = $1 AND status = 'delivered' AND created_at > ${since}`, [restaurant_id]),
      pool.query(`SELECT COUNT(*) AS count FROM pedidos WHERE restaurant_id = $1 AND status NOT IN ('cancelled') AND created_at > ${since}`, [restaurant_id]),
      pool.query(`SELECT COUNT(*) AS count FROM conversaciones WHERE restaurant_id = $1 AND created_at > ${since}`, [restaurant_id]),
      pool.query(`SELECT COALESCE(AVG(total), 0) AS avg FROM pedidos WHERE restaurant_id = $1 AND status = 'delivered' AND created_at > ${since}`, [restaurant_id]),
      pool.query(`
        SELECT ip.name, SUM(ip.quantity) AS qty, SUM(ip.price * ip.quantity) AS total
        FROM items_pedido ip
        JOIN pedidos p ON p.id = ip.pedido_id
        WHERE p.restaurant_id = $1 AND p.created_at > ${since}
        GROUP BY ip.name ORDER BY qty DESC LIMIT 5
      `, [restaurant_id]),
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM conversaciones WHERE restaurant_id = $1 AND created_at > ${since}) AS iniciadas,
          (SELECT COUNT(DISTINCT conversacion_id) FROM mensajes WHERE sender = 'ai' AND created_at > ${since}) AS apresentadas,
          (SELECT COUNT(*) FROM pedidos WHERE restaurant_id = $1 AND created_at > ${since}) AS cotacoes,
          (SELECT COUNT(*) FROM pedidos WHERE restaurant_id = $1 AND status = 'delivered' AND created_at > ${since}) AS fechadas
      `, [restaurant_id])
    ]);

    res.json({
      revenue: parseFloat(revenue.rows[0].revenue),
      orders_closed: parseInt(orders.rows[0].count),
      total_conversations: parseInt(conversations.rows[0].count),
      avg_ticket: parseFloat(avgTicket.rows[0].avg),
      conversion_rate: conversations.rows[0].count > 0
        ? (parseInt(orders.rows[0].count) / parseInt(conversations.rows[0].count) * 100).toFixed(2)
        : '0.00',
      top_products: topProducts.rows,
      funnel: funnel.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
