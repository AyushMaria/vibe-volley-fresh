// Admin dashboard API. Requires an admin session cookie.
//   GET    ?date=&phone=   -> bookings + revenue summary
//   DELETE ?id=            -> delete one booking
const { supabase, isConfigured } = require('./_lib/supabase');
const { parseSlots } = require('./_lib/slots');
const { requireRole } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!requireRole(req, res, ['admin'])) return;
  if (!isConfigured) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  try {
    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

      const { data: existing, error: findErr } = await supabase
        .from('bookings').select('id').eq('id', id).maybeSingle();
      if (findErr) throw findErr;
      if (!existing) return res.status(404).json({ ok: false, error: 'No such booking' });

      const { error: delErr } = await supabase.from('bookings').delete().eq('id', id);
      if (delErr) throw delErr;
      return res.status(200).json({ ok: true, deleted: id });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const date = String((req.query && req.query.date) || '');
    const phone = String((req.query && req.query.phone) || '').trim();

    let query = supabase
      .from('bookings')
      .select('id, booking_date, slots, name, phone, email, total_price, promo_code, payment_mode, time_block, created_at')
      .order('booking_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) query = query.eq('booking_date', date);
    if (phone) query = query.ilike('phone', `%${phone}%`);

    const { data, error } = await query;
    if (error) throw error;

    const bookings = (data || []).map((r) => ({ ...r, slots: parseSlots(r.slots) }));
    const revenue = bookings
      .filter((r) => r.name !== 'BLOCKED')
      .reduce((sum, r) => sum + (r.total_price || 0), 0);

    return res.status(200).json({
      ok: true,
      bookings,
      summary: { count: bookings.length, revenue },
    });
  } catch (err) {
    console.error('[admin]', err.message);
    return res.status(500).json({ ok: false, error: 'Request failed' });
  }
};
