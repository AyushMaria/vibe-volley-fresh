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

  const from = process.env.TWILIO_WHATSAPP_FROM;
  const ownerTo = process.env.TWILIO_TO_OWNER;
  const customerTo = `whatsapp:${phone}`;
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;

  // Template variables (must match the {{1}}..{{6}} placeholders in your
  // approved Twilio WhatsApp template).
  const contentVariables = JSON.stringify({
    1: name,
    2: bookingDate,
    3: timeBlock,
    4: slots,
    5: totalPrice,
    6: promoCode || 'None',
  });

  try {
    // 1) Send to the customer — skip if it's the same as the sender.
    // Uses an approved WhatsApp template so the message can be sent outside
    // the 24-hour customer-initiated messaging window (error 63016).
    if (customerTo !== from) {
      if (templateSid) {
        await client.messages.create({
          from,
          to: customerTo,
          contentSid: templateSid,
          contentVariables,
        });
      } else {
        // Fallback to free-form body if no template is configured (only works
        // inside the 24-hour window).
        await client.messages.create({
          from,
          to: customerTo,
          body:
            `🎾 *Vibe & Volley — Booking Confirmed!*\n\n` +
            `Hi ${name}, your court is booked.\n\n` +
            `📅 Date: ${bookingDate}\n` +
            `🕒 Block: ${timeBlock}\n` +
            `⏰ Slots: ${slots}\n` +
            `💰 Total: ${totalPrice}\n` +
            `🎟️ Promo: ${promoCode || 'None'}\n\n` +
            `See you on court! 🏓`,
        });
      }
    }

    // 2) Send a copy to the owner/staff — skip if it's the same as the sender
    if (ownerTo && ownerTo !== from) {
      await client.messages.create({
        from,
        to: ownerTo,
        body: `*New booking*\n${name} · ${phone}\n${bookingDate} · ${timeBlock}\nSlots: ${slots}\nTotal: ${totalPrice}`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Twilio WhatsApp send failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
