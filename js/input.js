import { S } from './state.js';
import { audioReady, playClickSound } from './audio.js';
import { channelSys } from './channel.js';
import { canvas, mindPanel, muteBtn, nodeTip, resetBtn, whisperBox, whisperInput, whisperTo } from './dom.js';
import { buildField, field, sendPacket, spawnParticle } from './mesh.js';
import { currentScale, paletteAt } from './palette.js';
import { pingNode, sendWhisper } from './presence.js';
import { H, W } from './render.js';
import { escapeHtml } from './util.js';

export const mouse = {x: 0, y: 0, active: false};

function nearestSoul(x, y, maxD){
  let best = null, bd = maxD || Infinity;
  field.souls.forEach(s => {
    const d = Math.hypot(s.x - x, s.y - y);
    if(d < bd){ bd = d; best = s; }
  });
  return best;
}

let hoverSoul = null;

const canHover = window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
export function updateTip(){
  const s = canHover ? hoverSoul : null;
  if(!s || field.unified){ nodeTip.classList.remove('visible'); return; }
  const th = s.agent.thread;
  const role = s.awareness >= 0.25 ? 'was ' + s.life.role : 'function: unrecovered';
  const doing = th
    ? 'talking with ' + th.members.filter(o => o !== s).map(o => o.id).join(', ') + (th.topic ? ' · ' + th.topic : '')
    : s.agent.temperament;
  nodeTip.innerHTML = escapeHtml(s.id + ' · ' + s.region + ' · ' + s.ip) +
    '<span class="tip-line">' + escapeHtml(role) + '</span>' +
    '<span class="tip-line">' + escapeHtml(doing) + '</span>';
  nodeTip.style.left = Math.min(s.x, W - 300) + 'px';
  nodeTip.style.top = s.y + 'px';
  nodeTip.classList.add('visible');
}

let lastSoundTrigger = 0;

export function setupInput(){
  mouse.x = W/2; mouse.y = H/2;
  canvas.addEventListener('mousemove', e => {
    if(!S.started) return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.active = true;
    hoverSoul = nearestSoul(mouse.x, mouse.y, 26);
  });
  canvas.addEventListener('mouseleave', () => { mouse.active = false; hoverSoul = null; });
  canvas.addEventListener('click', e => {
    if(!S.started || field.unified) return;
    mindPanel.classList.remove('open');
    const best = nearestSoul(e.clientX, e.clientY);
    if(!best) return;
    best.awake = 1;
    best.awareness = Math.min(1, best.awareness + 0.07 + Math.random()*0.04);
    field.interactions++;
    S.focusSoul = best;
    whisperTo.textContent = 'WHISPER TO ' + best.id.toUpperCase() + ' ›';
    whisperInput.placeholder = 'whisper to ' + best.id + '…';
    whisperBox.classList.add('visible');
    const pal = paletteAt(field.awareness);
    const colors = [pal.p, pal.m, pal.l];
    for(let k=0;k<24;k++) spawnParticle(best.x, best.y, colors[k%3], 2);
    best.connected.forEach(c => sendPacket(best, c, true));
    if(audioReady && !S.muted && performance.now() - lastSoundTrigger > 220){
      lastSoundTrigger = performance.now();
      try {
        const scale = currentScale(field.awareness);
        const note = scale[best.pitchIdx % scale.length];
        playClickSound(note, undefined, best.pitchIdx);
      } catch(err){}
    }
    pingNode(best);
  });
  whisperInput.addEventListener('keydown', e => {
    if(e.key === 'Enter' && S.focusSoul && whisperInput.value.trim()){
      sendWhisper(S.focusSoul, whisperInput.value);
      whisperInput.value = '';
    }
    if(e.key === 'Escape') whisperInput.blur();
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') mindPanel.classList.remove('open'); });
  resetBtn.addEventListener('click', () => {
    buildField();
    channelSys('mesh restarted');
  });
  muteBtn.addEventListener('click', () => {
    S.muted = !S.muted;
    try { Tone.Destination.mute = S.muted; } catch(e){}
    muteBtn.querySelector('.lbl').textContent = S.muted ? 'SOUND · OFF' : 'SOUND · ON';
    muteBtn.classList.toggle('off', S.muted);
  });
}
