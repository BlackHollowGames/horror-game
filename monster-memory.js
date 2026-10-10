const STORAGE='the-seeker-monster-memory-v1';
export function loadMonsterMemory(){try{return JSON.parse(localStorage.getItem(STORAGE))||{routes:[],hidingSpots:[],escapes:0,encounters:0};}catch{return {routes:[],hidingSpots:[],escapes:0,encounters:0};}}
export function rememberRoute(point){const m=loadMonsterMemory();m.routes.push({x:Number(point.x)||0,z:Number(point.z)||0,at:Date.now()});m.routes=m.routes.slice(-80);try{localStorage.setItem(STORAGE,JSON.stringify(m));}catch{}return m;}
export function rememberEncounter(){const m=loadMonsterMemory();m.encounters++;try{localStorage.setItem(STORAGE,JSON.stringify(m));}catch{}return m;}
export function routeHabitScore(memory=loadMonsterMemory()){const counts=new Map();for(const p of memory.routes){const k=`${Math.round(p.x/4)},${Math.round(p.z/4)}`;counts.set(k,(counts.get(k)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cell,visits])=>({cell,visits}));}
