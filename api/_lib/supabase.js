// Server-side Supabase client. Holds the SECRET key and must never be imported
// by anything that ships to a browser.
//
// Deliberately has no anon fallback: the whole point of this layer is that the
// privileged key lives here and nowhere else. A missing key is a deploy fault,
// not something to paper over.
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url) console.error('[api] SUPABASE_URL is not set');
if (!key) console.error('[api] SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY is not set');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase, isConfigured: Boolean(url && key) };
