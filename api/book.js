// POST /api/book -> creates a booking. Price, promo, bans, cutoff and conflict
// are all decided here; nothing the browser sends about money is trusted.
const { supabase, isConfigured } = require('./_lib/supabase');
const S = require('./_lib/slots');
const { evaluatePromo } = require('./_lib/promo-rules');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!isConfigured) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const b = req.body || {};
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const email = String(b.email || '').trim();
  const bookingDate = String(b.bookingDate || '').trim();
  const paymentMode = String(b.paymentMode || '').trim();
  const slots = S.sortSlots(Array.isArray(b.slots) ? b.slots : []);

  if (!name) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: 'Phone must be 10 digits' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    return res.status(400).json({ ok: false, error: 'Invalid date' });
  }
  if (!S.areValidSlots(slots)) {
    return res.status(400).json({ ok: false, error: 'Invalid or duplicate slots' });
  }
  if (!['Cash', 'UPI'].includes(paymentMode)) {
    return res.status(400).json({ ok: false, error: 'Payment mode must be Cash or UPI' });
  }

  // Ban list is enforced here now; the browser copy was advisory.
  if (S.isBanned(phone, email)) {
    return res.status(403).json({
      ok: false,
      error: 'This phone number or email is not eligible to make bookings. Please contact us at +91 9156156570 for assistance.',
    });
  }

  if (bookingDate < S.todayIST()) {
    return res.status(400).json({ ok: false, error: 'That date is in the past' });
  }

  const started = slots.filter((s) => S.slotHasStarted(bookingDate, s));
  if (started.length) {
    return res.status(409).json({
      ok: false,
      error: `These slots have already started: ${started.join(', ')}`,
    });
  }

  if (S.isNextMorningCutoffPassed(bookingDate, slots)) {
    return res.status(409).json({
      ok: false,
      error: 'Morning bookings for tomorrow close at 11:00 pm. Please pick another time or date.',
    });
  }

  try {
    // Conflict check across the whole day, not just one time block.
    const { data: existing, error: readError } = await supabase
      .from('bookings')
      .select('slots')
      .eq('booking_date', bookingDate);
    if (readError) throw readError;

    const taken = new Set((existing || []).flatMap((row) => S.parseSlots(row.slots)));
    const clash = slots.filter((s) => taken.has(s));
    if (clash.length) {
      return res.status(409).json({
        ok: false,
        error: `Just taken: ${clash.join(', ')}. Please reselect.`,
        conflict: clash,
      });
    }

    const subtotal = S.priceFor(slots);
    const promo = await evaluatePromo(supabase, { code: b.promoCode, slots, phone, subtotal });
    if (promo.error) {
      return res.status(400).json({ ok: false, error: promo.error });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('bookings')
      .insert([{
        name,
        phone,
        email: email || null,
        booking_date: bookingDate,
        time_block: S.blockFor(slots[0]),
        slots,
        promo_code: promo.code || null,
        total_price: promo.total,
        payment_mode: paymentMode,
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      ok: true,
      booking: {
        id: inserted.id,
        booking_date: inserted.booking_date,
        slots: S.parseSlots(inserted.slots),
        total_price: inserted.total_price,
        promo_code: inserted.promo_code,
      },
      subtotal,
    });
  } catch (err) {
    console.error('[book]', err.message);
    return res.status(500).json({ ok: false, error: 'Could not create booking' });
  }
};
