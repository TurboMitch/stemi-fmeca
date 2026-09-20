// Vertelt de app of de OpenRouter-sleutel server-side beschikbaar is (geen sleutel of credits nodig).
import { requireUser, tokensVandaag } from './_auth.js';
export default async function handler(req, res) {
  const user = await requireUser(req); if (!user) { res.status(401).json({ error: 'Niet ingelogd' }); return; }
  const gebruikt = await tokensVandaag(req, user.id);
  res.status(200).json({
    sleutelOpServer: !!process.env.OPENROUTER_API_KEY,
    dagbudget: Number(process.env.AI_DAGBUDGET_TOKENS || 3000000),
    tokensVandaag: gebruikt
  });
}
