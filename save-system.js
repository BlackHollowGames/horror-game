const KEY='the-seeker-save-v1';
const fresh=()=>({keys:[], evidence:[], notes:[], checkpoint:{x:0,z:14}, settings:{quality:'medium',sensitivity:.002}, endings:[], stats:{deaths:0,roomsVisited:[],playSeconds:0}});
export function loadSave(){try{return {...fresh(),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return fresh();}}
export function writeSave(patch){const current=loadSave();const next={...current,...patch};try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}return next;}
export function resetSave(){try{localStorage.removeItem(KEY);}catch{}return fresh();}
export function addUniqueSaveItem(field,id){const s=loadSave();const a=Array.isArray(s[field])?s[field]:[];if(!a.includes(id))a.push(id);return writeSave({[field]:a});}
