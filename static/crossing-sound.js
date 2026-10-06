// The warning loop follows the same shared state as the original crossing lamps.
export function createCrossingSound(){
 let context,buffer,source,gain,pan,wanted=false,volume=0,balance=0,loading=false;
 function apply(){
  if(!context||!buffer)return;
  if(!wanted){
   if(source){source.stop();source.disconnect();source=null;}
   gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);return;
  }
  if(!source&&context.state==='running'){
   source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(pan||gain);source.start();
  }
  gain.gain.setTargetAtTime(volume,context.currentTime,.08);
  if(pan)pan.pan.setTargetAtTime(balance,context.currentTime,.08);
 }
 function unlock(){
  try{
   const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!context&&Context){
    context=new Context();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
    if(context.createStereoPanner){pan=context.createStereoPanner();pan.connect(gain);}
   }
   if(!context)return;
   context.resume().then(apply).catch(()=>{});
   if(!buffer&&!loading){
    loading=true;
    fetch('/static/audio/crossing-warning.m4a').then(r=>{if(!r.ok)throw Error('Warning audio unavailable');return r.arrayBuffer();})
     .then(b=>context.decodeAudioData(b)).then(b=>{buffer=b;apply();})
     .catch(()=>{}).finally(()=>{loading=false;});
   }
  }catch{}
 }
 return {unlock,update(flashing,camera,muted=false){
  const dx=162.485-camera.position.x,dz=-162.3065-camera.position.z,distance=Math.hypot(dx,dz);
  volume=muted||distance>=70?0:.6*(1-distance/70)**2;
  wanted=!!flashing&&volume>0;
  const m=camera.matrixWorld.elements;
  balance=distance>.01?Math.max(-1,Math.min(1,(dx*m[0]+dz*m[2])/distance)):0;
  apply();
 },stop(){wanted=false;apply();}};
}
