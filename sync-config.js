/* Cloud sync settings (Supabase). Both values are safe to publish: the "anon" key is
   public by design, and your data is protected by row-level security (see supabase/schema.sql).
   NEVER put the service_role / secret key here. */
window.LOS_SYNC_CONFIG = {
  url: "https://jgfrdrptqykiphszxnpd.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZnJkcnB0cXlraXBoc3p4bnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMjg4NjEsImV4cCI6MjExMDkwNDg2MX0.KNFC-u0a2a1pEMH9vSRYt2p_zM36v95EZfJiW9wcO3s",
  // public key for vulnerability alerts (web push); the private key lives only in Supabase secrets
  vapidPublicKey: "BM-BEWQHXeNvKh5c3f5_QeDmLrwLpktck1buvjmQAqy_oGfZjPD6-0j1Ox9AQvGVUjHbyOVmIsQNVWIu8GNrGSI",
};
