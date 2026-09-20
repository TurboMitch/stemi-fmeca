// Serverless proxy naar OpenRouter. Alleen voor ingelogde Supabase-gebruikers.
// Sleutel: env OPENROUTER_API_KEY (aanbevolen). De header x-openrouter-key wordt alleen geaccepteerd
// zolang die env-var niet bestaat, zodat de sleutel niet standaard via de browser hoeft te reizen.
import { requireUser, tokensVandaag } from './_auth.js';

export const config = { maxDuration: 300 };

const MAX_TOKENS = 32000;                  // plafond per aanroep
const MAX_BERICHT_TEKENS = 400000;         // plafond op de promptgrootte
const DAGBUDGET_TOKENS = Number(process.env.AI_DAGBUDGET_TOKENS || 3000000); // per gebruiker per dag
const MODEL_TOEGESTAAN = /^(anthropic|openai|google|meta-llama|mistralai|deepseek|qwen|x-ai|amazon|cohere)\//;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const user = await requireUser(req); if (!user) { res.status(401).json({ error: 'Niet ingelogd' }); return; }

  const envKey = process.env.OPENROUTER_API_KEY;
  const key = envKey || req.headers['x-openrouter-key'];
  if (!key) { res.status(400).json({ error: 'Geen OpenRouter API-sleutel. Zet OPENROUTER_API_KEY als env var op Vercel (aanbevolen) of vul hem in bij Instellingen.' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { model = 'anthropic/claude-sonnet-4.5', messages = [], json = true, temperature = 0.2, reasoning } = body || {};
  const max_tokens = Math.min(Number(body?.max_tokens) || 16000, MAX_TOKENS);

  if (!Array.isArray(messages) || !messages.length) { res.status(400).json({ error: 'Geen berichten' }); return; }
  if (!MODEL_TOEGESTAAN.test(String(model))) { res.status(400).json({ error: `Model "${model}" staat niet op de toegestane lijst.` }); return; }
  const tekens = JSON.stringify(messages).length;
  if (tekens > MAX_BERICHT_TEKENS) { res.status(413).json({ error: `Prompt te groot (${Math.round(tekens/1000)} kB, maximum ${MAX_BERICHT_TEKENS/1000} kB).` }); return; }

  const gebruikt = await tokensVandaag(req, user.id);
  if (gebruikt != null && gebruikt > DAGBUDGET_TOKENS) {
    res.status(429).json({ error: `Dagbudget bereikt: ${gebruikt.toLocaleString('nl-NL')} tokens vandaag (limiet ${DAGBUDGET_TOKENS.toLocaleString('nl-NL')}). Morgen weer, of verhoog AI_DAGBUDGET_TOKENS op Vercel.` });
    return;
  }

  const payload = { model, messages, temperature, max_tokens };
  if (reasoning) payload.reasoning = reasoning;
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
    const ch = data.choices && data.choices[0];
    let content = ch && ch.message && ch.message.content;
    if (Array.isArray(content)) content = content.map(c => c.text || '').join('');
    if ((!content || !String(content).trim()) && ch && ch.message && ch.message.reasoning) content = ch.message.reasoning;
    if (!content || !String(content).trim()) { res.status(502).json({ error: 'Model gaf een leeg antwoord' + (data.error ? ': ' + (data.error.message || JSON.stringify(data.error)) : '') + (ch && ch.finish_reason ? ' (finish_reason ' + ch.finish_reason + ')' : ''), upstream: data }); return; }
    res.status(200).json({ content, usage: data.usage, model: data.model, finish_reason: ch.finish_reason, sleutelBron: envKey ? 'env' : 'ui' });
  } catch (e) {
    res.status(502).json({ error: 'OpenRouter niet bereikbaar: ' + e.message });
  }
}
