import { channel, channelCount, channelFold, channelHead, channelLines, channelNew } from './dom.js';
import { escapeHtml } from './util.js';

const PHONE = window.matchMedia('(max-width: 700px)');
let channelTotal = 0;
const atBottom = () => channelLines.scrollHeight - channelLines.scrollTop - channelLines.clientHeight < 40;
function channelRow(cls, html, hue){
  const stick = atBottom();
  const row = document.createElement('div');
  row.className = 'channel-line ' + (cls || '');
  if(hue != null) row.style.setProperty('--h', hue);
  row.innerHTML = html;
  channelLines.appendChild(row);
  while(channelLines.children.length > 400) channelLines.removeChild(channelLines.firstChild);
  if(cls !== 'sys') channelCount.textContent = ++channelTotal + ' msgs';
  capChannel();
  if(stick) channelLines.scrollTop = channelLines.scrollHeight;
  else channelNew.classList.add('show');
}

// the latest three messages stay in view; older ones scroll
function capChannel(){
  const said = channelLines.querySelectorAll('.channel-line:not(.sys)');
  if(said.length <= 3){ channelLines.style.maxHeight = ''; return; }
  const first = said[said.length - 3];
  channelLines.style.maxHeight = (channelLines.scrollHeight - first.offsetTop) + 'px';
}

function pairHue(a, b){
  const k = [a, b].sort().join('|');
  let h = 0;
  for(let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h % 360;
}
export function channelAppend(from, to, text, cls){
  channelRow(cls, '<span class="who">' + escapeHtml(from) + ' → ' + escapeHtml(to) + '</span><span class="said">' + escapeHtml(text) + '</span>',
             cls === 'you' ? null : pairHue(from, to));
}
function toggleChannel(){
  if(PHONE.matches && !channel.classList.contains('folded')) channel.classList.toggle('open');
  else channel.classList.toggle('folded');
  const shut = channel.classList.contains('folded') || (PHONE.matches && !channel.classList.contains('open'));
  channelFold.textContent = channel.classList.contains('folded') ? '+' : (PHONE.matches ? (shut ? '↑' : '↓') : '–');
  channelHead.setAttribute('aria-expanded', String(!shut));
  requestAnimationFrame(() => { channelLines.scrollTop = channelLines.scrollHeight; });
}
export function channelSys(text){ channelRow('sys', '· ' + escapeHtml(text)); }

export function setupChannel(){
  window.addEventListener('resize', () => { const st = atBottom(); capChannel(); if(st) channelLines.scrollTop = channelLines.scrollHeight; });
  channelLines.addEventListener('scroll', () => { if(atBottom()) channelNew.classList.remove('show'); }, { passive: true });
  channelNew.addEventListener('click', () => { channelLines.scrollTop = channelLines.scrollHeight; channelNew.classList.remove('show'); });
  channelHead.addEventListener('click', toggleChannel);
  channelHead.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleChannel(); } });
  if(PHONE.matches) channelFold.textContent = '↑';
}
