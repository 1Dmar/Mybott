const axios = require('axios');

function available() { return Boolean(process.env.OPENAI_API_KEY && (process.env.OPENAI_API_BASE || 'https://api.openai.com/v1') && process.env.OPENAI_MODEL); }

async function interpretEvidence(evidence) {
  if (!available()) return { available: false, message: 'AI interpretation is not configured; deterministic intelligence remains available.' };
  const base = (process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const payload = { model: process.env.OPENAI_MODEL, temperature: 0.1, messages: [{ role: 'system', content: 'You explain server intelligence. Use only the supplied JSON evidence. Never invent, estimate, or alter any number. If evidence is insufficient, say Not enough data yet. Return concise WHAT, WHY, EVIDENCE, IMPACT, RECOMMENDATION.' }, { role: 'user', content: JSON.stringify(evidence) }] };
  try {
    const response = await axios.post(`${base}/chat/completions`, payload, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 });
    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) return { available: true, message: 'AI provider returned no interpretation.' };
    return { available: true, text: String(text).slice(0, 4000), evidenceBound: true };
  } catch (_) { return { available: false, message: 'AI interpretation is temporarily unavailable; deterministic intelligence remains available.' }; }
}

module.exports = { available, interpretEvidence };
