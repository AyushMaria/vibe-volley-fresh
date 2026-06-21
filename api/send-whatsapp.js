const twilio = require('twilio');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    name,
    phone,
    bookingDate,
    timeBlock,
    slots,
    totalPrice,
    promoCode,
  } = req.body || {};

  if (!name || !phone || !bookingDate || !slots) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const body =
    `🎾 *Vibe & Volley — Booking Confirmed!*\n\n` +
    `Hi ${name}, your court is booked.\n\n` +
    `📅 Date: ${bookingDate}\n` +
    `🕒 Block: ${timeBlock}\n` +
    `⏰ Slots: ${slots}\n` +
    `💰 Total: ${totalPrice}\n` +
    `🎟️ Promo: ${promoCode || 'None'}\n\n` +
    `See you on court! 🏓`;

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
      body,
    });

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: process.env.TWILIO_TO_OWNER,
      body: `*New booking*\n${name} · ${phone}\n${bookingDate} · ${timeBlock}\nSlots: ${slots}\nTotal: ${totalPrice}`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Twilio WhatsApp send failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
