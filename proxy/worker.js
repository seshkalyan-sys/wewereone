// holds the groq key so the public page never sees it. set it with: wrangler secret put GROQ_API_KEY
const GROQ = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const NOT_CHAT = /whisper|guard|tts|embed|orpheus|playai|safeguard|compound|allam|moderation|audio|image|diffusion/i;
let models = { ids: [DEFAULT_MODEL], at: 0 };

// every chat model on the account's free groq plan, refreshed every 10 minutes
async function chatModels(env) {
  if (Date.now() - models.at < 600000) return models.ids;
  try {
    const r = await fetch(GROQ + '/models', { headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY } });
    if (r.ok) {
      const ids = ((await r.json()).data || []).filter(m => m.active !== false).map(m => m.id).filter(id => !NOT_CHAT.test(id));
      if (ids.length) models = { ids, at: Date.now() };
    }
  } catch {}
  return models.ids;
}
const ORIGINS = [/^https:\/\/seshkalyan-sys\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const PER_IP_PER_MIN = 20;
const seen = new Map();

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function tooFast(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter(t => now - t < 60000);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();
  return hits.length > PER_IP_PER_MIN;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (!ORIGINS.some(re => re.test(origin))) return new Response('forbidden', { status: 403 });
    const h = cors(origin);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const path = new URL(req.url).pathname;
    if (req.method === 'GET' && path === '/ping') return new Response('ok', { headers: h });
    if (req.method === 'GET' && path === '/models') {
      const ids = await chatModels(env);
      return new Response(JSON.stringify({ data: ids.map(id => ({ id })) }), { headers: { ...h, 'Content-Type': 'application/json' } });
    }
    if (req.method !== 'POST' || path !== '/chat') return new Response('not found', { status: 404, headers: h });
    if (tooFast(req.headers.get('CF-Connecting-IP') || '')) {
      return new Response('slow down', { status: 429, headers: { ...h, 'Retry-After': '10' } });
    }

    let body;
    try { body = await req.json(); } catch { return new Response('bad json', { status: 400, headers: h }); }
    if (!Array.isArray(body.messages) || JSON.stringify(body.messages).length > 24000) {
      return new Response('bad request', { status: 400, headers: h });
    }
    const allowed = await chatModels(env);
    const model = allowed.includes(body.model) ? body.model : DEFAULT_MODEL;
    const out = {
      model,
      messages: body.messages,
      max_tokens: Math.min(Number(body.max_tokens) || 400, 900),
      temperature: Math.min(Math.max(Number(body.temperature) || 0.9, 0), 1.5),
      stream: !!body.stream,
    };
    if (/gpt-oss/.test(model)) out.reasoning_effort = 'low';
    if (body.response_format && body.response_format.type === 'json_object') out.response_format = { type: 'json_object' };

    const res = await fetch(GROQ + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GROQ_API_KEY },
      body: JSON.stringify(out),
    });
    const headers = { ...h, 'Content-Type': res.headers.get('Content-Type') || 'application/json' };
    const ra = res.headers.get('Retry-After');
    if (ra) headers['Retry-After'] = ra;
    // never relay groq's account headers or error details beyond the status
    if (!res.ok) return new Response(JSON.stringify({ error: res.status }), { status: res.status === 401 ? 502 : res.status, headers });
    return new Response(res.body, { status: 200, headers });
  },
};
