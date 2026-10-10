export const SUBTITLES={door:'[A door groans somewhere nearby]',footsteps:'[Heavy footsteps]',breath:'[A slow, wet breath]',metal:'[Metal scrapes against concrete]',whisper:'[A whisper from the dark]',roar:'[The Seeker lets out a low roar]'};
export function subtitleFor(event){return SUBTITLES[event]||'';}
export function createSubtitleQueue(){let current='';let until=0;return {show(text,duration=1800,now=performance.now()){current=text;until=now+duration;},get(now=performance.now()){if(now>until)current='';return current;},clear(){current='';until=0;}};}
