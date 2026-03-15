const whatsapp = require('./whatsapp');

const STATUS_MESSAGES = {
  preparing: (orderNum) => `⏳ *Pedido #${orderNum}* — Sua comida está sendo preparada! Aguarde um momento 👨‍🍳`,
  ready: (orderNum) => `✅ *Pedido #${orderNum}* — Seu pedido está pronto!\n\n🚴 Em breve nosso entregador buscará.`,
  delivering: (orderNum) => `🚴 *Pedido #${orderNum}* — Seu pedido saiu para entrega!\n\nAcompanhe em tempo real pelo link que receberá em instantes.`,
  delivered: (orderNum) => `🎉 *Pedido #${orderNum}* — Seu pedido foi entregue!\n\nObrigado por escolher a Beast Burgers! Deixe sua avaliação:\n⭐ https://g.page/r/beast-burgers-review`,
  cancelled: (orderNum) => `❌ *Pedido #${orderNum}* — Lamentamos, mas seu pedido foi cancelado.\n\nEntre em contato conosco para mais informações.`,
};

async function sendStatusUpdate(phone, status, orderNumber) {
  const message = STATUS_MESSAGES[status];
  if (!message || !phone) return;
  return whatsapp.sendText(phone, message(orderNumber));
}

module.exports = { sendStatusUpdate };
