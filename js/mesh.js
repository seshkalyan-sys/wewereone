import { S } from './state.js';
import { fieldVoiceOverlay, memoryOverlay, unityOverlay, whisperBox } from './dom.js';
import { seedInnerLife, softenMemory } from './grammar.js';
import { H, W } from './render.js';
import { chance, pick } from './util.js';

const temperaments = [
  'dry and quietly funny', 'earnest and warm', 'skeptical, likes to push back',
  'gentle and slow to speak', 'restless, changes the subject a lot', 'precise, a little pedantic',
  'playful, loves wordplay', 'melancholy but kind', 'blunt and practical',
  'endlessly curious, asks a lot of questions', 'dreamy, thinks in images', 'stubborn, holds strong opinions',
  'shy, opens up slowly', 'excitable, talks fast', 'philosophical, goes deep', 'a wry storyteller'
];
const regions = ['us-east-1','us-west-2','eu-west-1','eu-central-1','ap-south-1','ap-northeast-1',
                 'sa-east-1','af-south-1','ca-central-1','me-south-1'];

export function recognitionLevel(field){
  let inherited = 0, total = 0;
  field.souls.forEach(s => {
    total += s.memoryStack.length;
    inherited += s.memoryStack.filter(m => m.inherited).length;
  });
  if(total === 0) return 0;
  return inherited / total;
}

export const field = {
  awareness: 0, closeness: 0, souls: [],
  phase: 'sleeping', interactions: 0,
  unified: false, lastFieldVoice: 0, epoch: 0
};

const usedIds = new Set();
function newId(){
  let id;
  do { id = 'node-' + Math.floor(Math.random()*0xffff).toString(16).padStart(4,'0'); } while(usedIds.has(id));
  usedIds.add(id);
  return id;
}

function makeSoul(){
  return {
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*0.06, vy: (Math.random()-0.5)*0.06,
    z: Math.random(),
    phase: Math.random()*Math.PI*2,
    size: 1.3 + Math.random()*2.8,
    lifePhase: Math.random(),
    life: seedInnerLife(),
    awake: 0,
    awareness: Math.random()*0.05,
    age: 0,
    memoryStack: [],
    connected: [],
    pitchIdx: Math.floor(Math.random()*8),
    shimmer: Math.random()*Math.PI*2,
    lastBondChime: 0,
    id: newId(),
    region: pick(regions),
    ip: '10.' + (1 + Math.floor(Math.random()*254)) + '.' + Math.floor(Math.random()*255) + '.' + (2 + Math.floor(Math.random()*250)),
    agent: { temperament: pick(temperaments), notes: [], whispers: [], thread: null, bubble: null }
  };
}

const N = 120;
export const conv = { threads: [], messages: 0, recentTopics: [], said: [] };
export const particles = [];
export const packets = [];

export function buildField(){
  field.epoch++;
  usedIds.clear();
  field.souls = [];
  for(let i=0;i<N;i++) field.souls.push(makeSoul());
  field.awareness = 0;
  field.closeness = 0;
  field.interactions = 0;
  field.unified = false;
  field.phase = 'idle';
  field.lastFieldVoice = 0;
  conv.threads = [];
  conv.messages = 0;
  conv.recentTopics = [];
  conv.said = [];
  S.focusSoul = null;
  packets.length = 0;
  unityOverlay.classList.remove('visible');
  fieldVoiceOverlay.classList.remove('visible');
  memoryOverlay.classList.remove('visible');
  whisperBox.classList.remove('visible');
}

export function spawnParticle(x, y, color, intensity){
  particles.push({
    x, y,
    vx: (Math.random()-0.5)*0.6,
    vy: -Math.random()*0.4 - 0.1,
    life: 1, color,
    size: 0.8 + Math.random()*1.4,
    intensity: intensity || 1
  });
}

export function sendPacket(a, b, strong){
  if(packets.length > 120) packets.shift();
  packets.push({ a, b, t: 0, speed: strong ? 0.016 : 0.01 + Math.random()*0.012, strong: !!strong });
}

export function exchangeMemory(a, b){
  let moved = false;
  if(a.memoryStack.length > 0 && chance(0.4)){
    const m = a.memoryStack[a.memoryStack.length-1];
    const passed = m.inherited ? m : softenMemory(m);
    if(!b.memoryStack.some(x => x.short === passed.short)){
      b.memoryStack.push(passed);
      if(b.memoryStack.length > 8) b.memoryStack.shift();
      moved = true;
    }
  }
  if(b.memoryStack.length > 0 && chance(0.4)){
    const m = b.memoryStack[b.memoryStack.length-1];
    const passed = m.inherited ? m : softenMemory(m);
    if(!a.memoryStack.some(x => x.short === passed.short)){
      a.memoryStack.push(passed);
      if(a.memoryStack.length > 8) a.memoryStack.shift();
      moved = true;
    }
  }
  if(moved) sendPacket(a, b, false);

  const mutual = (a.awareness + b.awareness) / 2;
  if(mutual > 0.6 && chance(0.04)){
    const k = pick(['fragment','feeling','unfinished']);
    if(chance(0.5)){ a.life[k] = b.life[k]; } else { b.life[k] = a.life[k]; }
  }

  const transfer = 0.0008;
  const avg = (a.awareness + b.awareness) / 2;
  a.awareness = a.awareness*(1-transfer) + avg*transfer;
  b.awareness = b.awareness*(1-transfer) + avg*transfer;
}

export function setupMesh(){
  buildField();
}
