// Controleert het Supabase-JWT van de ingelogde gebruiker (Authorization: Bearer <access_token>)
const URL_ = process.env.SUPABASE_URL || 'https://opwdcaxcypbsbqkuxbxx.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_1OQ12VszA0Lf21T7p1HItg_L4p2K9It';
export async function requireUser(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: auth } });
    if (!r.ok) return null; const u = await r.json(); return u && u.id ? u : null;
  } catch { return null; }
}
