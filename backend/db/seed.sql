-- ============================================================
-- DEMO SEED DATA — Beast Burgers
-- ============================================================

-- Restaurant
INSERT INTO restaurants (id, name, slug, phone, address, city, google_reviews_url, delivery_fee)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Beast Burgers',
  'beast-burgers',
  '+5511999999999',
  'Av. Paulista, 1000',
  'São Paulo, SP',
  'https://g.page/r/beast-burgers-review',
  5.00
);

-- Products
INSERT INTO products (restaurant_id, name, description, price, category, available) VALUES
('00000000-0000-0000-0000-000000000001', 'Beast Classic', 'Blend 180g, queijo cheddar, alface, tomate, cebola caramelizada, molho especial', 32.90, 'Burgers', true),
('00000000-0000-0000-0000-000000000001', 'Beast Double', 'Blend duplo 360g, queijo cheddar duplo, bacon crocante, alface, tomate', 44.90, 'Burgers', true),
('00000000-0000-0000-0000-000000000001', 'Beast Crispy', 'Frango empanado artesanal, queijo prato, alface, tomate, maionese de ervas', 29.90, 'Burgers', true),
('00000000-0000-0000-0000-000000000001', 'Batata c/ Cheddar e Bacon - média', 'Batatas fritas crocantes com cheddar cremoso e bacon crocante', 22.90, 'Sides', true),
('00000000-0000-0000-0000-000000000001', 'Batata c/ Cheddar e Bacon - grande', 'Batatas fritas crocantes com cheddar cremoso e bacon crocante', 29.90, 'Sides', true),
('00000000-0000-0000-0000-000000000001', 'Onion Rings', 'Anéis de cebola empanados, crocantes por fora e macios por dentro', 18.90, 'Sides', true),
('00000000-0000-0000-0000-000000000001', 'Refri 600ml', 'Coca-Cola, Guaraná Antarctica ou Fanta Laranja', 9.00, 'Drinks', true),
('00000000-0000-0000-0000-000000000001', 'Suco Natural 500ml', 'Laranja, Limão ou Abacaxi com Hortelã', 12.90, 'Drinks', true),
('00000000-0000-0000-0000-000000000001', 'Água Mineral 500ml', 'Com ou sem gás', 5.00, 'Drinks', true);

-- AI Config
INSERT INTO ai_config (restaurant_id, mode, system_prompt) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'active',
  'Você é o Beastie, assistente virtual da Beast Burgers. Seja simpático, use emojis com moderação e sempre ofereça extras (combos, bebidas, sobremesas). Colete: nome, endereço ou "retirada no local", método de pagamento. Confirme o pedido antes de finalizar.'
);

-- Demo Customers
INSERT INTO clientes (id, restaurant_id, name, phone, address) VALUES
('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Pedro Machado', '+5511987654321', 'Av. Paulista, 1500, Apto 42'),
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Kaua Parizzi', '+5511976543210', 'Rua Augusta, 200'),
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Natalia', '+18972544744', 'Rua Oscar Freire, 55'),
('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Vanessa Souza Santiago', '+5511965432109', 'Rua Haddock Lobo, 300'),
('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Kamila Vieira', '+5511954321098', 'Alameda Santos, 800'),
('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Vini', '+5511943210987', 'Rua Pamplona, 145'),
('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Azeredo', '+5511932109876', 'Av. Brigadeiro Luís Antônio, 700');

-- Demo Conversations
INSERT INTO conversaciones (id, restaurant_id, cliente_id, status, ai_active, last_message_at) VALUES
('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'active', true, NOW() - interval '2 minutes'),
('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'active', true, NOW() - interval '56 days'),
('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'active', true, NOW() - interval '56 days'),
('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'active', true, NOW() - interval '56 days'),
('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', 'active', true, NOW() - interval '56 days'),
('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', 'active', true, NOW() - interval '56 days'),
('00000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000016', 'active', true, NOW() - interval '56 days');

-- Demo Messages for Pedro Machado conversation
INSERT INTO mensajes (conversacion_id, content, type, sender, created_at) VALUES
('00000000-0000-0000-0000-000000000020', 'Oi, quero pedir uma hamburguesa', 'text', 'customer', NOW() - interval '10 minutes'),
('00000000-0000-0000-0000-000000000020', 'Olá Pedro! 👋 Bem-vindo à Beast Burgers! Aqui estão nossas opções:\n\n🍔 *Beast Classic* — R$ 32,90\n🍔 *Beast Double* — R$ 44,90\n🍔 *Beast Crispy* (frango) — R$ 29,90\n\nQual delas te agrada?', 'text', 'ai', NOW() - interval '9 minutes'),
('00000000-0000-0000-0000-000000000020', 'Beast Classic por favor', 'text', 'customer', NOW() - interval '8 minutes'),
('00000000-0000-0000-0000-000000000020', 'Ótima escolha! 🔥\n\nQuer adicionar ao combo?\n🍟 Batata c/ Cheddar Bacon — R$ 22,90\n🥤 Refri 600ml — R$ 9,00\n\nOs dois juntos ficam só R$ 31,90!', 'text', 'ai', NOW() - interval '7 minutes'),
('00000000-0000-0000-0000-000000000020', 'Sim, quero os dois', 'text', 'customer', NOW() - interval '6 minutes'),
('00000000-0000-0000-0000-000000000020', 'Perfeito! 🎉 Me passa seu endereço pra entrega?', 'text', 'ai', NOW() - interval '5 minutes'),
('00000000-0000-0000-0000-000000000020', 'Av Paulista 1500 apto 42', 'text', 'customer', NOW() - interval '4 minutes'),
('00000000-0000-0000-0000-000000000020', '📋 *Resumo do pedido:*\n\n1x Beast Classic — R$ 32,90\n1x Batata c/ Cheddar Bacon — R$ 22,90\n1x Refri 600ml — R$ 9,00\n\nSubtotal: R$ 64,80\nTaxa de entrega: R$ 5,00\n*TOTAL: R$ 69,80*\n\n📍 Av. Paulista, 1500, Apto 42\n\nForma de pagamento? (Cartão / Dinheiro / Pix)', 'text', 'ai', NOW() - interval '3 minutes'),
('00000000-0000-0000-0000-000000000020', 'Cartão', 'text', 'customer', NOW() - interval '2 minutes'),
('00000000-0000-0000-0000-000000000020', 'pode sim', 'text', 'customer', NOW() - interval '1 minute');

-- Demo Order
INSERT INTO pedidos (id, restaurant_id, cliente_id, conversacion_id, order_number, status, delivery_type, payment_method, address, subtotal, delivery_fee, total, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  260043,
  'new',
  'delivery',
  'card',
  'Av. Paulista, 1500, Apto 42',
  71.80, 5.00, 76.80,
  NOW() - interval '1 minute'
);

-- Get product IDs for order items
DO $$
DECLARE
  v_beast_classic UUID;
  v_batata UUID;
  v_refri UUID;
BEGIN
  SELECT id INTO v_beast_classic FROM products WHERE name = 'Beast Classic' LIMIT 1;
  SELECT id INTO v_batata FROM products WHERE name = 'Batata c/ Cheddar e Bacon - média' LIMIT 1;
  SELECT id INTO v_refri FROM products WHERE name = 'Refri 600ml' LIMIT 1;

  INSERT INTO items_pedido (pedido_id, product_id, name, price, quantity, notes) VALUES
  ('00000000-0000-0000-0000-000000000030', v_beast_classic, 'Beast Classic', 32.90, 1, 'Ao ponto'),
  ('00000000-0000-0000-0000-000000000030', v_batata, 'Batata c/ Cheddar e Bacon - média', 29.90, 1, NULL),
  ('00000000-0000-0000-0000-000000000030', v_refri, 'Refri 600ml', 9.00, 1, NULL);
END $$;
