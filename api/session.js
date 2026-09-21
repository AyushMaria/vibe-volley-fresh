// POST { passcode }  -> sets an httpOnly session cookie, returns { role }
// DELETE             -> clears it
const { roleForPasscode, issueCookie, clearCookie, sessionFrom } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearCookie());
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const session = sessionFrom(req);
    return res.status(200).json({ ok: true, role: session ? session.role : null });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { passcode } = req.body || {};
  const role = roleForPasscode(passcode);

  if (!role) {
    // Deliberately slow and vague: no hint about which passcode was close.
    await new Promise((r) => setTimeout(r, 400));
    return res.status(401).json({ ok: false, error: 'Incorrect passcode' });
  }

  res.setHeader('Set-Cookie', issueCookie(role));
  return res.status(200).json({ ok: true, role });
};
