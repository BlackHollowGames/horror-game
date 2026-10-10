export function noiseForAction({sprinting=false,crouching=false,door=false,objectHit=false}={}){return (sprinting?1:0)+(crouching?-.55:0)+(door?.35:0)+(objectHit?.65:0);}
export function canHearPlayer(distance,noise,monsterAlert=1){return distance<Math.max(2,noise*11*monsterAlert);}
export function createStealthState(){return {noise:0,lastNoiseAt:0,emit(amount,now=performance.now()){this.noise=Math.max(this.noise,amount);this.lastNoiseAt=now;},decay(now=performance.now()){this.noise=Math.max(0,this.noise-(now-this.lastNoiseAt)/1800);return this.noise;}};}
