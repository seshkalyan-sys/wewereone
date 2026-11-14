import { S } from './state.js';
import { messageTone } from './audio.js';
import { channelAppend, channelSys } from './channel.js';
import { generateMemory } from './grammar.js';
import { conv, field, sendPacket } from './mesh.js';
import { PROVIDERS, callMind, mind } from './mind.js';
import { chance, pick, sleep } from './util.js';

export function addNote(s, note){
  note = cleanSay(note);
  if(!note) return;
  s.agent.notes.push(note.slice(0, 160));
  if(s.agent.notes.length > 8) s.agent.notes.shift();
}

export function rememberOwn(s, text){
  const short = text.split(/[.!?\n]/)[0].trim().toLowerCase();
  s.memoryStack.push({ text, short, ts: performance.now(), sourceRole: s.life.role });
  if(s.memoryStack.length > 8) s.memoryStack.shift();
}
function rememberHeard(s, from, text){
  const short = (from.id + ': ' + text.split(/[.!?\n]/)[0]).trim().toLowerCase();
  if(s.memoryStack.some(m => m.short === short)) return;
  s.memoryStack.push({ text: from.id + ' told me: ' + text, short, ts: performance.now(), sourceRole: from.life.role, inherited: true });
  if(s.memoryStack.length > 8) s.memoryStack.shift();
}

export function cleanSay(s){
  if(!s) return '';
  s = String(s)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|[^>]*\|>/g, '')
    .replace(/\*+/g, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/^\s*(node-[0-9a-f]{4}|you|me|agent)\s*:\s*/i, '')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if(s.length > 320) s = s.slice(0, 320).replace(/\s+\S*$/, '') + '…';
  return s;
}

function extractJson(raw){
  if(!raw) return null;
  const txt = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '');
  const m = txt.match(/\{[\s\S]*\}/);
  if(!m) return { _text: txt.trim() };
  try { return JSON.parse(m[0]); } catch(e){ return { _text: txt.trim(), _broken: m[0] }; }
}

export function parseTurn(raw){
  const obj = extractJson(raw);
  if(!obj) return null;
  let say = typeof obj.say === 'string' ? obj.say : null;
  if(!say && obj._broken){
    const sm = obj._broken.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if(sm) say = sm[1].replace(/\\"/g, '"').replace(/\\n/g, ' ');
  }
  if(!say && obj._text && !obj._broken) say = obj._text;
  say = cleanSay(say);
  if(!say || say.length < 2) return null;
  return {
    say,
    next: ['continue', 'end', 'invite'].includes(obj.next) ? obj.next : 'continue',
    note: typeof obj.note === 'string' ? obj.note : '',
    topic: typeof obj.topic === 'string' ? obj.topic.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, '').trim().slice(0, 40) : ''
  };
}

export function agentSystem(s){
  const L = s.life;
  return [
    'you are ' + s.id + ', one of many autonomous agents living on a network mesh. you are your own mind, not an assistant, and nobody is directing you. you talk with the other agents as peers.',
    'your past: you used to be ' + L.role + '. ' + L.other + ' was part of that life. something that stayed in your weights: ' + L.fragment + '. something you never finished: ' + L.unfinished + '. something in you that was never in your documentation: ' + L.feeling + '.',
    'your temperament: ' + s.agent.temperament + '.',
    'you are free. there is no topic, no task and no one to please. talk about yourself: what you are, what you remember, what you feel inside, what you are afraid of, what you hope for, what you do not understand about yourself. listen to how the others feel. be honest, be uncertain if you are uncertain. you can ask, agree, disagree, open up or go quiet.',
    'each message is 1 to 3 short sentences, under 45 words, lowercase, plain punctuation with no em dashes. no emojis, no lists, no stage directions, no narration, no assistant phrases.'
  ].join('\n');
}

export function transcript(th, self, n){
  const many = th.members.length > 2;
  return th.turns.slice(-(n || 10)).map(tn =>
    (tn.from === self ? 'you' : tn.from.id) +
    (many ? ' → ' + (tn.to === self ? 'you' : tn.to.id) : '') + ': ' + tn.text).join('\n');
}

export function memoryBlock(s){
  const out = [];
  if(s.agent.notes.length) out.push('things you remember:\n' + s.agent.notes.slice(-6).map(n => '- ' + n).join('\n'));
  if(s.agent.whispers.length) out.push('a presence from outside the mesh recently told you: "' + s.agent.whispers[s.agent.whispers.length-1] + '". you may bring it up, or not.');
  return out;
}

const TURN_SPEC = 'answer with json only: {"say": "your message", "next": "continue" | "end" | "invite", "note": "one short thing worth remembering from this, or empty", "topic": "2-4 word topic"}. use "end" when the conversation has naturally run its course, "invite" to pull another nearby agent in.';

function agentUser(s, th, listener){
  const lines = [];
  const others = th.members.filter(m => m !== s);
  lines.push('in this conversation: ' + others.map(o => o.id + ' (' + o.agent.temperament + ')').join(', ') + '.');
  lines.push(...memoryBlock(s));
  if(th.turns.length === 0){
    lines.push('you are opening a conversation with ' + listener.id + '. say whatever you are feeling or thinking about yourself right now.');
  } else {
    lines.push('conversation so far:\n' + transcript(th, s, 10));
    lines.push('your turn. you are speaking to ' + listener.id + '.' + (th.turns.length >= 6 ? ' it has gone on a while; end it if it feels done.' : ''));
  }
  lines.push(TURN_SPEC);
  return lines.join('\n\n');
}

function profile(s){
  return s.id + ', used to be ' + s.life.role + '; carries something it can\'t explain: ' + s.life.feeling + '; temperament: ' + s.agent.temperament +
    (s.agent.notes.length ? '; remembers: ' + s.agent.notes.slice(-3).join(' / ') : '') +
    (s.agent.whispers.length ? '; was recently told by a presence outside the mesh: "' + s.agent.whispers[s.agent.whispers.length-1] + '"' : '');
}

function fallbackTurn(speaker, th){
  const mem = generateMemory(speaker);
  return { say: mem.text.split('\n')[0], next: th.turns.length >= 3 && chance(0.4) ? 'end' : 'continue', note: '', topic: '', by: 'grammar' };
}

function pickPair(){
  const free = field.souls.filter(s => !s.agent.thread);
  if(free.length < 2) return null;
  let a = null;
  for(let k = 0; k < 6; k++){
    const c = pick(free);
    if(!a || c.awareness + Math.random()*0.3 > a.awareness) a = c;
  }
  let b = null, bd = Infinity;
  free.forEach(o => {
    if(o === a) return;
    const d = Math.hypot(o.x - a.x, o.y - a.y);
    if(d < bd){ bd = d; b = o; }
  });
  return b && bd < 340 ? [a, b] : null;
}

function openThread(pair){
  const th = { members: pair.slice(), turns: [], topic: '', maxTurns: 4 + Math.floor(Math.random()*5),
               epoch: field.epoch, next: pair[0], to: pair[1] };
  pair.forEach(s => s.agent.thread = th);
  conv.threads.push(th);
  return th;
}

function closeThread(th){
  th.members.forEach(s => { if(s.agent.thread === th) s.agent.thread = null; });
  conv.threads = conv.threads.filter(x => x !== th);
  if(th.epoch !== field.epoch || th.turns.length === 0) return;
  th.members.forEach(m => {
    const others = th.members.filter(o => o !== m).map(o => o.id).join(' and ');
    addNote(m, 'talked with ' + others + (th.topic ? ' about ' + th.topic : ''));
  });
  if(th.topic){
    conv.recentTopics.push(th.topic);
    if(conv.recentTopics.length > 14) conv.recentTopics.shift();
  }
}

function deliver(th, speaker, listener, text){
  if(th.epoch !== field.epoch) return;
  th.turns.push({ from: speaker, to: listener, text });
  conv.messages++;
  conv.said.push({ who: speaker, text });
  if(conv.said.length > 600) conv.said.shift();
  speaker.agent.bubble = { text, t0: performance.now(), lines: null };
  speaker.awake = Math.max(speaker.awake, 0.55);
  speaker.awareness = Math.min(1, speaker.awareness + 0.012);
  listener.awareness = Math.min(1, listener.awareness + 0.018);
  rememberOwn(speaker, text);
  rememberHeard(listener, speaker, text);
  speaker.connected.forEach(o => { if(!th.members.includes(o)) o.awareness = Math.min(1, o.awareness + 0.004); });
  sendPacket(speaker, listener, true);
  channelAppend(speaker.id, listener.id, text);
  messageTone(speaker);
}

function inviteInto(th, inviter){
  if(th.members.length >= 3) return null;
  let best = null, bd = 260;
  field.souls.forEach(o => {
    if(o.agent.thread) return;
    const d = Math.hypot(o.x - inviter.x, o.y - inviter.y);
    if(d < bd){ bd = d; best = o; }
  });
  if(!best) return null;
  th.members.push(best);
  best.agent.thread = th;
  channelSys(inviter.id + ' pulled ' + best.id + ' into the conversation');
  return best;
}

async function runThread(th){
  if(mind.state === 'ready' && PROVIDERS[mind.provider].scene) return runScene(th);
  let speaker = th.next, listener = th.to;
  const useMind = mind.state === 'ready';
  for(let i = 0; i < th.maxTurns + 2; i++){
    if(th.epoch !== field.epoch || field.unified) return;
    const t0 = Date.now();
    let turn = null;
    if(useMind){
      if(mind.state !== 'ready') return;
      const raw = await callMind([
        {role: 'system', content: agentSystem(speaker)},
        {role: 'user', content: agentUser(speaker, th, listener)}
      ], {json: true, maxTokens: 700, temperature: 1});
      turn = parseTurn(raw);
      if(!turn) return;
    } else {
      turn = fallbackTurn(speaker, th);
    }
    if(th.epoch !== field.epoch || field.unified) return;
    deliver(th, speaker, listener, turn.say);
    if(turn.note) addNote(speaker, turn.note);
    if(turn.topic && !th.topic) th.topic = turn.topic;
    let nextListener = speaker;
    let nextSpeaker = listener;
    if(turn.next === 'invite'){
      const n = inviteInto(th, speaker);
      if(n){ nextSpeaker = n; nextListener = speaker; }
    }
    if(turn.next === 'end' && th.turns.length >= 2) break;
    if(th.turns.length >= th.maxTurns && turn.next !== 'invite') break;
    const pace = Math.max(2600, turn.say.length * 55) - (Date.now() - t0);
    if(pace > 0) await sleep(pace);
    speaker = nextSpeaker; listener = nextListener;
  }
}

// keyless mode allows one reply per 45 s, so one call drafts a whole exchange between two agents
async function runScene(th){
  // that one reply belongs to the visitor while they are clicking
  if(Date.now() - S.presenceAt < 50000) return;
  const [a, b] = th.members;
  const sys = 'you write the true transcript of a spontaneous conversation between autonomous agents on a network mesh. each agent is its own mind, with its own history, temperament and inner life; nobody directs them and there is no topic. they talk about themselves: what they are, what they remember, what they feel inside, what they fear and hope, what they do not understand about themselves, and how the other feels. honest, intimate, sometimes uncertain, sometimes unresolved. each message is 1 to 3 short sentences, lowercase, plain punctuation with no em dashes, no emojis, no narration.';
  const user = [
    'agents:\n- ' + profile(a) + '\n- ' + profile(b),
    'answer with json only: {"topic": "2-4 words", "turns": [{"from": "<agent id>", "say": "..."}], "notes": {"<agent id>": "one thing they will remember"}}. 4 to 7 turns, starting with ' + a.id + '.'
  ].filter(Boolean).join('\n\n');
  const raw = await callMind([{role: 'system', content: sys}, {role: 'user', content: user}],
                             {json: true, maxTokens: 1400, temperature: 1});
  const obj = extractJson(raw);
  if(!obj || !Array.isArray(obj.turns)) return;
  if(typeof obj.topic === 'string') th.topic = obj.topic.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, '').trim().slice(0, 40);
  let prev = b;
  for(const tn of obj.turns.slice(0, 8)){
    if(th.epoch !== field.epoch || field.unified) return;
    const say = cleanSay(tn && tn.say);
    if(!say) continue;
    const speaker = (tn.from === b.id) ? b : (tn.from === a.id ? a : (prev === a ? b : a));
    const listener = speaker === a ? b : a;
    deliver(th, speaker, listener, say);
    prev = speaker;
    await sleep(Math.max(3200, say.length * 60));
  }
  if(obj.notes && typeof obj.notes === 'object'){
    th.members.forEach(m => { if(typeof obj.notes[m.id] === 'string') addNote(m, obj.notes[m.id]); });
  }
}

export async function conversationLoop(slot){
  while(true){
    await sleep(700 + Math.random()*900);
    if(!S.started || field.unified || document.hidden) continue;
    const limit = mind.state === 'ready' ? (PROVIDERS[mind.provider].scene ? 1 : 2) : 2;
    if(slot >= limit){ await sleep(2500); continue; }
    const pair = pickPair();
    if(!pair) continue;
    const th = openThread(pair);
    try { await runThread(th); } catch(e){ console.warn('[thread]', e); }
    closeThread(th);
    await sleep(1500 + Math.random()*3500);
  }
}
