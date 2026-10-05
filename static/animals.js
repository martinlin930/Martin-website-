import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';
import {patrol} from './dogs.js';
export const animalNames={Cow:'牛',Horse:'马',Llama:'羊驼',Pig:'猪',Pug:'巴哥犬',Sheep:'羊',Zebra:'斑马'};
const heights={Cow:1.3,Horse:1.8,Llama:1.5,Pig:.65,Pug:.45,Sheep:.8,Zebra:1.65};
export async function createAnimals(scene,map){
 const spots=await fetch('/static/animal-spots.json').then(r=>r.json()),templates=new Map();
 await Promise.all(spots.map(async s=>templates.set(s.kind,await new GLTFLoader().loadAsync('/static/models/animals/'+s.kind+'.glb'))));
 function model(kind){
  const data=templates.get(kind),body=clone(data.scene),root=new THREE.Group();root.add(body);
  body.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(body),scale=heights[kind]/(box.max.y-box.min.y);body.scale.multiplyScalar(scale);body.position.set(-(box.max.x+box.min.x)*.5*scale,-box.min.y*scale,-(box.max.z+box.min.z)*.5*scale);
  body.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
  const mixer=new THREE.AnimationMixer(body),actions={};for(const clip of data.animations)actions[clip.name.split('|').at(-1)]=mixer.clipAction(clip);
  scene.add(root);return {root,body,mixer,actions,baseY:body.position.y,mode:null};
 }
 function animate(p,moving,running,dt,time){
  const reacting=p.reaction?.until>performance.now();const mode=reacting&&p.reaction.action==='pet'&&p.actions.Jump?'Jump':moving?(running&&p.actions.Run?'Run':p.actions.Walk?'Walk':'Idle'):'Idle';
  if(mode!==p.mode){p.actions[p.mode]?.fadeOut(.2);p.actions[mode]?.reset().fadeIn(.2).play();p.mode=mode;}
  p.mixer.update(dt);if(moving&&!p.actions.Walk)p.body.position.y=p.baseY+Math.abs(Math.sin(time*.012))*.035;else p.body.position.y=p.baseY;
 }
 const wild=spots.map(s=>({...model(s.kind),spot:s,route:patrol(map,s.x,s.z,s.radius)})),companions=new Map();
 function nearest(x,z){let closest=null;for(const p of wild){const d=Math.hypot(p.root.position.x-x,p.root.position.z-z);if(d<3&&(!closest||d<closest.distance))closest={kind:p.spot.kind,distance:d};}return closest;}
 function dispose(p){scene.remove(p.root);p.label?.remove();p.mixer.stopAllAction();p.mixer.uncacheRoot(p.body);}
 return {nearest,interact(id,action){const p=companions.get(id);if(p)p.reaction={action,until:performance.now()+2000};},update(time,owners,dt,camera,w,h){
  for(let i=0;i<wild.length;i++){
   const p=wild[i];if(!p.route)continue;const {points,length}=p.route,walkTime=length*.4/.6,runTime=length*.6/1.4,period=walkTime+runTime+3,t=((time/1000+i*3)%period+period)%period,moving=t<walkTime+runTime,running=t>=walkTime&&moving,d=moving?(running?length*.4+(t-walkTime)*1.4:t*.6):0;
   let j=1;while(j<points.length-1&&points[j].distance<d)j++;const a=points[j-1],b=points[j],u=(d-(a.distance||0))/(b.distance-(a.distance||0));
   p.root.position.set(THREE.MathUtils.lerp(a.x,b.x,u),0,THREE.MathUtils.lerp(a.z,b.z,u));p.root.position.y=map.groundHeight(p.root.position.x,p.root.position.z);p.root.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);animate(p,moving,running,dt,time);
  }
  const alive=new Set();
  for(const owner of owners){const kind=owner.animals?.active,info=owner.animals?.[kind];if(!info||!templates.has(kind))continue;alive.add(owner.id);let p=companions.get(owner.id);
   if(p&&p.kind!==kind){dispose(p);companions.delete(owner.id);p=null;}
   if(!p){p={...model(kind),kind,trail:[],last:{x:owner.x,z:owner.z}};p.root.position.set(owner.x,map.groundHeight(owner.x,owner.z),owner.z);p.label=document.createElement('span');p.label.className='dogLabel';document.getElementById('world').append(p.label);companions.set(owner.id,p);}
   if(Math.hypot(owner.x-p.last.x,owner.z-p.last.z)>20){p.trail=[];p.root.position.set(owner.x,map.groundHeight(owner.x,owner.z),owner.z);}
   if(Math.hypot(owner.x-p.last.x,owner.z-p.last.z)>.15){p.trail.push({x:owner.x,z:owner.z});p.last={x:owner.x,z:owner.z};}if(p.trail.length>500)p.trail.splice(0,p.trail.length-500);
   let remaining=0,prev=p.root.position;for(const q of p.trail){remaining+=Math.hypot(q.x-prev.x,q.z-prev.z);prev=q;}const running=remaining>5;let budget=(running?7:3.6)*Math.min(dt,.05),moved=0;
   const followGap=p.reaction?.action==='call'&&p.reaction.until>performance.now()?.6:2.3;
   while(remaining>followGap&&budget>0&&p.trail.length){const q=p.trail[0],pos=p.root.position,dx=q.x-pos.x,dz=q.z-pos.z,d=Math.hypot(dx,dz);if(d<.08){p.trail.shift();continue;}const step=Math.min(budget,d,remaining-followGap),nx=pos.x+dx/d*step,nz=pos.z+dz/d*step;if(!map.canMove(nx,nz,pos.x,pos.z))break;pos.set(nx,map.groundHeight(nx,nz),nz);p.root.rotation.y=Math.atan2(dx,dz);moved+=step;budget-=step;remaining-=step;}
   animate(p,moved>.001,running,dt,time);p.label.textContent=info.name+' · Lv. '+Math.min(100,Math.floor(info.xp/100));const q=p.root.position.clone();q.y+=heights[kind]+.2;q.project(camera);p.label.hidden=q.z>1||q.z< -1||Math.abs(q.x)>1||Math.abs(q.y)>1;p.label.style.left=(q.x*.5+.5)*w+'px';p.label.style.top=(-q.y*.5+.5)*h+'px';
  }
  for(const [id,p] of companions)if(!alive.has(id)){dispose(p);companions.delete(id);}
 }};
}
