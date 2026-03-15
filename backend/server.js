require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const conversationsRouter = require('./routes/conversations');
const ordersRouter = require('./routes/orders');
const productsRouter = require('./routes/products');
const analyticsRouter = require('./routes/analytics');
const campaignsRouter = require('./routes/campaigns');
const webhookRouter = require('./routes/webhook');
const aiConfigRouter = require('./routes/ai-config');
const n8nRouter = require('./routes/n8n');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to routes
app.set('io', io);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Routes
app.use('/api/conversations', conversationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/ai-config', aiConfigRouter);
app.use('/api/n8n', n8nRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Socket.io events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-restaurant', (restaurantId) => {
    socket.join(`restaurant-${restaurantId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

module.exports = { app, io };
