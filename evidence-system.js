export const EVIDENCE=[
{id:'lab-report-01',title:'Containment Report 01',room:'East Laboratory',text:'Subject 09 adapts to repeated escape routes. Staff are ordered to change patrol patterns daily.'},
{id:'family-photo',title:'Damaged Family Photograph',room:'West Residence',text:'A family photo has one face scratched out. On the back: “It remembers us.”'},
{id:'audio-log-07',title:'Audio Log 07',room:'Security Wing',text:'“It did not learn the doors. It learned which doors we trusted.”'},
{id:'power-note',title:'Power Routing Note',room:'Maintenance',text:'Emergency power can be restored from the lower control room.'},
{id:'incident-09',title:'Incident 09',room:'Restricted Sector',text:'The first breach began after the staff tried to erase the subject’s records.'}
];
export function findEvidence(id){return EVIDENCE.find(e=>e.id===id)||null;}
export function collectEvidence(current,id){if(!findEvidence(id))return current;return [...new Set([...(current||[]),id])];}
