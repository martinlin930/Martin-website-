// One shared day lasts 1,440 real seconds. Unix time keeps the cycle stable
// across reconnects, deployments and devices; one real minute is a game hour.
export const DAY_LENGTH_MS=24*60*1000;
export function worldTime(serverTimeMs){
 const phase=((serverTimeMs%DAY_LENGTH_MS)+DAY_LENGTH_MS)%DAY_LENGTH_MS/DAY_LENGTH_MS;
 const hour=phase*24;
 const altitude=Math.sin(phase*Math.PI*2-Math.PI/2);
 const t=Math.max(0,Math.min(1,altitude/.3));
 return {hour,altitude,daylight:t*t*(3-2*t),day:hour>=6&&hour<18,
  label:`${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.floor(hour%1*60)).padStart(2,'0')}`};
}
