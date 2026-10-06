import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export const TRAIN_PERIOD=120000;
export const TRAIN_SPEED=14.7;
export function trainCycle(now){const cycle=Math.floor(now/TRAIN_PERIOD);let hash=(cycle^0x9e3779b9)>>>0;hash=Math.imul(hash^(hash>>>16),0x85ebca6b)>>>0;return {cycle,elapsed:((now%TRAIN_PERIOD)+TRAIN_PERIOD)%TRAIN_PERIOD,type:hash%3};}
export function railPath(raw){const points=raw.map(p=>new THREE.Vector3(...p)),distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+points[i].distanceTo(points[i-1]));return {length:distances.at(-1),at(distance){const d=THREE.MathUtils.clamp(distance,0,distances.at(-1));let lo=1,hi=points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid]<d)lo=mid+1;else hi=mid;}const a=lo-1;return points[a].clone().lerp(points[lo],(d-distances[a])/(distances[lo]-distances[a]));}};}
const types=[{name:'高速列车',cars:['High Speed Front','High Speed Wagon','High Speed Wagon','High Speed Wagon','High Speed Wagon','High Speed Wagon']},{name:'货运列车',cars:['Cargo Train Front','Cargo Train Container','Cargo Train Coal Conta','Cargo Train Container','Cargo Train Coal Conta','Cargo Train Container']},{name:'蒸汽机车',cars:['Locomotive Front','Locomotive Passenger Carriage','Locomotive Passenger Carriage','Locomotive Wagon','Locomotive Passenger Carriage','Locomotive Wagon']}];
export async function createTrain(scene){
 const route=railPath(await fetch('/static/train-route.json').then(r=>r.json())),loader=new GLTFLoader(),templates=new Map();
 await Promise.all([...new Set(types.flatMap(t=>t.cars))].map(async name=>templates.set(name,(await loader.loadAsync('/static/models/trains/'+encodeURIComponent(name)+'.glb')).scene)));
 const trains=types.map(type=>{let offset=0;return {name:type.name,cars:type.cars.concat(type.cars.slice(1),type.cars.slice(-3)).map(name=>{
  const body=templates.get(name).clone(true),root=new THREE.Group();root.add(body);body.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(body),size=box.getSize(new THREE.Vector3());if(size.x>size.z)body.rotation.y+=Math.PI/2;body.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(body);size=box.getSize(new THREE.Vector3());const scale=2.6/size.x;body.scale.multiplyScalar(scale);body.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);body.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});root.visible=false;scene.add(root);const length=size.z*scale,car={root,length,offset:offset+length*.5};offset+=length+.4;return car;})};});
 return {route,trains,speed:TRAIN_SPEED,cycle:trainCycle,update(now){const state=trainCycle(now),chosen=trains[state.type],head=state.elapsed/1000*TRAIN_SPEED;let visible=false;
  for(let i=0;i<trains.length;i++)for(const car of trains[i].cars){const d=head-car.offset;car.root.visible=i===state.type&&d>=car.length*.5&&d<=route.length-car.length*.5;if(!car.root.visible)continue;visible=true;car.root.position.copy(route.at(d));const direction=route.at(d+.5).sub(route.at(d-.5));car.root.rotation.y=Math.atan2(direction.x,direction.z);}
  return visible?chosen.name+' · 行驶中':'下一班火车 · '+Math.ceil((TRAIN_PERIOD-state.elapsed)/1000)+' 秒';
 }};
}
