(()=>{
'use strict';
const root=document.querySelector('[data-assistant-root]');
if(!root)return;
const scene=root.querySelector('[data-assistant-scene]');
const mascot=root.querySelector('[data-mascot]');
const sprite=root.querySelector('[data-mascot-sprite]');
const status=root.querySelector('[data-assistant-status]');
const stateName=root.querySelector('[data-state-name]');
const message=root.querySelector('[data-context-message]');
const chat=root.querySelector('[data-assistant-chat]');
const states={
 idle:{label:'Idle',message:'I’m here and ready whenever you are.',badge:'Ready',frame:0},
 happy:{label:'Happy',message:'That looks great. I’m happy to help.',badge:'Positive',frame:1},
 thinking:{label:'Thinking',message:'Give me a moment — I’m processing the signal.',badge:'Processing',frame:2},
 excited:{label:'Excited',message:'Amazing! Let’s make it happen.',badge:'Energized',frame:3},
 sleeping:{label:'Sleeping',message:'I’m resting. Click me when you want to wake me up.',badge:'Away',frame:4},
 working:{label:'Working',message:'I’m working through the dashboard task now.',badge:'Working',frame:5},
 success:{label:'Success',message:'Done — the operation completed successfully.',badge:'Complete',frame:6},
 calm:{label:'Calm',message:'Everything is under control.',badge:'Steady',frame:7},
 surprised:{label:'Surprised',message:'Oh! I did not expect that.',badge:'Alert',frame:8},
 worried:{label:'Worried',message:'I noticed something that needs attention.',badge:'Concerned',frame:9},
 confident:{label:'Confident',message:'We’ve got this. I know the next step.',badge:'Confident',frame:10},
 error:{label:'Error',message:'Something needs attention, but we can fix it together.',badge:'Needs attention',frame:11},
 love:{label:'Love',message:'You’re doing great. Thanks for building with ProMcBot.',badge:'Appreciation',frame:12},
 minecraft:{label:'Minecraft',message:'Minecraft server mode is ready.',badge:'Minecraft',frame:13},
 presenting:{label:'Presenting',message:'Here is your ProMcBot system overview.',badge:'Presenting',frame:14}
};
let current='idle';let audioOn=true;let audioContext=null;
function beep(frequency=520,duration=.07){if(!audioOn)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();oscillator.frequency.value=frequency;oscillator.type='sine';gain.gain.setValueAtTime(.035,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration)}catch(_){} }
function setState(next,announce=true){const state=states[next];if(!state)return;current=next;const col=state.frame%5,row=Math.floor(state.frame/5);sprite.style.backgroundPosition=`${col*25}% ${row*50}%`;sprite.setAttribute('aria-label',`ProMcBot mascot: ${state.label}`);root.className=root.className.replace(/\bstate-[a-z]+\b/g,'').trim()+` state-${next}`;stateName.textContent=state.label;status.innerHTML=`<strong>${state.badge}</strong> · ${state.label}`;message.textContent=state.message;root.querySelectorAll('[data-state]').forEach(button=>button.classList.toggle('active',button.dataset.state===next));if(announce)beep(next==='error'||next==='worried'?220:next==='success'?720:520);}
function toggleChat(open){root.classList.toggle('chat-open',open);chat.classList.toggle('open',open);chat.setAttribute('aria-hidden',String(!open));if(open){setState('calm',false);beep(660)}}
root.querySelectorAll('[data-state]').forEach(button=>button.addEventListener('click',()=>setState(button.dataset.state)));
mascot.addEventListener('click',()=>{if(current==='sleeping')setState('happy');else toggleChat(!chat.classList.contains('open'))});
mascot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();mascot.click()}});
root.querySelector('[data-fab]').addEventListener('click',()=>toggleChat(true));
root.querySelector('[data-close-chat]').addEventListener('click',()=>toggleChat(false));
root.querySelector('[data-chat-demo]').addEventListener('click',()=>{setState('thinking');setTimeout(()=>{setState('success');message.textContent='Demo complete. No AI backend is connected in this prototype.'},900)});
root.querySelector('[data-reset]').addEventListener('click',()=>{setState('idle');toggleChat(false);root.querySelector('[data-speed]').value='1';root.querySelector('[data-size]').value='1';scene.style.setProperty('--assistant-scale','1');scene.style.setProperty('--assistant-speed','1');document.body.classList.remove('reduced-motion')});
root.querySelector('[data-speed]').addEventListener('input',event=>{const speed=Number(event.target.value)||1;scene.style.setProperty('--assistant-speed',String(speed));root.querySelector('[data-speed-value]').textContent=`${speed.toFixed(1)}×`});
root.querySelector('[data-size]').addEventListener('input',event=>{const size=Number(event.target.value)||1;scene.style.setProperty('--assistant-scale',String(size));root.querySelector('[data-size-value]').textContent=`${Math.round(size*100)}%`});
root.querySelector('[data-sound]').addEventListener('change',event=>{audioOn=event.target.checked;if(audioOn)beep()});
root.querySelector('[data-visibility]').addEventListener('change',event=>{root.classList.toggle('assistant-hidden',!event.target.checked);root.querySelector('[data-fab]').setAttribute('aria-hidden',String(!event.target.checked))});
root.querySelector('[data-reduced]').addEventListener('change',event=>document.body.classList.toggle('reduced-motion',event.target.checked));
window.addEventListener('keydown',event=>{if(event.key==='Escape')toggleChat(false)});
setState('idle',false);
})();
