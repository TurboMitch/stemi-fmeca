// Lijst van alle OpenRouter-modellen (voor de modelkeuze in Instellingen)
import { requireUser } from './_auth.js';
export default async function handler(req, res) {
  const user = await requireUser(req); if (!user) { res.status(401).json({ error: 'Niet ingelogd' }); return; }
  const key = process.env.OPENROUTER_API_KEY || req.headers['x-openrouter-key'];
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    const d = await r.json();
    const models = (d.data || []).map(m => ({ id: m.id, name: m.name, context: m.context_length, prompt: m.pricing?.prompt, completion: m.pricing?.completion, modality: m.architecture?.modality, created: m.created }))
      .sort((a, b) => (b.created || 0) - (a.created || 0));
    res.setHeader('Cache-Control', 's-maxage=3600'); res.status(200).json({ models });
  } catch (e) { res.status(502).json({ error: 'OpenRouter niet bereikbaar: ' + e.message }); }
}
