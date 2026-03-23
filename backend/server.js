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
const menuRouter = require('./routes/menu');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/conversations', conversationsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/ai-config', aiConfigRouter);
app.use('/api/n8n', n8nRouter);
app.use('/api/menu', menuRouter);

// Health check para Easypanel
app.get('/', (req, res) => res.send('🚀 Backend Agentcore OK'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-restaurant', (id) => socket.join(`restaurant-${id}`));
});

// FORZAMOS EL PUERTO 3001 PARA LOCAL, PERO RESPETAMOS EL PORT INYECTADO POR EASYPANEL (3000)
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SERVIDOR ESCUCHANDO EN PUERTO ${PORT}`);
});
