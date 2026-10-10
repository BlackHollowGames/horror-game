export const MAP_SECTORS=[
{id:'central',name:'Central Corridor',x:0,z:-7,kind:'transit'},
{id:'west-residence',name:'West Residence',x:-15,z:-5,kind:'mansion'},
{id:'west-archive',name:'West Archive',x:-25,z:-15,kind:'archive'},
{id:'east-lab',name:'East Laboratory',x:15,z:-5,kind:'laboratory'},
{id:'east-security',name:'Security Wing',x:25,z:-15,kind:'security'},
{id:'deep-sector',name:'Deep Sector',x:0,z:-30,kind:'restricted'}
];
export function nearestSector(x,z){return MAP_SECTORS.reduce((best,s)=>Math.hypot(s.x-x,s.z-z)<Math.hypot(best.x-x,best.z-z)?s:best,MAP_SECTORS[0]);}
