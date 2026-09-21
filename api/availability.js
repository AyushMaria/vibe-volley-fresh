// GET /api/availability?date=YYYY-MM-DD -> { booked: [...], slots: {...} }
//
// Public, but returns only slot strings -- no names, phones, prices or IDs.
// Queries by date alone. The old browser query filtered on time_block too, so a
// booking straddling two blocks (Ace derives time_block from its first slot)
// was invisible to the other block and could be double-booked.
const { supabase, isConfigured } = require('./_lib/supabase');
const { TIME_SLOTS, parseSlots } = require('./_lib/slots');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!isConfigured) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const date = String((req.query && req.query.date) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date must be YYYY-MM-DD' });
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('slots')
      .eq('booking_date', date);

    if (error) throw error;

    const booked = (data || []).flatMap((row) => parseSlots(row.slots));

    return res.status(200).json({
      ok: true,
      date,
      booked: [...new Set(booked)],
      slots: TIME_SLOTS,
    });
  } catch (err) {
    console.error('[availability]', err.message);
    return res.status(500).json({ ok: false, error: 'Could not load availability' });
  }
};
