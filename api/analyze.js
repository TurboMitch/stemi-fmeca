// Serverless proxy naar OpenRouter. Sleutel: env OPENROUTER_API_KEY, of header x-openrouter-key (uit de UI). Alleen voor ingelogde Supabase-gebruikers.
import { requireUser } from './_auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const user = await requireUser(req); if (!user) { res.status(401).json({ error: 'Niet ingelogd' }); return; }
  const key = process.env.OPENROUTER_API_KEY || req.headers['x-openrouter-key'];
  if (!key) { res.status(400).json({ error: 'Geen OpenRouter API-sleutel. Vul deze in bij Instellingen of zet OPENROUTER_API_KEY als env var op Vercel.' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { model = 'anthropic/claude-sonnet-4.5', messages = [], json = true, temperature = 0.2, max_tokens = 4000 } = body || {};

  const payload = { model, messages, temperature, max_tokens };
  if (json) payload.response_format = { type: 'json_object' };

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'stemi-fmeca.vercel.app';
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': `https://${host}`,
        'X-Title': 'STEMI Waardegestuurd FMECA'
      },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!r.ok) { res.status(r.status).json({ error: (data.error && data.error.message) || text.slice(0, 500), upstream: data }); return; }
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    res.status(200).json({ content, usage: data.usage, model: data.model });
  } catch (e) {
    res.status(502).json({ error: 'OpenRouter niet bereikbaar: ' + e.message });
  }
}
