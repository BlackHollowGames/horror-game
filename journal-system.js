import {findEvidence} from './evidence-system.js';
export function makeJournal(entries=[]){return {entries:[...new Set(entries)], add(id){if(!this.entries.includes(id))this.entries.push(id);}, list(){return this.entries.map(findEvidence).filter(Boolean);}, has(id){return this.entries.includes(id);}};}
export function formatJournalText(journal){return journal.list().map((e,i)=>`${String(i+1).padStart(2,'0')} — ${e.title}
LOCATION: ${e.room}
${e.text}`).join('

');}
