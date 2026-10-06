
export function trainGain(distance){
 if(!Number.isFinite(distance)||distance>=90)return 0;
 return .65*Math.pow(1-Math.max(0,distance)/90,2);
}
export function nearestTrain(train,position){
 let closest=null,distance=Infinity;
 for(const set of train?.trains||[])for(const car of set.cars){
  if(!car.root.visible)continue;
  const p=car.root.position;
  const d=Math.hypot(p.x-position.x,p.y+1-position.y,p.z-position.z);
  if(d<distance){distance=d;closest=p;}
 }
 return {position:closest,distance};
}
export function createTrainSound(){
 const audio=new Audio('/static/audio/train-pass.m4a');audio.loop=true;audio.preload='none';audio.volume=0;
 let context,gain,pan,unlocked=false,pending=false,level=0,lastUpdate=-Infinity,epoch=0;
 function setLevel(value){
  level=value;
  if(gain){
   gain.gain.cancelScheduledValues(context.currentTime);
   gain.gain.setTargetAtTime(value,context.currentTime,.12);
  }else audio.volume=value;
 }
 function play(){
  if(pending||!audio.paused)return;
  pending=true;const current=epoch;
  audio.play().then(()=>{
   if(current!==epoch||level<=0)audio.pause();
  }).catch(()=>{if(current===epoch)unlocked=false;}).finally(()=>{pending=false;});
 }
 function unlock(){
  try{
   const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!context&&Context){
    context=new Context();gain=context.createGain();gain.gain.value=level;
    const source=context.createMediaElementSource(audio);
    if(context.createStereoPanner){pan=context.createStereoPanner();source.connect(pan);pan.connect(gain);}
    else source.connect(gain);
    gain.connect(context.destination);audio.volume=1;
   }
   if(context&&context.state!=='running')context.resume().catch(()=>{});
   if(!unlocked){unlocked=true;play();}
   else if(level>0)play();
  }catch{}
 }
 return {
  unlock,
  update(train,camera,now,muted=false){
   if(now-lastUpdate<100)return;lastUpdate=now;
   const nearest=nearestTrain(train,camera.position);
   const value=muted?0:trainGain(nearest.distance);
   setLevel(value);
   if(pan&&nearest.position){
    const dx=nearest.position.x-camera.position.x,dz=nearest.position.z-camera.position.z;
    const matrix=camera.matrixWorld.elements;
    const horizontal=Math.hypot(dx,dz);
    const balance=horizontal>.01?Math.max(-1,Math.min(1,(dx*matrix[0]+dz*matrix[2])/horizontal)):0;
    pan.pan.setTargetAtTime(balance,context.currentTime,.12);
   }
   if(value>0&&unlocked)play();
   else if(value<=0&&!audio.paused){audio.pause();audio.currentTime=0;}
  },
  stop(){
   epoch++;lastUpdate=-Infinity;setLevel(0);
   audio.pause();audio.currentTime=0;
   if(gain){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);}
  }
 };
}
