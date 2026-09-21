// GET /api/staff?date=YYYY-MM-DD -> bookings for the on-site staff view.
// Requires a staff or admin session cookie. Was previously an unauthenticated
// page that returned every booking ever made, name and phone included.
const { supabase, isConfigured } = require('./_lib/supabase');
const { parseSlots, todayIST } = require('./_lib/slots');
const { requireRole } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!requireRole(req, res, ['staff', 'admin'])) return;
  if (!isConfigured) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const date = String((req.query && req.query.date) || '') || todayIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date must be YYYY-MM-DD' });
  }

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_date, slots, name, phone, total_price')
      .eq('booking_date', date)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      date,
      bookings: (data || []).map((r) => ({ ...r, slots: parseSlots(r.slots) })),
    });
  } catch (err) {
    console.error('[staff]', err.message);
    return res.status(500).json({ ok: false, error: 'Could not load bookings' });
  }
};
