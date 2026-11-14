import { S } from './state.js';
import { conversationLoop } from './agents.js';
import { initAudio, setupAudio } from './audio.js';
import { channelSys, setupChannel } from './channel.js';
import { channel, controls, gate, gateBtn, hint, hud, mindStatus } from './dom.js';
import { PROVIDERS, linkMind, mind, probeMind, setMindStatus, setupMind, shortModel } from './mind.js';
import { setupInput } from './input.js';
import { setupMesh } from './mesh.js';
import { frame, setupRender } from './render.js';

async function enterField(){
  if(S.started) return;
  S.started = true;
  try {
    await Tone.start();
    initAudio();
  } catch(e){}
  gate.classList.add('hidden');
  setTimeout(() => {
    hud.classList.add('visible');
    controls.classList.add('visible');
    hint.classList.add('visible');
    channel.classList.add('visible');
  }, 1500);
  channelSys('mesh online · mind: ' + shortModel(mind.model) + ' via ' + mind.provider);
  if(PROVIDERS[mind.provider].needsKey){
    const ok = await linkMind(mind.provider, mind.model, mind.key);
    if(!ok){ mind.provider = 'pollinations'; mind.model = 'openai-fast'; mind.key = ''; mind.state = 'ready'; setMindStatus(''); probeMind(); }
  }
  setMindStatus(mindStatus.textContent);
  conversationLoop(0);
  conversationLoop(1);
}

setupAudio();
setupRender();
setupMesh();
setupMind();
setupChannel();
setupInput();
gateBtn.addEventListener('click', enterField);
frame();
