const axios = require('axios');

const BASE_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const headers = () => ({
  'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
});

async function sendText(to, text) {
  const response = await axios.post(BASE_URL, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  }, { headers: headers() });
  return response.data;
}

async function sendImage(to, imageUrl, caption) {
  const response = await axios.post(BASE_URL, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  }, { headers: headers() });
  return response.data;
}

async function sendTemplate(to, templateName, languageCode = 'pt_BR', components = []) {
  const response = await axios.post(BASE_URL, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  }, { headers: headers() });
  return response.data;
}

module.exports = { sendText, sendImage, sendTemplate };
