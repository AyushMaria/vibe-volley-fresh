// Customer self-service. POST { phone } lists upcoming bookings;
// POST { phone, cancelId } cancels one, but only if that booking belongs to
// the phone given -- the id alone is never enough.
const { supabase, isConfigured } = require('./_lib/supabase');
const { parseSlots, todayIST } = require('./_lib/slots');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!isConfigured) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const phone = String((req.body || {}).phone || '').trim();
  const cancelId = (req.body || {}).cancelId;

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid 10-digit phone number' });
  }

  try {
    if (cancelId !== undefined && cancelId !== null) {
      const { data: owned, error: ownErr } = await supabase
        .from('bookings')
        .select('id, phone')
        .eq('id', cancelId)
        .eq('phone', phone)
        .maybeSingle();
      if (ownErr) throw ownErr;
      if (!owned) {
        return res.status(404).json({ ok: false, error: 'No such booking for this number' });
      }

      const { error: delErr } = await supabase.from('bookings').delete().eq('id', cancelId);
      if (delErr) throw delErr;
      return res.status(200).json({ ok: true, cancelled: cancelId });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_date, slots, total_price, time_block')
      .eq('phone', phone)
      .neq('name', 'BLOCKED')
      .gte('booking_date', todayIST())
      .order('booking_date', { ascending: true });
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      bookings: (data || []).map((r) => ({ ...r, slots: parseSlots(r.slots) })),
    });
  } catch (err) {
    console.error('[my-bookings]', err.message);
    return res.status(500).json({ ok: false, error: 'Could not load bookings' });
  }
};
