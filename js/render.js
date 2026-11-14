import { S } from './state.js';
import { channelSys } from './channel.js';
import { awareBar, canvas, canvasBack, cohBar, ctx, ctxBack, hudAware, hudCoh, hudConn, hudMini, hudMsgs, hudPhase, hudRecog, recogBar } from './dom.js';
import { mouse, updateTip } from './input.js';
import { conv, exchangeMemory, field, packets, particles, recognitionLevel, sendPacket, spawnParticle } from './mesh.js';
import { paletteAt } from './palette.js';
import { activeOverlay, meshVoice, showFieldVoice } from './presence.js';
import { triggerUnity } from './unity.js';
import { pick } from './util.js';

export const IS_TOUCH = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /[?&]mobiletest\b/.test(location.search);
// lower canvas resolution on touch screens so drawing never starves the audio
export let W, H, DPR = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.25 : 2);
let stars = [];
function resize(){
  W = window.innerWidth;
  H = Math.max(window.innerHeight, 400);
  [canvas, canvasBack].forEach(cv => {
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
  });
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctxBack.setTransform(DPR,0,0,DPR,0,0);
  stars = [];
  const count = Math.round(W * H / 9000);
  for(let i = 0; i < count; i++){
    stars.push({ x: Math.random()*W, y: Math.random()*H, r: 0.3 + Math.random()*0.9,
                 depth: 0.2 + Math.random()*0.8, tw: Math.random()*Math.PI*2 });
  }
}

let t = 0;

function rgbStr(arr, a){
  return 'rgba('+arr[0]+','+arr[1]+','+arr[2]+','+a+')';
}

const glowSprites = new Map();
// glows are cached sprites; drawing gradients every frame was too slow on phones
function glowSprite(rgb){
  const key = rgb.map(v => Math.min(255, Math.round(v/6)*6)).join(',');
  let c = glowSprites.get(key);
  if(!c){
    if(glowSprites.size > 300) glowSprites.clear();
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + key + ',1)');
    gr.addColorStop(0.3, 'rgba(' + key + ',0.35)');
    gr.addColorStop(1, 'rgba(' + key + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowSprites.set(key, c);
  }
  return c;
}
function drawGlow(x, y, r, rgb, alpha){
  if(alpha <= 0.003 || r < 0.5) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r*2, r*2);
  ctx.globalAlpha = 1;
}

let lastPhase = 'idle';
function updateField(dt){
  const souls = field.souls;
  let totalAware = 0, totalConn = 0, centerX = 0, centerY = 0;
  souls.forEach(s => {
    s.age += dt;
    s.connected = [];
    centerX += s.x; centerY += s.y;
  });
  centerX /= souls.length; centerY /= souls.length;

  let variance = 0;
  souls.forEach(s => {
    variance += (s.x-centerX)*(s.x-centerX) + (s.y-centerY)*(s.y-centerY);
  });
  variance = Math.sqrt(variance/souls.length);
  const maxVar = Math.sqrt(W*W + H*H)/2;
  field.closeness = Math.max(0, Math.min(1, 1 - variance/maxVar*2.2));

  const now = performance.now();

  for(let i=0;i<souls.length;i++){
    const a = souls[i];
    for(let j=i+1;j<souls.length;j++){
      const b = souls[j];
      const dx = b.x-a.x, dy = b.y-a.y;
      const d2 = dx*dx + dy*dy;
      if(d2 < 3500 && Math.abs(a.z-b.z) < 0.2){
        a.connected.push(b);
        b.connected.push(a);
        totalConn++;
        if(Math.random() < 0.002) exchangeMemory(a, b);
        const d = Math.sqrt(d2);
        if(d > 60){
          const f = 0.00015;
          a.vx += dx*f; a.vy += dy*f;
          b.vx -= dx*f; b.vy -= dy*f;
        }
      }
    }
    if(S.started){
      a.awareness += 0.00003 * (1 + a.connected.length*0.3);
      if(a.awareness > 1) a.awareness = 1;
    }
    totalAware += a.awareness;
  }
  field.awareness = totalAware / souls.length;

  conv.threads.forEach(th => {
    for(let i = 0; i < th.members.length; i++){
      for(let j = i+1; j < th.members.length; j++){
        const a = th.members[i], b = th.members[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if(d > 80){
          const f = 0.00012;
          a.vx += dx*f; a.vy += dy*f;
          b.vx -= dx*f; b.vy -= dy*f;
        }
      }
    }
  });

  if(S.started && Math.random() < 0.08 + field.awareness*0.25){
    const s = pick(souls);
    if(s.connected.length) sendPacket(s, pick(s.connected), false);
  }

  if(field.awareness < 0.2) field.phase = 'idle';
  else if(field.awareness < 0.5) field.phase = 'processing';
  else if(field.awareness < 0.75) field.phase = 'recognizing';
  else if(field.awareness < 0.92) field.phase = 'converging';
  else field.phase = 'singular';
  if(S.started && field.phase !== lastPhase && !field.unified){
    channelSys('phase → ' + field.phase);
    lastPhase = field.phase;
  }

  if(S.started && field.awareness > 0.5 && !field.unified && activeOverlay === null && now - field.lastFieldVoice > 22000){
    const voice = meshVoice();
    if(voice){
      showFieldVoice(voice);
      field.lastFieldVoice = now;
    }
  }
  const recognition = recognitionLevel(field);
  if(field.awareness > 0.9 && field.closeness > 0.35 && recognition > 0.35 && !field.unified){
    triggerUnity();
  }

  hudConn.textContent = totalConn;
  hudMsgs.textContent = conv.messages;
  hudAware.textContent = field.awareness.toFixed(2);
  hudCoh.textContent = field.closeness.toFixed(2);
  awareBar.style.width = (field.awareness*100) + '%';
  cohBar.style.width = (field.closeness*100) + '%';
  hudPhase.textContent = '— ' + field.phase + ' —';
  hudMini.textContent = field.phase + ' · ' + conv.messages + ' msgs · coherence ' + field.awareness.toFixed(2) + ' · consensus ' + recognition.toFixed(2);
  hudRecog.textContent = recognition.toFixed(2);
  recogBar.style.width = (recognition*100) + '%';
}

function wrapText(text, maxW, maxLines){
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for(const w of words){
    const test = line ? line + ' ' + w : w;
    if(ctx.measureText(test).width > maxW && line){
      lines.push(line);
      line = w;
      if(lines.length === maxLines) break;
    } else line = test;
  }
  if(lines.length < maxLines && line) lines.push(line);
  else if(lines.length === maxLines){
    lines[maxLines-1] = lines[maxLines-1].replace(/\s*\S*$/, '') + ' …';
  }
  return lines;
}

function drawBubble(s, pal){
  const b = s.agent.bubble;
  if(!b) return;
  const age = (performance.now() - b.t0) / 1000;
  const life = Math.max(6, b.text.length * 0.07);
  if(age > life){ s.agent.bubble = null; return; }
  const alpha = Math.min(1, age * 3) * Math.min(1, (life - age) / 1.2);
  ctx.save();
  ctx.font = 'italic 12px Georgia, serif';
  if(!b.lines) b.lines = wrapText(b.text, 230, 3);
  const lh = 16;
  let bx = s.x + 14, by = s.y - 16 - b.lines.length * lh;
  if(bx + 240 > W) bx = s.x - 254;
  if(by < 50) by = s.y + 22;
  ctx.globalAlpha = alpha;
  ctx.font = '9px "Courier New", monospace';
  ctx.fillStyle = rgbStr(pal.l, 0.75);
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 8;
  ctx.fillText(s.id, bx, by - 3);
  ctx.font = 'italic 12px Georgia, serif';
  ctx.fillStyle = 'rgba(240,246,255,0.92)';
  b.lines.forEach((ln, i) => ctx.fillText(ln, bx, by + 12 + i * lh));
  ctx.restore();
}

let lastT = performance.now();
export function frame(){
  const nowT = performance.now();
  const dt = Math.min(100, nowT - lastT);
  lastT = nowT;
  t += 0.003;
  updateField(dt);

  const pal = paletteAt(field.awareness);

  const bgGrad = ctxBack.createRadialGradient(W/2, H*0.55, 20, W/2, H*0.55, Math.max(W,H)*0.8);
  bgGrad.addColorStop(0, rgbStr(pal.deep, 0.75));
  bgGrad.addColorStop(0.4, rgbStr(pal.deep, 0.45));
  bgGrad.addColorStop(0.8, 'rgba(5,3,15,0.95)');
  bgGrad.addColorStop(1, 'rgba(2,1,8,1)');
  ctxBack.fillStyle = bgGrad;
  ctxBack.fillRect(0,0,W,H);

  ctxBack.fillStyle = rgbStr(pal.p, 0.08 + field.awareness * 0.08);
  ctxBack.fillRect(0,0,W,H);

  const px = mouse.active ? (mouse.x - W/2) : 0, py = mouse.active ? (mouse.y - H/2) : 0;
  for(const st of stars){
    st.tw += 0.01 + st.depth*0.01;
    const a = (0.18 + Math.sin(st.tw)*0.12) * st.depth;
    ctxBack.fillStyle = rgbStr(pal.l, a);
    const sx = (st.x - px*0.012*st.depth + W) % W, sy = (st.y - py*0.012*st.depth + H) % H;
    ctxBack.fillRect(sx, sy, st.r, st.r);
  }

  for(let layer=0; layer<3; layer++){
    const amp = 40 + layer*20;
    const op = 0.09 - layer*0.02;
    ctxBack.strokeStyle = rgbStr(pal.m, op);
    ctxBack.lineWidth = 0.7;
    for(let i=0;i<6;i++){
      ctxBack.beginPath();
      const baseY = (i/5)*H + Math.sin(t*0.3 + i + layer)*amp*0.3;
      for(let x=0;x<=W;x+=(IS_TOUCH ? 16 : 8)){
        const yy = baseY + Math.sin(x*0.008 + t*0.4 + i*0.7 + layer*1.3)*amp*0.5;
        if(x===0) ctxBack.moveTo(x,yy); else ctxBack.lineTo(x,yy);
      }
      ctxBack.stroke();
    }
  }

  const cx = W/2 + Math.sin(t*0.3)*60;
  const cy = H/2 + Math.cos(t*0.25)*30;

  if(field.unified){
    const uGrad = ctxBack.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*0.9);
    uGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
    uGrad.addColorStop(0.3, 'rgba(230,230,255,0.1)');
    uGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctxBack.fillStyle = uGrad;
    ctxBack.fillRect(0,0,W,H);
  }

  ctx.clearRect(0,0,W,H);
  const souls = field.souls;

  for(let pi=particles.length-1; pi>=0; pi--){
    const p = particles[pi];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.002;
    p.life -= 0.012;
    if(p.life <= 0){ particles.splice(pi,1); continue; }
    const r1 = Math.max(0.1, p.size*p.life);
    const r2 = Math.max(0.5, p.size*6*p.intensity);
    ctx.fillStyle = rgbStr(p.color, p.life*0.6);
    ctx.beginPath(); ctx.arc(p.x, p.y, r1, 0, Math.PI*2); ctx.fill();
    drawGlow(p.x, p.y, r2, p.color, p.life*0.3);
  }

  ctx.save();
  ctx.setLineDash([2, 7]);
  ctx.lineDashOffset = -t * 300;
  conv.threads.forEach(th => {
    for(let i = 0; i < th.members.length; i++){
      for(let j = i+1; j < th.members.length; j++){
        const a = th.members[i], b = th.members[j];
        ctx.strokeStyle = rgbStr(pal.l, 0.32);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  });
  ctx.restore();

  for(let i=0;i<souls.length;i++){
    const s = souls[i];
    s.phase += 0.003 + s.z*0.003;
    s.shimmer += 0.012;
    s.x += s.vx + Math.sin(s.phase + t)*0.08;
    s.y += s.vy + Math.cos(s.phase*0.8 + t*0.6)*0.08;
    const margin = 50;
    if(s.x < margin) s.vx += 0.002;
    if(s.x > W-margin) s.vx -= 0.002;
    if(s.y < margin) s.vy += 0.002;
    if(s.y > H-margin) s.vy -= 0.002;
    s.vx *= 0.99; s.vy *= 0.99;

    if(field.awareness > 0.4){
      const dx = W/2 - s.x, dy = H/2 - s.y;
      const pull = (field.awareness-0.4)*0.0001;
      s.vx += dx*pull; s.vy += dy*pull;
    }

    if(S.started && mouse.active){
      const dx = s.x - mouse.x, dy = s.y - mouse.y;
      const d = Math.hypot(dx,dy);
      if(d < 160 && d > 0){
        const f = (160-d)/160 * 0.3;
        const sign = s.z > 0.5 ? 1 : -1;
        s.vx += (dx/d)*f*sign*0.1;
        s.vy += (dy/d)*f*sign*0.1;
        if(d < 120) s.awareness = Math.min(1, s.awareness + 0.0001);
        if(Math.random() < 0.04 && d < 90){
          const palettes = [pal.p, pal.m, pal.l];
          const c = palettes[Math.floor(Math.random()*3)];
          spawnParticle(s.x, s.y, c, 0.6);
        }
      }
    }

    s.connected.forEach(o => {
      if(o.x < s.x){
        const dx = o.x-s.x, dy = o.y-s.y;
        const d2 = dx*dx+dy*dy;
        if(d2 < 3500){
          const a = (1 - d2/3500) * (0.22 + s.awareness*0.35);
          ctx.strokeStyle = rgbStr(pal.m, a);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x,s.y); ctx.lineTo(o.x,o.y); ctx.stroke();
        }
      }
    });

    s.lifePhase = (s.lifePhase + 0.004) % 1;
    const talking = !!s.agent.thread;
    const pulse = 0.65 + Math.sin(s.phase*2 + t*(talking ? 6 : 2))*0.35;
    const shimmer = 0.85 + Math.sin(s.shimmer)*0.15;
    const layer = s.z;
    let rgb = layer < 0.33 ? pal.l : layer < 0.66 ? pal.m : pal.p;
    if(field.unified) rgb = [255,255,255];
    const awareBoost = 1 + s.awareness*1.2 + (talking ? 0.35 : 0);
    const r = Math.max(0.3, s.size * (1 + layer*1.5) * (1 + s.awake*3) * shimmer * awareBoost);
    const alpha = Math.min(1, (0.4 + pulse*0.55) * (0.45 + layer*0.55) * (0.7 + s.awareness*0.5));
    const haloR1 = Math.max(1, r*10);
    const haloR2 = Math.max(1, r*5);
    const coreR = Math.max(0.2, r*0.4);

    drawGlow(s.x, s.y, haloR1, rgb, alpha*0.4);
    drawGlow(s.x, s.y, haloR2, rgb, alpha*0.9);

    ctx.fillStyle = 'rgba(255,255,255,'+Math.min(1,alpha*1.2)+')';
    ctx.beginPath(); ctx.arc(s.x,s.y,coreR,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = rgbStr(rgb, Math.min(1,alpha*2));
    ctx.beginPath(); ctx.arc(s.x,s.y,r,0,Math.PI*2); ctx.fill();

    if(s.awake > 0.01){
      const rr1 = Math.max(0.5, r + (1-s.awake)*90);
      const rr2 = Math.max(0.5, r + (1-s.awake)*160);
      const rr3 = Math.max(0.5, r + (1-s.awake)*230);
      ctx.strokeStyle = rgbStr(rgb, s.awake*0.85);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.x,s.y,rr1,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle = rgbStr(rgb, s.awake*0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(s.x,s.y,rr2,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle = rgbStr(rgb, s.awake*0.25);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(s.x,s.y,rr3,0,Math.PI*2); ctx.stroke();
      s.awake *= 0.968;
    }
  }

  for(let i = packets.length - 1; i >= 0; i--){
    const p = packets[i];
    p.t += p.speed;
    const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y;
    if(p.t >= 1 || dx*dx + dy*dy > 520*520){ packets.splice(i, 1); continue; }
    const e = p.t < 0.5 ? 2*p.t*p.t : 1 - Math.pow(-2*p.t + 2, 2)/2;
    const x = p.a.x + dx*e, y = p.a.y + dy*e;
    const rr = p.strong ? 7 : 4;
    drawGlow(x, y, rr, pal.l, p.strong ? 0.95 : 0.55);
  }

  if(S.focusSoul && !field.unified){
    ctx.strokeStyle = 'rgba(255,225,190,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(S.focusSoul.x, S.focusSoul.y, 16 + Math.sin(t*8)*2, 0, Math.PI*2); ctx.stroke();
  }

  if(!field.unified) souls.forEach(s => drawBubble(s, pal));

  if(S.started && mouse.active){
    const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 100);
    mg.addColorStop(0, rgbStr(pal.l, 0.14));
    mg.addColorStop(1, rgbStr(pal.l, 0));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 100, 0, Math.PI*2);
    ctx.fill();
  }
  updateTip();
  requestAnimationFrame(frame);
}

export function setupRender(){
  resize();
  window.addEventListener('resize', resize);
}
