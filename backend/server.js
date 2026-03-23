require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// ── Startup Diagnostics ──────────────────────────────────
console.log('─── BACKEND STARTUP ───');
console.log('NODE_ENV:', process.env.NODE_ENV || '(not set)');
console.log('PORT env:', process.env.PORT || '(not set)');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ set' : '❌ MISSING');
console.log('GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? '✅ set' : '❌ MISSING');
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✅ set' : '❌ MISSING');
console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? `✅ set (${process.env.GOOGLE_PRIVATE_KEY.length} chars)` : '❌ MISSING');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ set' : '❌ MISSING');
console.log('───────────────────────');

// ── Route Imports (wrapped in try/catch for diagnostics) ─
let conversationsRouter, ordersRouter, productsRouter, analyticsRouter;
let campaignsRouter, webhookRouter, aiConfigRouter, n8nRouter, menuRouter;

try {
  conversationsRouter = require('./routes/conversations');
  console.log('✅ Loaded: conversations');
} catch (e) { console.error('❌ Failed to load conversations:', e.message); }

try {
  ordersRouter = require('./routes/orders');
  console.log('✅ Loaded: orders');
} catch (e) { console.error('❌ Failed to load orders:', e.message); }

try {
  productsRouter = require('./routes/products');
  console.log('✅ Loaded: products');
} catch (e) { console.error('❌ Failed to load products:', e.message); }

try {
  analyticsRouter = require('./routes/analytics');
  console.log('✅ Loaded: analytics');
} catch (e) { console.error('❌ Failed to load analytics:', e.message); }

try {
  campaignsRouter = require('./routes/campaigns');
  console.log('✅ Loaded: campaigns');
} catch (e) { console.error('❌ Failed to load campaigns:', e.message); }

try {
  webhookRouter = require('./routes/webhook');
  console.log('✅ Loaded: webhook');
} catch (e) { console.error('❌ Failed to load webhook:', e.message); }

try {
  aiConfigRouter = require('./routes/ai-config');
  console.log('✅ Loaded: ai-config');
} catch (e) { console.error('❌ Failed to load ai-config:', e.message); }

try {
  n8nRouter = require('./routes/n8n');
  console.log('✅ Loaded: n8n');
} catch (e) { console.error('❌ Failed to load n8n:', e.message); }

try {
  menuRouter = require('./routes/menu');
  console.log('✅ Loaded: menu');
} catch (e) { console.error('❌ Failed to load menu:', e.message); }

// ── Express App ──────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Mount Routes (only if loaded successfully) ───────────
if (conversationsRouter) app.use('/api/conversations', conversationsRouter);
if (ordersRouter) app.use('/api/orders', ordersRouter);
if (productsRouter) app.use('/api/products', productsRouter);
if (analyticsRouter) app.use('/api/analytics', analyticsRouter);
if (campaignsRouter) app.use('/api/campaigns', campaignsRouter);
if (webhookRouter) app.use('/api/webhook', webhookRouter);
if (aiConfigRouter) app.use('/api/ai-config', aiConfigRouter);
if (n8nRouter) app.use('/api/n8n', n8nRouter);
if (menuRouter) app.use('/api/menu', menuRouter);

// Health check para Easypanel
app.get('/', (req, res) => res.send('🚀 Backend Agentcore OK'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-restaurant', (id) => socket.join(`restaurant-${id}`));
});

// ── Listen ───────────────────────────────────────────────
// MUST match the EXPOSE in the Dockerfile (3001) — Traefik routes to this port
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SERVIDOR ESCUCHANDO EN PUERTO ${PORT}`);
});
