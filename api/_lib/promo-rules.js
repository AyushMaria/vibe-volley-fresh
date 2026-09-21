// Promo evaluation, shared by /api/promo (preview) and /api/book (authoritative).
//
// Usage is counted from `bookings` rather than `promo_usage`: Ace writes both,
// the website only ever wrote bookings, so bookings is the complete ledger.
async function evaluatePromo(supabase, { code, slots, phone, subtotal }) {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw) return { code: null, total: subtotal };

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', raw)
    .maybeSingle();

  if (error) return { error: 'Could not validate promo code' };
  if (!data) return { error: 'Invalid promo code' };
  if (data.active === false) return { error: 'This promo code is no longer active' };

  if (data.expires_at) {
    const expiry = String(data.expires_at).slice(0, 10);
    const today = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    ).toISOString().slice(0, 10);
    if (expiry < today) return { error: 'This promo code has expired' };
  }

  if (data.min_slots && slots.length < data.min_slots) {
    return { error: `This promo needs at least ${data.min_slots} slot(s)` };
  }

  if (data.weekends_only) return { error: 'This promo code is valid on weekends only' };

  if (data.valid_slots) {
    const allowed = Array.isArray(data.valid_slots) ? data.valid_slots : [];
    if (allowed.length && slots.some((s) => !allowed.includes(s))) {
      return { error: `This promo is only valid for: ${allowed.join(', ')}` };
    }
  }

  if (data.max_uses_per_phone && phone) {
    const { count, error: usageError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('phone', String(phone).trim())
      .eq('promo_code', raw);
    if (usageError) return { error: 'Could not validate promo code' };
    if ((count || 0) >= data.max_uses_per_phone) {
      return { error: 'You have already used this promo the maximum number of times' };
    }
  }

  let total = subtotal;
  if (data.discount_type === 'percent') {
    total = Math.round(subtotal * (1 - data.discount_value / 100));
  } else if (data.discount_type === 'flat') {
    total = Math.max(0, subtotal - data.discount_value);
  }

  return { code: raw, total };
}

module.exports = { evaluatePromo };
