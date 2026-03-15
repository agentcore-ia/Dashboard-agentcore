-- ============================================================
-- WhatsApp AI Order Automation System - PostgreSQL Schema
-- ============================================================

-- EXTENSION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- RESTAURANTS (multi-tenant)
-- ============================================================
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  logo_url TEXT,
  google_reviews_url TEXT,
  delivery_fee DECIMAL(10,2) DEFAULT 5.00,
  min_order DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(30) UNIQUE NOT NULL,
  address TEXT,
  neighborhood VARCHAR(100),
  city VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_order_at TIMESTAMPTZ
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE conversaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'active',    -- active | closed
  ai_active BOOLEAN DEFAULT TRUE,
  ai_mode VARCHAR(20) DEFAULT 'active',   -- active | review | disabled
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE mensajes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversacion_id UUID REFERENCES conversaciones(id) ON DELETE CASCADE,
  content TEXT,
  type VARCHAR(20) DEFAULT 'text',        -- text | image | audio | system
  sender VARCHAR(20) NOT NULL,            -- customer | ai | human
  wa_message_id VARCHAR(255),
  read BOOLEAN DEFAULT FALSE,
  pending_approval BOOLEAN DEFAULT FALSE, -- used in review mode
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  conversacion_id UUID REFERENCES conversaciones(id),
  order_number SERIAL,
  status VARCHAR(30) DEFAULT 'new',       -- new | preparing | ready | delivering | delivered | cancelled
  delivery_type VARCHAR(20) DEFAULT 'delivery', -- delivery | pickup
  payment_method VARCHAR(30) DEFAULT 'cash',    -- cash | card | transfer
  address TEXT,
  subtotal DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 5.00,
  total DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  delivery_lat DECIMAL(10,8),
  delivery_lng DECIMAL(11,8),
  rider_lat DECIMAL(10,8),
  rider_lng DECIMAL(11,8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE items_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  name VARCHAR(255) NOT NULL,             -- denormalized for history
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE campanhas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'draft',     -- draft | sending | sent | paused
  sent_count INTEGER DEFAULT 0,
  total_contacts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- ============================================================
-- AI CONFIGURATION
-- ============================================================
CREATE TABLE ai_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  mode VARCHAR(20) DEFAULT 'active',      -- active | review | disabled
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI CORRECTIONS (Learning)
-- ============================================================
CREATE TABLE ai_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_conversaciones_restaurant ON conversaciones(restaurant_id);
CREATE INDEX idx_conversaciones_cliente ON conversaciones(cliente_id);
CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id);
CREATE INDEX idx_pedidos_restaurant ON pedidos(restaurant_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_products_restaurant ON products(restaurant_id);
CREATE INDEX idx_clientes_phone ON clientes(phone);
