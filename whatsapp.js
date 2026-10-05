// WhatsApp notifications via Twilio REST API (no SDK needed, Node 18+ fetch)
function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return '+91' + digits;
  return '+' + digits;
}

async function sendWhatsApp(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const number = toE164(to);
  if (!number) return;

  if (!sid || !token) {
    console.log(`\n[WhatsApp - TEST MODE] To: ${number}\n${body}\n`);
    return;
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${number}`, Body: body })
    });
    if (!res.ok) console.error('WhatsApp send failed:', res.status, await res.text());
  } catch (e) {
    console.error('WhatsApp error:', e.message);
  }
}

function orderMessage(order, items, forOwner = false) {
  const store = process.env.STORE_NAME || 'FreshSabji';
  const lines = items.map(i => `• ${i.name} x ${i.qty} ${i.unit} = ₹${(i.price * i.qty).toFixed(0)}`).join('\n');
  const head = forOwner
    ? `🛒 *New order #${order.id}*\nCustomer: ${order.customer_name} (${order.phone})`
    : `✅ *Your order has been placed!*\nOrder #${order.id} - ${store}\nHello ${order.customer_name},`;
  return `${head}\n\n${lines}\n\nSubtotal: ₹${order.subtotal.toFixed(0)}\nDelivery: ₹${order.delivery.toFixed(0)}\n*Total: ₹${order.total.toFixed(0)}*\n\n📍 ${order.address}${order.notes ? `\n📝 ${order.notes}` : ''}\n\n${forOwner ? '' : 'Thank you! Your order will be delivered soon 🙏'}`.trim();
}

async function notifyOrder(order, items) {
  await sendWhatsApp(order.phone, orderMessage(order, items, false));
  if (process.env.OWNER_WHATSAPP) await sendWhatsApp(process.env.OWNER_WHATSAPP, orderMessage(order, items, true));
}

async function notifyStatus(order) {
  const store = process.env.STORE_NAME || 'FreshSabji';
  const msg = `📦 ${store}: Your order #${order.id} is now *${order.status}*.`;
  await sendWhatsApp(order.phone, msg);
}

module.exports = { notifyOrder, notifyStatus };
