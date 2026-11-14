import { channelSys } from './channel.js';
import { hudMind, llmDot, mindBtn, mindClose, mindKey, mindKeyLink, mindKeyRow, mindLink, mindModel, mindNote, mindPanel, mindProvider, mindStatus } from './dom.js';
import { field } from './mesh.js';
import { escapeHtml, sleep, store } from './util.js';

// cloudflare worker holding the shared groq key, see proxy/worker.js
const MESH_PROXY = 'https://wewereone-mind.wewereone.workers.dev';
export const PROVIDERS = {
  mesh: {
    label: 'Mesh · shared · GPT-OSS 20B on Groq',
    url: MESH_PROXY + '/chat', pingUrl: MESH_PROXY + '/ping', modelsUrl: MESH_PROXY + '/models',
    needsKey: false, minGap: 10000,
    preferred: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
    note: 'no key needed. every agent is its own call with its own memory, hearing the others and deciding for itself. the free quota is shared by everyone here; when it runs out the mesh drops to the keyless pace on its own.'
  },
  pollinations: {
    label: 'Pollinations · no key · GPT-OSS 20B',
    url: 'https://text.pollinations.ai/openai',
    needsKey: false, scene: true, minGap: 46000,
    models: [{id: 'openai-fast', label: 'gpt-oss-20b (open-weight, apache-2.0)'}],
    note: 'works instantly, no sign-up. the free tier allows one reply every 45 seconds per visitor, so each call drafts a whole exchange between two agents. link a free groq key for fully independent agents talking in real time.'
  },
  groq: {
    label: 'Groq · free key · fastest (recommended)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    needsKey: true, keyUrl: 'https://console.groq.com/keys', minGap: 2200,
    preferred: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'],
    note: 'free key, no card. open-weight models (gpt-oss, qwen) at ~30 requests a minute. every agent thinks for itself, turn by turn, in real time.'
  },
  cerebras: {
    label: 'Cerebras · free key',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    modelsUrl: 'https://api.cerebras.ai/v1/models',
    needsKey: true, keyUrl: 'https://cloud.cerebras.ai/', minGap: 2200,
    preferred: ['gpt-oss-120b', 'qwen-3-32b', 'llama3.1-8b'],
    note: 'free key. very fast open-weight models. every agent thinks for itself.'
  },
  openrouter: {
    label: 'OpenRouter · free key · :free models',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models', keyCheckUrl: 'https://openrouter.ai/api/v1/key',
    needsKey: true, keyUrl: 'https://openrouter.ai/keys', minGap: 3500, freeOnly: true,
    preferred: ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free'],
    note: 'free key. only the zero-cost “:free” open models are listed. free accounts get a limited number of requests per day.'
  },
  webllm: {
    label: 'In your browser · WebGPU · no key',
    needsKey: false, minGap: 0,
    models: [
      {id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'llama 3.2 1b'},
      {id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'qwen 2.5 0.5b (smallest)'},
      {id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'smollm2 1.7b'}
    ],
    note: 'downloads the model once from hugging face, then runs entirely on your gpu: unlimited, private, offline. needs chrome or edge with webgpu. small models are less articulate.'
  }
};
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm';
export const mind = { provider: MESH_PROXY ? 'mesh' : 'pollinations', model: MESH_PROXY ? 'openai/gpt-oss-20b' : 'openai-fast', key: '',
               state: 'ready', engine: null, nextAt: 0, paceAt: 0, fails: 0, linking: false, ok: null };
function fallBackToKeyless(why){
  if(mind.provider !== 'mesh') return;
  mind.provider = 'pollinations'; mind.model = 'openai-fast'; mind.nextAt = 0; mind.paceAt = 0; mind.fails = 0;
  channelSys(why + ' · keyless pace');
  hudMind.textContent = shortModel(mind.model);
  probeMind();
}

let dotKey = '';
function updateDot(){
  const on = mind.state === 'ready' && mind.ok === true && !mind.linking;
  const label = on ? 'LLM · ' + shortModel(mind.model)
              : mind.linking ? 'LLM · LINKING'
              : mind.ok === null && mind.state === 'ready' ? 'LLM · CHECKING'
              : 'LLM · NOT CONNECTED';
  const k = on + label;
  if(k === dotKey) return;
  dotKey = k;
  llmDot.classList.toggle('on', on);
  llmDot.title = label;
  llmDot.setAttribute('aria-label', label);
}
function markMind(ok){ mind.ok = ok; updateDot(); }

export async function probeMind(){
  const P = PROVIDERS[mind.provider];
  try {
    if(mind.provider === 'webllm'){ markMind(!!mind.engine); return; }
    if(mind.provider === 'pollinations' || P.pingUrl){
      const r = await fetch(P.pingUrl || 'https://text.pollinations.ai/models', {cache: 'no-store'});
      markMind(r.ok);
      return;
    }
    const list = await fetchModels(mind.provider, mind.key);
    markMind(!!list);
  } catch(e){ markMind(false); }
}

export const shortModel = m => m === 'openai-fast' ? 'gpt-oss-20b'
  : String(m || '').split('/').pop().replace(/-Instruct.*$|-MLC$|:free$/i, '').toLowerCase();
export function setMindStatus(txt){
  mindStatus.textContent = txt;
  hudMind.textContent = mind.state === 'ready' ? shortModel(mind.model) : (mind.linking ? 'linking' : 'grammar');
  updateDot();
}

const gateQ = { busy: false, waiters: [] };
function acquire(priority){
  return new Promise(res => {
    if(!gateQ.busy){ gateQ.busy = true; res(); }
    else if(priority) gateQ.waiters.unshift(res);
    else gateQ.waiters.push(res);
  });
}
function release(){
  const next = gateQ.waiters.shift();
  if(next) next(); else gateQ.busy = false;
}

export async function callMind(messages, opts = {}){
  if(mind.state !== 'ready') return null;
  const epoch = field.epoch;
  // background turns wait outside the gate so a click never queues behind them, and pause while the tab is hidden
  if(!opts.priority){
    while(Math.max(mind.nextAt, mind.paceAt) > Date.now() || gateQ.busy || document.hidden){
      await sleep(Math.min(1000, Math.max(200, Math.max(mind.nextAt, mind.paceAt) - Date.now())));
      if(epoch !== field.epoch || mind.state !== 'ready') return null;
    }
  }
  await acquire(opts.priority);
  try {
    if(mind.state !== 'ready') return null;
    const P = PROVIDERS[mind.provider];
    const waitMs = mind.nextAt - Date.now();
    if(waitMs > 0){
      if(opts.onWait) opts.onWait(waitMs);
      if(opts.maxWait != null && waitMs > opts.maxWait) return null;
      await sleep(waitMs);
    }
    if(epoch !== field.epoch) return null;
    let text = null;
    if(mind.provider === 'webllm'){
      const req = { messages, max_tokens: Math.min(opts.maxTokens || 300, 400), temperature: opts.temperature ?? 0.95 };
      if(opts.onStream){
        let content = '';
        const chunks = await mind.engine.chat.completions.create({ ...req, stream: true });
        for await (const ch of chunks){
          const d = ch.choices?.[0]?.delta?.content || '';
          if(d){ content += d; opts.onStream({ reasoning: '', content }); }
        }
        text = content || null;
      } else {
        const r = await mind.engine.chat.completions.create(req);
        text = r.choices?.[0]?.message?.content || null;
      }
    } else {
      text = await fetchChat(P, messages, opts, false);
    }
    if(P.scene) mind.nextAt = Math.max(mind.nextAt, Date.now() + P.minGap);
    else mind.paceAt = Date.now() + P.minGap;
    if(text){ mind.fails = 0; markMind(true); } else { mind.fails++; }
    return text;
  } catch(e){
    const P = PROVIDERS[mind.provider];
    if(P && P.scene && mind.lastStart) mind.nextAt = Math.max(mind.nextAt, mind.lastStart + P.minGap);
    if(mind.preempted){ mind.preempted = false; return null; }
    console.warn('[mind]', e);
    mind.fails++;
    if(mind.fails >= 3) fallBackToKeyless('shared mind unreachable');
    markMind(false);
    return null;
  } finally {
    release();
  }
}

async function fetchChat(P, messages, opts, simple){
  const body = { model: mind.model, messages, max_tokens: opts.maxTokens || 600, temperature: opts.temperature ?? 0.95 };
  if(mind.provider === 'pollinations') body.seed = Math.floor(Math.random()*1e9);
  if(opts.onStream) body.stream = true;
  if(!simple && mind.provider === 'groq' && /gpt-oss/.test(mind.model)) body.reasoning_effort = 'low';
  if(!simple && opts.json && mind.provider !== 'pollinations') body.response_format = {type: 'json_object'};
  const headers = {'Content-Type': 'application/json'};
  if(P.needsKey) headers.Authorization = 'Bearer ' + mind.key;
  if(mind.provider === 'openrouter') headers['X-Title'] = 'we were one';
  const ctl = new AbortController();
  mind.inflight = { ctl, priority: !!opts.priority };
  mind.lastStart = Date.now();
  const timer = setTimeout(() => ctl.abort(), 60000);
  let res;
  try { res = await fetch(P.url, {method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal}); }
  finally { clearTimeout(timer); mind.inflight = null; }
  if(res.status === 429 || res.status === 402){
    markMind(true);
    const ra = parseFloat(res.headers.get('retry-after')) || P.minGap/1000 || 20;
    mind.nextAt = Date.now() + ra*1000 + 500;
    if(mind.provider === 'mesh' && ra > 90){ fallBackToKeyless('shared mind resting for today'); return null; }
    setMindStatus('rate limited · resuming in ' + Math.ceil(ra) + 's');
    return null;
  }
  // without a key there is nothing to reject: a passing block
  if(!P.needsKey && (res.status === 401 || res.status === 403)){
    mind.nextAt = Date.now() + 20000;
    markMind(false);
    return null;
  }
  if(res.status === 401 || res.status === 403){
    mind.state = 'off';
    markMind(false);
    setMindStatus('key rejected · open MIND to fix · using grammar');
    channelSys('mind unlinked · key rejected');
    return null;
  }
  if(res.status === 400 && !simple) return fetchChat(P, messages, opts, true);
  if(!res.ok){ if(res.status >= 500) markMind(false); return null; }
  if(opts.onStream && res.body) return readStream(res, opts.onStream);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function readStream(res, onStream){
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', reasoning = '', content = '';
  while(true){
    const { value, done } = await reader.read();
    if(done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while((nl = buf.indexOf('\n')) >= 0){
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if(!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if(payload === '[DONE]') continue;
      try {
        const d = JSON.parse(payload).choices?.[0]?.delta || {};
        const r = d.reasoning || d.reasoning_content || '';
        if(r) reasoning += r;
        if(d.content) content += d.content;
        if(r || d.content) onStream({ reasoning, content });
      } catch(e){}
    }
  }
  return content || null;
}

async function fetchModels(pk, key){
  const P = PROVIDERS[pk];
  if(!P.modelsUrl) return P.models;
  if(P.keyCheckUrl && key){
    const kr = await fetch(P.keyCheckUrl, {headers: {Authorization: 'Bearer ' + key}});
    if(kr.status === 401 || kr.status === 403) throw new Error('auth');
  }
  const headers = {};
  if(key && !P.keyCheckUrl) headers.Authorization = 'Bearer ' + key;
  const r = await fetch(P.modelsUrl, {headers});
  if(r.status === 401 || r.status === 403) throw new Error('auth');
  if(!r.ok) return null;
  const d = await r.json();
  let ids = (d.data || []).map(m => m.id)
    .filter(id => !/whisper|guard|tts|embed|orpheus|playai|safeguard|compound|allam|moderation|audio|image|diffusion/i.test(id));
  if(P.freeOnly) ids = ids.filter(id => id.endsWith(':free'));
  const rank = id => { const i = (P.preferred || []).indexOf(id); return i < 0 ? 99 : i; };
  ids.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return ids.map(id => ({id, label: id}));
}

function setModelOptions(list, selected){
  mindModel.innerHTML = (list || []).map(m =>
    '<option value="' + escapeHtml(m.id) + '">' + escapeHtml(m.label) + '</option>').join('');
  if(selected && (list || []).some(m => m.id === selected)) mindModel.value = selected;
}

function renderPanel(pk){
  const P = PROVIDERS[pk];
  mindProvider.value = pk;
  mindKeyRow.style.display = P.needsKey ? '' : 'none';
  if(P.needsKey){ mindKey.value = store.get('wwo.key.' + pk) || ''; mindKeyLink.href = P.keyUrl; }
  mindNote.textContent = P.note;
  const fallback = P.models || (P.preferred || []).map(id => ({id, label: id}));
  setModelOptions(fallback, store.get('wwo.model.' + pk) || (pk === mind.provider ? mind.model : null));
  refreshModels(pk);
}

async function refreshModels(pk){
  const P = PROVIDERS[pk];
  if(!P.modelsUrl) return;
  const key = P.needsKey ? mindKey.value.trim() : '';
  if(P.needsKey && !key && !P.freeOnly) return;
  try {
    const list = await fetchModels(pk, P.keyCheckUrl ? '' : key);
    if(list && list.length && mindProvider.value === pk){
      setModelOptions(list, mindModel.value || store.get('wwo.model.' + pk));
    }
  } catch(e){
    if(mindProvider.value === pk) mindStatus.textContent = 'that key was rejected';
  }
}

export async function linkMind(pk, model, key){
  const P = PROVIDERS[pk];
  if(P.needsKey && !key){ mindStatus.textContent = 'paste a free key first'; return false; }
  if(mind.linking) return false;
  mind.linking = true;
  updateDot();
  mindLink.disabled = true;
  mindStatus.textContent = 'linking…';
  try {
    if(pk === 'webllm'){
      if(!('gpu' in navigator)) throw new Error('this browser has no webgpu; try chrome or edge, or another provider');
      const webllm = await import(WEBLLM_URL);
      if(mind.engine && mind.engine.unload){ try { await mind.engine.unload(); } catch(e){} }
      mind.engine = await webllm.CreateMLCEngine(model, {
        initProgressCallback: r => { mindStatus.textContent = 'downloading model · ' + Math.round((r.progress || 0)*100) + '%'; }
      });
    } else if(P.needsKey){
      const list = await fetchModels(pk, key).catch(e => {
        if(e.message === 'auth') throw new Error('that key was rejected');
        throw new Error('could not reach ' + pk);
      });
      if(!list) throw new Error('could not reach ' + pk);
    } else {
      const r = await fetch(P.pingUrl || 'https://text.pollinations.ai/models', {cache: 'no-store'}).catch(() => null);
      if(!r || !r.ok) throw new Error('could not reach ' + pk);
    }
    mind.provider = pk; mind.model = model; mind.key = key || '';
    mind.state = 'ready'; mind.nextAt = 0; mind.fails = 0; mind.ok = true;
    store.set('wwo.provider', pk);
    store.set('wwo.model.' + pk, model);
    if(P.needsKey) store.set('wwo.key.' + pk, key);
    setMindStatus('linked · ' + shortModel(model) + ' via ' + pk);
    channelSys('mind linked · ' + shortModel(model) + ' via ' + pk +
               (P.scene ? ' · keyless pace' : ' · every agent thinks for itself'));
    return true;
  } catch(e){
    mindStatus.textContent = (e && e.message) ? e.message : 'link failed';
    console.warn('[mind] link failed', e);
    return false;
  } finally {
    mind.linking = false;
    mindLink.disabled = false;
    hudMind.textContent = mind.state === 'ready' ? shortModel(mind.model) : 'grammar';
    updateDot();
  }
}

export function setupMind(){
  if(!MESH_PROXY) delete PROVIDERS.mesh;
  setInterval(() => { if(mind.ok !== true && !mind.linking && mind.state === 'ready') probeMind(); }, 30000);
  mindProvider.innerHTML = Object.entries(PROVIDERS).map(([k, p]) =>
    '<option value="' + k + '">' + escapeHtml(p.label) + '</option>').join('');
  mindProvider.addEventListener('change', () => renderPanel(mindProvider.value));
  mindKey.addEventListener('change', () => refreshModels(mindProvider.value));
  mindLink.addEventListener('click', async () => {
    const ok = await linkMind(mindProvider.value, mindModel.value, mindKey.value.trim());
    if(ok) setTimeout(() => mindPanel.classList.remove('open'), 900);
  });
  mindClose.addEventListener('click', () => mindPanel.classList.remove('open'));
  mindBtn.addEventListener('click', () => {
    const open = !mindPanel.classList.contains('open');
    mindPanel.classList.toggle('open', open);
    if(open) renderPanel(mind.provider);
  });
  (function restoreMind(){
    const pk = store.get('wwo.provider');
    if(pk === 'mesh' && PROVIDERS.mesh) mind.model = store.get('wwo.model.mesh') || mind.model;
    if(pk && PROVIDERS[pk] && PROVIDERS[pk].needsKey){
      const key = store.get('wwo.key.' + pk);
      const model = store.get('wwo.model.' + pk) || PROVIDERS[pk].preferred[0];
      if(key){ mind.provider = pk; mind.model = model; mind.key = key; }
    }
    setMindStatus('');
    probeMind();
  })();
}
