// Procedural audio: no sound files required. Call from a user gesture after the game starts.
let ctx=null, master=null;
export function initAudio(){ if(!ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return false; ctx=new AC(); master=ctx.createGain(); master.gain.value=.28; master.connect(ctx.destination); } if(ctx.state==='suspended') ctx.resume(); return true; }
export function setVolume(value){ if(master) master.gain.setTargetAtTime(Math.max(0,Math.min(1,value)),ctx.currentTime,.04); }
export function tone(freq=440,duration=.12,type='sine',volume=.18){ if(!initAudio())return; const o=ctx.createOscillator(),g=ctx.createGain(); o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+duration); }
export function scareSting(){tone(72,.8,'sawtooth',.3);setTimeout(()=>tone(39,.7,'triangle',.22),130);}
export function doorCreak(){tone(155,.25,'sawtooth',.1);setTimeout(()=>tone(92,.34,'triangle',.08),100);}
export function pickupChime(){tone(660,.1,'sine',.12);setTimeout(()=>tone(880,.16,'sine',.1),90);}
