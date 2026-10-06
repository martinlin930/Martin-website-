import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {TRAIN_PERIOD,TRAIN_SPEED} from './train.js';
import {crossingState} from './rail-crossing.js';
// Centerline measured against the existing eastern village road and crossing.
export const DOG_CAR_ROAD=[[145,-163.04],[164.54,-163.04],[191.52,-162.98],[201,-164],[209,-166],[214,-166],[217,-158],[220,-149],[221,-139.5],[221,-130]];
export function roadPath(points=DOG_CAR_ROAD){
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 const length=cumulative.at(-1);
 return {length,at(d){d=Math.max(0,Math.min(length,d));let i=1;while(i<cumulative.length-1&&cumulative[i]<d)i++;const t=(d-cumulative[i-1])/(cumulative[i]-cumulative[i-1]);return [points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];}};
}
export function carTimeline(length,railDistance,trainLength,trainSpeed=TRAIN_SPEED){
 const step=.05,count=TRAIN_PERIOD/1000/step,positions=new Float32Array(count+1);
 const westStop=12,eastStop=2*length-23;
 let progress=0,turnWait=0;
 for(let i=1;i<=count;i++){
  const time=(i-1)*step*1000,state=crossingState(time,railDistance,trainLength,trainSpeed);
  const closed=state.flashing||state.openness<.999;
  let next=Math.min(2*length,progress+3.2*step);
  if(turnWait>0){next=progress;turnWait=Math.max(0,turnWait-step);}
  else if(progress<length&&next>=length){next=length;turnWait=1.5;}
  for(const stop of [westStop,eastStop])if(closed&&progress<=stop&&next>stop)next=stop;
  progress=next;positions[i]=progress;
 }
 return {positions,step,sample(elapsed){const i=Math.min(count-1,Math.max(0,Math.floor(elapsed/1000/step))),t=Math.max(0,Math.min(1,elapsed/1000/step-i));return positions[i]+(positions[i+1]-positions[i])*t;}};
}
export async function createDogCar(scene,map,train){
 const body=(await new GLTFLoader().loadAsync('/static/models/dog-car.glb')).scene;
 // The supplied model faces diagonally (+X, -Z). Align its propeller normal to +Z.
 body.rotation.y=-2.221435142908474;body.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(body),size=box.getSize(new THREE.Vector3()),scale=1.8/size.x;
 body.scale.multiplyScalar(scale);body.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);
 body.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
 const root=new THREE.Group();root.add(body);scene.add(root);
 const road=roadPath();let distance=0,best=Infinity;
 for(let d=0;d<=train.route.length;d+=.25){const p=train.route.at(d),error=(p.x-162.485)**2+(p.z+162.3065)**2;if(error<best){best=error;distance=d;}}
 const timelines=train.trains.map(t=>carTimeline(road.length,distance,Math.max(...t.cars.map(c=>c.offset+c.length/2)),train.speed));
 // Cache surface samples once; no per-frame road raycasting.
 const floors=[];for(let d=0;d<road.length;d+=.5){const [x,z]=road.at(d);floors.push(map.groundHeight(x,z));}const end=road.at(road.length);floors.push(map.groundHeight(...end));
 let lastNow=null;
 return {root,road,timelines,update(now){
  const state=train.cycle(now),progress=timelines[state.type].sample(state.elapsed),returning=progress>road.length,d=returning?2*road.length-progress:progress;
  const [x,z]=road.at(d),ahead=road.at(Math.max(0,Math.min(road.length,d+(returning?-.3:.3))));
  const index=Math.min(floors.length-2,Math.floor(d/.5)),fraction=Math.max(0,Math.min(1,d/.5-index));
  root.position.set(x,floors[index]+(floors[index+1]-floors[index])*fraction+.02,z);
  const behind=road.at(Math.max(0,Math.min(road.length,d+(returning?.3:-.3))));
  const dx=ahead[0]-x,dz=ahead[1]-z;
  const heading=Math.atan2(Math.abs(dx)+Math.abs(dz)>1e-6?dx:x-behind[0],Math.abs(dx)+Math.abs(dz)>1e-6?dz:z-behind[1]);
  const dt=lastNow===null?Infinity:Math.max(0,(now-lastNow)/1000);lastNow=now;
  let delta=THREE.MathUtils.euclideanModulo(heading-root.rotation.y+Math.PI,Math.PI*2)-Math.PI;
  root.rotation.y+=delta*Math.min(1,dt*5);
 }};
}
