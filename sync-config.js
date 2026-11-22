/* Cloud sync settings (Supabase). Fill these in once; every device then only needs
   to sign in with an email code. Both values are safe to publish: the "anon" key is
   public by design, and your data is protected by row-level security (see supabase/schema.sql). */
window.LOS_SYNC_CONFIG = {
  url: "",      // e.g. "https://abcdefgh.supabase.co"
  anonKey: "",  // Project Settings → API → "anon public" key
};
