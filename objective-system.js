export const OBJECTIVES=[
{id:'find-keys',title:'Find the three access keys',hint:'Search the side rooms off the main corridor.',complete:s=>(s.keysFound?.size??0)>=3},
{id:'read-evidence',title:'Recover the facility records',hint:'Look for reports and audio logs in the complex.',complete:s=>(s.evidenceFound?.size??0)>=3},
{id:'escape',title:'Reach the exit',hint:'Return to the central exit once all keys are found.',complete:s=>(s.keysFound?.size??0)>=3&&!!s.escaped}
];
export function currentObjectives(state){return OBJECTIVES.map(o=>({...o,done:!!o.complete(state)}));}
