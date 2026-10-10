export const DIFFICULTIES={story:{monsterSpeed:.72,graceSeconds:18,flashlightDrain:.65},standard:{monsterSpeed:1,graceSeconds:12,flashlightDrain:1},nightmare:{monsterSpeed:1.28,graceSeconds:7,flashlightDrain:1.35}};
export function getDifficulty(name='standard'){return DIFFICULTIES[name]||DIFFICULTIES.standard;}
