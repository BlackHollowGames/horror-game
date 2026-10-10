export const STORY_LOGS=[
{ id:'log-001',title:'The Wake-Up',text:'You were found in a room that does not appear on the facility plans. Your name was written on the inside of the door.'},
{ id:'log-002',title:'Adaptive Behavior',text:'The subject changes its search pattern after every encounter. Repeating a successful route is strongly discouraged.'},
{ id:'log-003',title:'The Residence',text:'The west wing was built to resemble a family home. No family is listed in the facility records.'},
{ id:'log-004',title:'The Last Order',text:'Do not destroy the records. The records are the only proof that the subject existed before the complex.'}
];
export function getStoryLog(id){return STORY_LOGS.find(x=>x.id===id)||null;}
