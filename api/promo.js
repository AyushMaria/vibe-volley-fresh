// POST { code, slots, phone } -> { valid, code, subtotal, total, discount }
//
// Validation happens here so the browser cannot invent a discount. The client
// uses the response for display only; book.js re-validates independently.
const { supabase, isConfigured } = require('./_lib/supabase');
const { priceFor, areValidSlots } = require('./_lib/slots');
const { evaluatePromo } = require('./_lib/promo-rules');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!isConfigured) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const { code, slots, phone } = req.body || {};
  if (!areValidSlots(slots)) {
    return res.status(400).json({ ok: false, error: 'Select at least one valid slot first' });
  }

  const subtotal = priceFor(slots);
  const result = await evaluatePromo(supabase, { code, slots, phone, subtotal });

  if (result.error) {
    return res.status(200).json({ ok: true, valid: false, reason: result.error, subtotal });
  }

  return res.status(200).json({
    ok: true,
    valid: true,
    code: result.code,
    subtotal,
    total: result.total,
    discount: subtotal - result.total,
  });
};
