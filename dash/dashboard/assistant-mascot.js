(()=>{
'use strict';
const root=document.querySelector('[data-assistant-root]');
if(!root)return;
const scene=root.querySelector('[data-assistant-scene]');
const mascot=root.querySelector('[data-mascot]');
const status=root.querySelector('[data-assistant-status]');
const stateName=root.querySelector('[data-state-name]');
const message=root.querySelector('[data-context-message]');
const chat=root.querySelector('[data-assistant-chat]');
const states={
 idle:{label:'Idle',message:'I’m here and ready whenever you are.',badge:'Ready'},
 greeting:{label:'Greeting',message:'Hey! I’m ProMcBot Assistant.',badge:'Welcome'},
 thinking:{label:'Thinking',message:'Give me a moment — I’m processing the signal.',badge:'Processing'},
 listening:{label:'Listening',message:'I’m listening. Tell me what you need.',badge:'Listening'},
 happy:{label:'Happy',message:'Nice! That looks like a great step forward.',badge:'Positive'},
 working:{label:'Working',message:'I’m working through the dashboard task now.',badge:'Working'},
 success:{label:'Success',message:'Done — the operation completed successfully.',badge:'Complete'},
 error:{label:'Error',message:'Something needs attention, but we can fix it together.',badge:'Needs attention'},
 sleeping:{label:'Sleeping',message:'I’m resting. Click me when you want to wake me up.',badge:'Away'}
};
let current='idle';
let audioOn=true;
let audioContext=null;
function $(selector){return root.querySelector(selector)}
function beep(frequency=520,duration=.07){if(!audioOn)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();oscillator.frequency.value=frequency;oscillator.type='sine';gain.gain.setValueAtTime(.035,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration)}catch(_){}}
function setState(next,announce=true){if(!states[next])return;current=next;root.className=root.className.replace(/\bstate-[a-z]+\b/g,'').trim()+` state-${next}`;stateName.textContent=states[next].label;status.innerHTML=`<strong>${states[next].badge}</strong> · ${states[next].label}`;message.textContent=states[next].message;root.querySelectorAll('[data-state]').forEach(button=>button.classList.toggle('active',button.dataset.state===next));if(announce)beep(next==='error'?220:next==='success'?720:520);}
function toggleChat(open){root.classList.toggle('chat-open',open);chat.classList.toggle('open',open);chat.setAttribute('aria-hidden',String(!open));if(open){setState('listening',false);beep(660);}}
root.querySelectorAll('[data-state]').forEach(button=>button.addEventListener('click',()=>setState(button.dataset.state)));
mascot.addEventListener('click',()=>{if(current==='sleeping')setState('greeting');else toggleChat(!chat.classList.contains('open'));});
mascot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();mascot.click();}});
root.querySelector('[data-fab]').addEventListener('click',()=>toggleChat(true));
root.querySelector('[data-close-chat]').addEventListener('click',()=>toggleChat(false));
root.querySelector('[data-chat-demo]').addEventListener('click',()=>{setState('thinking');setTimeout(()=>{setState('success');message.textContent='Demo complete. No AI backend is connected in this prototype.'},900);});
root.querySelector('[data-reset]').addEventListener('click',()=>{setState('idle');toggleChat(false);root.querySelector('[data-speed]').value='1';root.querySelector('[data-size]').value='1';scene.style.setProperty('--assistant-scale','1');document.body.classList.remove('reduced-motion');});
root.querySelector('[data-speed]').addEventListener('input',event=>{const speed=Number(event.target.value)||1;scene.style.setProperty('--assistant-speed',String(speed));root.style.setProperty('--assistant-duration',`${1/speed}s`);root.querySelector('[data-speed-value]').textContent=`${speed.toFixed(1)}×`;});
root.querySelector('[data-size]').addEventListener('input',event=>{const size=Number(event.target.value)||1;scene.style.setProperty('--assistant-scale',String(size));root.querySelector('[data-size-value]').textContent=`${Math.round(size*100)}%`;});
root.querySelector('[data-sound]').addEventListener('change',event=>{audioOn=event.target.checked;if(audioOn)beep();});
root.querySelector('[data-visibility]').addEventListener('change',event=>{root.classList.toggle('assistant-hidden',!event.target.checked);root.querySelector('[data-fab]').setAttribute('aria-hidden',String(!event.target.checked));});
root.querySelector('[data-reduced]').addEventListener('change',event=>{document.body.classList.toggle('reduced-motion',event.target.checked);});
window.addEventListener('keydown',event=>{if(event.key==='Escape')toggleChat(false);});
setState('greeting',false);setTimeout(()=>setState('idle',false),1300);
})();
