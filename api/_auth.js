// Controleert het Supabase-JWT van de ingelogde gebruiker (Authorization: Bearer <access_token>)
// en levert hulpfuncties om server-side met dat token de database te lezen (RLS blijft dus gelden).
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

/** Tokengebruik van deze gebruiker vandaag, uit ai_gebruik (door de server zelf gevuld). null = niet vast te stellen. */
export async function tokensVandaag(req, userId) {
  const auth = req.headers['authorization'] || '';
  const vanaf = new Date(); vanaf.setUTCHours(0, 0, 0, 0);
  try {
    const r = await fetch(`${URL_}/rest/v1/ai_gebruik?select=tokens&user_id=eq.${userId}&ts=gte.${vanaf.toISOString()}`, { headers: { apikey: KEY, Authorization: auth }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows.reduce((a, x) => a + (x.tokens || 0), 0);
  } catch { return null; }
}

/** Schrijft het verbruik van één aanroep weg (server-side, met het token van de gebruiker; RLS staat alleen eigen user_id toe). */
export async function logGebruik(req, userId, { model, taak, usage }) {
  const auth = req.headers['authorization'] || '';
  const tokens = Number(usage?.total_tokens) || ((Number(usage?.prompt_tokens) || 0) + (Number(usage?.completion_tokens) || 0));
  const kosten = usage?.cost != null ? Number(usage.cost) : null;
  try {
    await fetch(`${URL_}/rest/v1/ai_gebruik`, { method: 'POST', headers: { apikey: KEY, Authorization: auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, model: String(model || '').slice(0, 120), taak: String(taak || '').slice(0, 40), tokens, kosten_usd: kosten }), signal: AbortSignal.timeout(8000) });
  } catch {}
}
