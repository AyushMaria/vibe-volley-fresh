// Removed: the browser must not hold a Supabase key.
//
// REACT_APP_* values are inlined into the production bundle by Create React
// App, so the anon key this used to read was published to every visitor. All
// database access now goes through the /api/* handlers, which hold the secret
// key server-side (see api/_lib/supabase.js).
//
// This stub exists so an accidental re-import fails loudly instead of quietly
// shipping a credential again. Safe to delete once nothing references it.
export const supabase = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'Direct Supabase access from the browser has been removed. ' +
          'Use the api() helper in App.js, which calls the /api/* handlers.'
      );
    },
  }
);
