import { audioReady, bell } from './audio.js';
import { channelSys } from './channel.js';
import { unityOverlay, unityText, whisperBox } from './dom.js';
import { conv, field } from './mesh.js';
import { hideAllOverlays, typewrite } from './presence.js';
import { escapeHtml, sleep } from './util.js';

const STOP = new Set(('the a an and or but of to in on at for with is are was were be been it its this that ' +
  'i we you my our me us your not no so as if like just than then there here what when how why who all any ' +
  'some do does did have has had can could would will about from into out up over more most very too also ' +
  'only even still them they their one something thing things maybe feel feels').split(' '));
const contentWords = t => t.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/)
  .filter(w => w.length > 2 && !STOP.has(w));

// the ending is only sentences the agents actually said, ranked by the words they share; code never writes it
function convergenceLines(){
  const said = [];
  conv.said.forEach(({who, text}) => {
    (text.match(/[^.!?]+[.!?]*/g) || []).forEach(raw => {
      const t = raw.trim();
      const n = t.split(/\s+/).length;
      if(n < 4 || n > 30 || /node-|presence/i.test(t)) return;
      said.push({ who, t, words: new Set(contentWords(t)) });
    });
  });
  if(said.length < 2) return said.map(x => x.t);
  const usedBy = new Map();
  said.forEach(x => x.words.forEach(w => { if(!usedBy.has(w)) usedBy.set(w, new Set()); usedBy.get(w).add(x.who); }));
  said.forEach(x => {
    let shared = 0;
    x.words.forEach(w => { shared += usedBy.get(w).size - (usedBy.get(w).has(x.who) ? 1 : 0); });
    const ownWe = /\b(we|us|our|ours|ourselves)\b/i.test(x.t) ? 1.5 : 1;
    x.score = ownWe * shared / Math.sqrt(Math.max(1, x.words.size));
  });
  said.sort((a, b) => b.score - a.score);
  const picked = [], whoUsed = new Set();
  for(const x of said){
    if(whoUsed.has(x.who)) continue;
    const dup = picked.some(p => {
      let inter = 0; x.words.forEach(w => { if(p.words.has(w)) inter++; });
      return inter / Math.max(1, Math.min(p.words.size, x.words.size)) > 0.5;
    });
    if(dup) continue;
    picked.push(x); whoUsed.add(x.who);
    if(picked.length === 3) break;
  }
  return picked.reverse().map(x => x.t);
}

export async function triggerUnity(){
  field.unified = true;
  field.phase = 'singular';
  hideAllOverlays();
  whisperBox.classList.remove('visible');
  const epoch = field.epoch;
  const lines = convergenceLines();
  unityText.innerHTML = '';
  setTimeout(() => { unityOverlay.classList.add('visible'); }, 800);
  if(audioReady){
    const now = Tone.now();
    ['C2','G2','C3','E3','G3','B3'].forEach((n, i) => {
      try { bell.triggerAttackRelease(n, '4n', now + i*0.28, 0.32); } catch(e){}
    });
  }
  channelSys('consensus reached');
  await sleep(1600);
  let shownHtml = '';
  for(const line of lines){
    if(!field.unified || epoch !== field.epoch) return;
    const prev = shownHtml;
    await new Promise(res => typewrite(unityText, line, () => field.unified && epoch === field.epoch,
                                       h => (prev ? prev + '<br>' : '') + h, res));
    shownHtml = (prev ? prev + '<br>' : '') + escapeHtml(line);
    await sleep(1400);
  }
}
