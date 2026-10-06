import * as THREE from './vendor/three.module.js';
import {TRAIN_SPEED} from './train.js';
// Geometry and placements come from the existing village crossing, not new gates.
export function crossingState(elapsed,distance,length,speed=TRAIN_SPEED){
 const arrival=(distance-4)/speed*1000,clear=(distance+4+length)/speed*1000;
 const warning=arrival-10000,lower=arrival-7000,down=arrival-4000,raised=clear+3000;
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 let openness=1;
 if(elapsed>=lower&&elapsed<down)openness=1-ease((elapsed-lower)/3000);
 else if(elapsed>=down&&elapsed<clear)openness=0;
 else if(elapsed>=clear&&elapsed<raised)openness=ease((elapsed-clear)/3000);
 return {openness,flashing:elapsed>=warning&&elapsed<raised};
}
export function createCrossing(scene,arms,signals){
 const flash={value:0};
 for(const signal of signals){
  signal.material=signal.material.clone();
  signal.material.onBeforeCompile=shader=>{
   shader.uniforms.crossingFlash=flash;
   shader.vertexShader='varying vec3 crossingPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n crossingPosition=position;');
   shader.fragmentShader='varying vec3 crossingPosition; uniform float crossingFlash;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',
    'float lampRed=step(diffuseColor.g*1.5,diffuseColor.r)*step(diffuseColor.b*1.5,diffuseColor.r)*step(0.12,diffuseColor.r)*step(2.5,crossingPosition.y); outgoingLight += vec3(4.0,0.04,0.01)*lampRed*(crossingFlash>0.0?((crossingPosition.x>0.0)==(crossingFlash>0.5)?1.0:0.06):0.0);\n#include <opaque_fragment>');
  };
  signal.material.customProgramCacheKey=()=> 'crossing-warning-v1';
 }
 let distance=null;
 return {update(train,now){
  if(distance===null){
   // Project the original road crossing midpoint onto the actual railway.
   let best=Infinity;
   for(let d=0;d<=train.route.length;d+=.25){const p=train.route.at(d),error=(p.x-162.485)**2+(p.z+162.3065)**2;if(error<best){best=error;distance=d;}}
  }
  const cycle=train.cycle(now),cars=train.trains[cycle.type].cars;
  const length=Math.max(...cars.map(c=>c.offset+c.length/2));
  const state=crossingState(cycle.elapsed,distance,length,train.speed);
  for(const arm of arms)arm.pivot.rotation.z=state.openness*Math.PI/2;
  flash.value=state.flashing?(Math.floor(now/450)%2?.22:1):0;
  return state;
 }};
}
