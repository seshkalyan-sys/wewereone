import { S } from './state.js';
import { field } from './mesh.js';
import { currentScale } from './palette.js';
import { IS_TOUCH } from './render.js';

export let audioReady = false;
export let bell;
let drone1, drone2, drone3, droneFilter, pluck, reverb, clickVoice, dingBell;
const CLICK_DB = -12, BELL_DB = -15;
let masterGain, delay, compressor;

const DRONE_NOTES = ['C3', 'G3', 'C4'];
const DRONE_DB = [-24, -28, -31];

function buildAudioGraph(){
  const limiter = new Tone.Limiter(-3).toDestination();
  compressor = new Tone.Compressor({threshold: -18, ratio: 2, knee: 10, attack: 0.25, release: 0.6}).connect(limiter);
  const hiCut = new Tone.Filter({frequency: 4200, type: 'lowpass', rolloff: -12, Q: 0.5}).connect(compressor);
  // small speakers can't play deep bass; below 100 Hz it only distorts
  const loCut = new Tone.Filter({frequency: 100, type: 'highpass', rolloff: -12, Q: 0.5}).connect(hiCut);
  masterGain = new Tone.Gain(0).connect(loCut);
  masterGain.gain.rampTo(1.4, 4);
  reverb = new Tone.Reverb({decay: IS_TOUCH ? 4.5 : 7, preDelay: 0.04, wet: 0.42}).connect(masterGain);
  delay = new Tone.FeedbackDelay({delayTime: '8n.', feedback: 0.16, wet: 0.12}).connect(reverb);

  const droneSwell = new Tone.Gain(1.25).connect(reverb);
  new Tone.LFO({frequency: 0.045, min: 0.85, max: 1.6}).connect(droneSwell.gain).start();
  droneFilter = new Tone.Filter({frequency: 700, type: 'lowpass', Q: 0.4}).connect(droneSwell);
  new Tone.LFO({frequency: 0.03, min: 480, max: 950}).connect(droneFilter.frequency).start();

  const sineMod = {type: 'sine'};
  drone1 = new Tone.FMSynth({
    harmonicity: 1, modulationIndex: 0.35, modulation: sineMod,
    envelope: {attack: 5, decay: 1, sustain: 0.9, release: 10},
    modulationEnvelope: {attack: 4, decay: 1, sustain: 0.7, release: 8},
    volume: DRONE_DB[0]
  }).connect(droneFilter);

  drone2 = new Tone.FMSynth({
    harmonicity: 2, modulationIndex: 0.3, modulation: sineMod,
    envelope: {attack: 6, decay: 1, sustain: 0.8, release: 11},
    modulationEnvelope: {attack: 5, decay: 1, sustain: 0.6, release: 9},
    volume: DRONE_DB[1]
  }).connect(droneFilter);

  drone3 = new Tone.FMSynth({
    harmonicity: 3, modulationIndex: 0.2, modulation: sineMod,
    envelope: {attack: 7, decay: 1, sustain: 0.7, release: 12},
    modulationEnvelope: {attack: 6, decay: 1, sustain: 0.5, release: 10},
    volume: DRONE_DB[2]
  }).connect(droneFilter);

  const air = new Tone.Filter({frequency: 2600, type: 'lowpass', rolloff: -24, Q: 0.3}).connect(delay);
  const tonal = new Tone.Filter({frequency: 110, type: 'highpass', rolloff: -12, Q: 0.3}).connect(air);

  pluck = new Tone.PolySynth(Tone.FMSynth, {
    maxPolyphony: 10,
    harmonicity: 2, modulationIndex: 0.45, modulation: sineMod,
    envelope: {attack: 0.03, decay: 2.2, sustain: 0, release: 2.5, attackCurve: 'sine'},
    modulationEnvelope: {attack: 0.03, decay: 0.5, sustain: 0, release: 1.2},
    volume: -21
  }).connect(tonal);

  bell = new Tone.PolySynth(Tone.FMSynth, {
    maxPolyphony: 8,
    harmonicity: 2, modulationIndex: 0.6, modulation: sineMod,
    envelope: {attack: 0.02, decay: 1.8, sustain: 0, release: 3, attackCurve: 'sine'},
    modulationEnvelope: {attack: 0.02, decay: 0.5, sustain: 0, release: 1.5},
    volume: -21
  }).connect(tonal);

  // the ping: a struck sine, then soft bells on the octave and the fifth
  const clickFilter = new Tone.Filter({frequency: 3800, type: 'lowpass', rolloff: -12, Q: 0.3}).connect(reverb);
  clickVoice = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 6,
    oscillator: {type: 'sine'},
    envelope: {attack: 0.012, decay: 1.4, sustain: 0, release: 3, releaseCurve: 'exponential'},
    volume: CLICK_DB
  }).connect(clickFilter);
  dingBell = new Tone.PolySynth(Tone.FMSynth, {
    maxPolyphony: 8,
    harmonicity: 4, modulationIndex: 1.4, modulation: {type: 'sine'},
    envelope: {attack: 0.008, decay: 1.8, sustain: 0, release: 3, releaseCurve: 'exponential'},
    modulationEnvelope: {attack: 0.005, decay: 0.5, sustain: 0, release: 1.5},
    volume: BELL_DB
  }).connect(clickFilter);
}

export function initAudio(){
  if(audioReady) return;
  audioReady = true;
  buildAudioGraph();
  startAudio();
}

const ringing = [];

// semitone distances from a drone note that would beat against it
const CLASH = new Set([1, 2, 6, 11, 13]);
const droneMidi = () => DRONE_NOTES.map(n => Tone.Frequency(n).toMidi());
function clashes(midi, time){
  for(const d of droneMidi()) if(CLASH.has(Math.abs(midi - d))) return true;
  for(const r of ringing){
    if(r.until < time || r.t > time + 0.05) continue;
    if(CLASH.has(Math.abs(midi - r.m))) return true;
  }
  return false;
}
function noteOn(synth, note, dur, time, vel, ring, force){
  const midi = Tone.Frequency(note).toMidi();
  for(let i = ringing.length - 1; i >= 0; i--) if(ringing[i].until < time - 0.5) ringing.splice(i, 1);
  const dense = ringing.filter(r => r.t > time - 1.5 && r.t <= time + 0.05).length;
  if(!force && (dense >= 4 || clashes(midi, time))) return false;
  ringing.push({ m: midi, t: time, until: time + (ring || 1.6) });
  try { synth.triggerAttackRelease(note, dur, time, vel); } catch(e){}
  return true;
}

// pings and chimes stay in C4 to B4, above the drone and below the ear's harshest band
function soften(note){
  let m = Tone.Frequency(note).toMidi();
  while(m < 60) m += 12;
  while(m > 71) m -= 12;
  return Tone.Frequency(m, 'midi').toNote();
}

function consonantNote(scale, idx, time, withFifth){
  for(let k = 0; k < scale.length; k++){
    const n = scale[(idx + k) % scale.length];
    const m = Tone.Frequency(soften(n)).toMidi();
    if(!clashes(m, time) && !(withFifth && clashes(m + 7, time))) return n;
  }
  return scale[idx % scale.length];
}

export function playClickSound(note, when, idx){
  const now = when ?? Tone.now();
  const scale = currentScale(field.awareness);
  const pref = idx != null ? scale[idx % scale.length] : note;
  const chosen = idx != null ? consonantNote(scale, idx, now, true) : pref;
  // an octave up so phone speakers carry the ding
  const root = Tone.Frequency(soften(chosen)).transpose(12).toNote();
  noteOn(clickVoice, root, '1n', now, 0.55, 2.4, true);
  noteOn(dingBell, Tone.Frequency(root).transpose(12).toNote(), '2n', now + 0.12, 0.28, 2, true);
  noteOn(dingBell, Tone.Frequency(root).transpose(7).toNote(), '2n', now + 0.3, 0.2, 2, true);
}

function ambientTick(time){
  const cnt = 1 + Math.floor(Math.random()*3);
  const scale = currentScale(field.awareness);
  for(let k = 0; k < cnt; k++){
    for(let tries = 0; tries < 4; tries++){
      const n = scale[Math.floor(Math.random()*scale.length)];
      if(noteOn(pluck, n, '2n', time + k*0.38, 0.16 + Math.random()*0.14, 2.2)) break;
    }
  }
}

function chordTick(time){
  const a = field.awareness;
  let chord;
  if(a < 0.3) chord = ['C3','Eb3','G3'];
  else if(a < 0.6) chord = ['C3','Eb3','G3','Bb3'];
  else if(a < 0.85) chord = ['C3','E3','G3','B3'];
  else chord = ['C3','E3','G3','B3','D4'];
  chord.forEach((n, i) => noteOn(pluck, n, '2n', time + i*0.28, 0.12 + Math.random()*0.06, 2.4, true));
}

function chimeTick(pitchIdx, time){
  const scale = currentScale(field.awareness);
  const n = consonantNote(scale, pitchIdx + 2, time);
  noteOn(clickVoice, soften(n), '4n', time, 0.2, 1.2);
}

function startDrones(time){
  drone1.triggerAttack(DRONE_NOTES[0], time);
  drone2.triggerAttack(DRONE_NOTES[1], time);
  drone3.triggerAttack(DRONE_NOTES[2], time);
}

function startAudio(){
  if(!audioReady) return;
  try {
    startDrones();
    scheduleAmbientPlucks();
    scheduleChordShifts();
  } catch(e){}
}

let chordInterval;
function scheduleChordShifts(){
  if(chordInterval) clearInterval(chordInterval);
  chordInterval = setInterval(() => {
    if(!audioReady || !S.started) return;
    chordTick(Tone.now());
  }, 14000);
}

let pluckInterval;
function scheduleAmbientPlucks(){
  if(pluckInterval) clearInterval(pluckInterval);
  pluckInterval = setInterval(() => {
    if(!audioReady || !S.started) return;
    ambientTick(Tone.now());
  }, 1800);
}

let lastMsgTone = 0;
export function messageTone(s){
  if(!audioReady || S.muted) return;
  const nowP = performance.now();
  if(nowP - lastMsgTone < 400) return;
  lastMsgTone = nowP;
  try { chimeTick(s.pitchIdx, Tone.now() + 0.02); } catch(e){}
}

export function setupAudio(){
  // a large playback buffer so drawing never makes the audio crackle
  try { Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.2 })); } catch(e){}
  if(/[?&]audiotest\b/.test(location.search)){
    window.__wwoAudio = {
      build: buildAudioGraph, click: playClickSound, ambientTick, chordTick, chimeTick, startDrones,
      setAwareness: a => { field.awareness = a; },
      nodes: () => ({drone1, drone2, drone3, pluck, reverb, clickVoice, dingBell, compressor, masterGain})
    };
  }
}
