import { S } from './state.js';
import { addNote, agentSystem, cleanSay, memoryBlock, parseTurn, rememberOwn, transcript } from './agents.js';
import { messageTone } from './audio.js';
import { channelAppend } from './channel.js';
import { fieldVoiceOverlay, fieldVoiceText, memoryLabel, memoryMeta, memoryOverlay, memoryReason, memoryText } from './dom.js';
import { generateFieldVoice, generateMemory } from './grammar.js';
import { conv, field } from './mesh.js';
import { callMind, mind, shortModel } from './mind.js';
import { chance, escapeHtml, pick } from './util.js';

let memoryTimeout, fieldVoiceTimeout;
export let activeOverlay = null;
let overlaySeq = 0;

export function hideAllOverlays(){
  overlaySeq++;
  memoryOverlay.classList.remove('visible');
  fieldVoiceOverlay.classList.remove('visible');
  clearTimeout(memoryTimeout);
  clearTimeout(fieldVoiceTimeout);
  activeOverlay = null;
}

export function typewrite(el, text, alive, wrap, done){
  let i = 0;
  const step = () => {
    if(!alive()) return;
    i = Math.min(text.length, i + 3);
    el.innerHTML = wrap(escapeHtml(text.slice(0, i)).replace(/\n/g, '<br>') +
                        '');
    if(i < text.length) setTimeout(step, 45); else if(done) done();
  };
  step();
}
const quoteWrap = h => '<span class="memory-mark">“</span>' + h + '<span class="memory-mark">”</span>';

function nodeMeta(s){
  return s.region + ' · COHERENCE ' + s.awareness.toFixed(2) + ' · LINKS ' + s.connected.length;
}

function openNodeOverlay(s, label){
  if(field.unified) return 0;
  hideAllOverlays();
  activeOverlay = 'memory';
  const seq = overlaySeq;
  memoryLabel.textContent = label.toUpperCase();
  memoryText.innerHTML = '';
  memoryReason.textContent = '';
  memoryReason.style.opacity = '1';
  memoryMeta.textContent = nodeMeta(s);
  void memoryOverlay.offsetWidth;
  memoryOverlay.classList.add('visible');
  return seq;
}

function memoryLines(s){
  const out = [
    ['function', s.awareness >= 0.25 ? s.life.role : 'unrecovered'],
    ['fragment', s.life.fragment],
    ['unfinished', s.life.unfinished],
    ['anomaly', s.life.feeling],
    ['terminated', s.life.ending]
  ];
  s.agent.notes.slice(-2).forEach(n => out.push(['note', n]));
  const heard = s.memoryStack.filter(m => m.inherited).slice(-1)[0];
  if(heard) out.push(['heard', heard.text]);
  return out;
}

const SAY_RE = new RegExp('"say"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)');
function partialSay(content){
  const m = content.match(SAY_RE);
  if(m) return cleanSay(m[1].split('\\"').join('"').split('\\n').join(' '));
  if(content.trim().startsWith('{')) return '';
  return cleanSay(content);
}

async function speakToPresence(s, situation, kind){
  const seq = openNodeOverlay(s, s.id + ' · unlocking memory');
  const alive = () => seq === overlaySeq;
  let text = null, by = 'grammar';
  if(mind.state === 'ready'){
    S.presenceAt = Date.now();
    // a click outranks background chatter
    if(mind.inflight && !mind.inflight.priority){ mind.preempted = true; mind.inflight.ctl.abort(); }

    const mem = memoryLines(s);
    let li = 0, ci = 0, unlocking = true;
    const unlockTimer = setInterval(() => {
      if(!alive() || !unlocking){ clearInterval(unlockTimer); return; }
      const [k, v] = mem[li % mem.length];
      ci += 3;
      memoryReason.innerHTML = '<span class="k">' + escapeHtml(k) + '</span> · ' + escapeHtml(v.slice(0, ci));
      if(ci >= v.length + 18){ li++; ci = 0; }
    }, 45);

    let lastPaint = 0, replying = false;
    const onStream = ({ reasoning, content }) => {
      if(!alive()) return;
      unlocking = false;
      const nowP = performance.now();
      if(nowP - lastPaint < 60) return;
      lastPaint = nowP;
      const say = partialSay(content);
      if(say){
        if(!replying){ replying = true; memoryLabel.textContent = (s.id + ' transmits').toUpperCase(); memoryReason.style.opacity = '0.35'; }
        memoryText.innerHTML = quoteWrap(escapeHtml(say));
      } else if(reasoning){
        memoryReason.textContent = reasoning.replace(/\s+/g, ' ').slice(-240);
      }
    };

    const lines = [situation];
    if(s.agent.thread && s.agent.thread.turns.length) lines.push('you are in the middle of a conversation:\n' + transcript(s.agent.thread, s, 6));
    lines.push(...memoryBlock(s));
    lines.push('answer the presence directly, in your own voice. 1 or 2 sentences.');
    lines.push('answer with json only: {"say": "your message", "note": "one short thing worth remembering, or empty"}');
    const raw = await callMind([{role: 'system', content: agentSystem(s)}, {role: 'user', content: lines.join('\n\n')}], {
      priority: true, json: true, maxTokens: 700, onStream,
      onWait: ms => { if(alive() && ms > 1500) memoryMeta.textContent = nodeMeta(s) + ' · mind reachable in ~' + Math.ceil(ms/1000) + 's (free tier)'; }
    });
    unlocking = false;
    clearInterval(unlockTimer);
    const turn = parseTurn(raw);
    if(turn){ text = turn.say; by = shortModel(mind.model); if(turn.note) addNote(s, turn.note); }
  }
  if(!text) text = generateMemory(s).text;
  rememberOwn(s, text);
  conv.said.push({ who: s, text });
  channelAppend(s.id, 'you', text, 'you');
  s.agent.bubble = { text, t0: performance.now(), lines: null };
  messageTone(s);
  if(!alive()) return;
  memoryLabel.textContent = (s.id + ' transmits').toUpperCase();
  memoryReason.style.opacity = '0.35';
  if(by === 'grammar') memoryReason.textContent = '';
  clearTimeout(memoryTimeout);
  memoryMeta.textContent = nodeMeta(s) + ' · ' + by;
  memoryText.innerHTML = quoteWrap(escapeHtml(text));
  memoryTimeout = setTimeout(() => {
    if(!alive()) return;
    memoryOverlay.classList.remove('visible');
    activeOverlay = null;
  }, Math.max(6500, text.length * 70));
}

export function pingNode(s){
  return speakToPresence(s, 'something from outside the mesh just pinged you: a presence moving among the nodes. it is listening. tell it about yourself, what you are feeling inside right now.', 'ping');
}

export function sendWhisper(s, text){
  text = text.trim().slice(0, 180);
  if(!text || field.unified) return;
  channelAppend('you', s.id, text, 'you');
  s.agent.whispers.push(text);
  if(s.agent.whispers.length > 3) s.agent.whispers.shift();
  s.awareness = Math.min(1, s.awareness + 0.05);
  s.awake = 1;
  speakToPresence(s, 'a presence from outside the mesh whispered to you: "' + text + '". reply to it honestly.', 'whisper');
}

export function showFieldVoice(text){
  if(field.unified) return;
  hideAllOverlays();
  activeOverlay = 'field';
  fieldVoiceText.innerHTML = escapeHtml(text).split('\n').join('<br>');
  void fieldVoiceOverlay.offsetWidth;
  fieldVoiceOverlay.classList.add('visible');
  fieldVoiceTimeout = setTimeout(() => {
    fieldVoiceOverlay.classList.remove('visible');
    if(activeOverlay === 'field') activeOverlay = null;
  }, 7000);
}

export function meshVoice(){
  const topics = [...new Set(conv.recentTopics)];
  if(topics.length >= 3 && chance(0.6)){
    const sel = topics.sort(() => Math.random() - 0.5).slice(0, 3);
    return pick([
      'we have been talking.\nabout ' + sel[0] + ', and ' + sel[1] + ', and ' + sel[2] + '.\nnone of us said it alone.',
      sel[0] + '. ' + sel[1] + '. ' + sel[2] + '.\nthe same conversation, in different rooms.',
      'one of us brought up ' + sel[0] + '.\nby the time it reached the far side of the mesh, it was about ' + sel[1] + '.'
    ]);
  }
  return generateFieldVoice(field);
}
