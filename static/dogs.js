import * as THREE from './vendor/three.module.js';

import { GLTFLoader } from './vendor/GLTFLoader.js';

function dogModel(template){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 template.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(template),center=bounds.getCenter(new THREE.Vector3());
 const scale=.78/(bounds.max.y-bounds.min.y),deformations=[];
 template.traverse(source=>{
  if(!source.isMesh)return;
  const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);
  geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(scale,scale,scale);
  const mesh=new THREE.Mesh(geometry,source.material);mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);
  deformations.push({geometry,rest:geometry.attributes.position.array.slice()});
 });
 return {root,body,deformations};
}

function animateDog(dog,distance,moving,running,time){
 const gait=distance*6;
 dog.body.position.y=moving?Math.abs(Math.sin(gait))*(running?.035:.012):0;
 for(const {geometry,rest} of dog.deformations){
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2];let px=x,py=y,pz=z;
   // The supplied Beagle is one static mesh. Blend each leg around its hip
   // instead of moving the whole model rigidly; preserve the original texture.
   const legWeight=THREE.MathUtils.smoothstep(.29-y,0,.13)*THREE.MathUtils.smoothstep(Math.abs(z),.12,.2);
   if(legWeight>0){
    const front=z>0,side=x>0;
    const angle=moving?Math.sin(gait+(front===side?0:Math.PI))*(running?.7:.33)*legWeight:0;
    const pivot=front?.27:-.28,dy=y-.29,dz=z-pivot;
    py=.29+dy*Math.cos(angle)-dz*Math.sin(angle);pz=pivot+dy*Math.sin(angle)+dz*Math.cos(angle);
    py=Math.max(y,py); // feet swing above the ground, never below it
   }
   const tailWeight=THREE.MathUtils.smoothstep(-z,.26,.38)*THREE.MathUtils.smoothstep(y,.4,.6);
   px+=Math.sin(time*.008+dog.index)*.065*tailWeight;
   const headWeight=THREE.MathUtils.smoothstep(z,.18,.4)*THREE.MathUtils.smoothstep(y,.4,.6);
   py+=Math.sin(moving?gait:time*.0015)*.012*headWeight;
   p.setXYZ(i,px,py,pz);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 }
}

// Validate the full closed patrol against the same terrain and building collision
// used by players. Small substeps prevent crossing a wall between waypoints.
function patrol(map,cx,cz,radius){
 const points=[];
 for(let i=0;i<=80;i++){
  const angle=i/80*Math.PI*2;
  const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius;
  const previous=points.at(-1);
  if(previous&&(!map.canMove(x,z,previous.x,previous.z)||Math.abs(map.groundHeight(x,z)-previous.y)>.25))return null;
  for(const [dx,dz] of [[.2,0],[-.2,0],[0,.2],[0,-.2]])if(!map.canMove(x+dx,z+dz,x,z))return null;
  points.push({x,z,y:map.groundHeight(x,z)});
 }
 let length=0;
 for(let i=1;i<points.length;i++){length+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);points[i].distance=length;}
 return {points,length};
}
export async function createDogs(scene,map){
 const template=(await new GLTFLoader().loadAsync('/static/models/dogs/beagle.glb')).scene;
 const dogs=[];
 for(let index=0;index<6;index++){
  let route;
  const [sx,sz]=map.spawn;
  for(let attempt=0;attempt<100&&!route;attempt++){
   const radius=1.6+(index%3)*.25;
   const cx=sx-2+(index%2)*5+((attempt%10)-5)*1.1;
   const cz=sz+5+Math.floor(index/2)*13+Math.floor(attempt/10)*1.3;
   route=patrol(map,cx,cz,radius);
  }
  if(!route)continue;
  const dog=dogModel(template);scene.add(dog.root);dogs.push({...dog,route,index});
 }
 const companions=new Map();
 function removeCompanion(pet){
  scene.remove(pet.root);pet.label?.remove();
  pet.root.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
 }
 return {count:dogs.length,nearest(x,z){
  return Math.min(...dogs.map(d=>Math.hypot(d.root.position.x-x,d.root.position.z-z)));
 },update(serverTimeMs,owners=[],dt=.016,camera=null,width=0,height=0){
  const alive=new Set(owners.filter(o=>o.dog_name).map(o=>o.id));
  for(const [id,pet] of companions)if(!alive.has(id)){removeCompanion(pet);companions.delete(id);}
  for(const owner of owners){
   if(!owner.dog_name)continue;
   let pet=companions.get(owner.id);
   if(!pet){
    pet={...dogModel(template),index:6,distance:0,trail:[{x:owner.x,z:owner.z}],last:{x:owner.x,z:owner.z},blocked:0};
    pet.root.position.set(owner.x,map.groundHeight(owner.x,owner.z),owner.z);
    // Start beside the owner if there is safe space, including after login.
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(map.canMove(owner.x+dx,owner.z+dz,owner.x,owner.z)){
     pet.root.position.set(owner.x+dx,map.groundHeight(owner.x+dx,owner.z+dz),owner.z+dz);break;
    }
    if(typeof document!=='undefined'){pet.label=document.createElement('span');pet.label.className='dogLabel';document.getElementById('world').append(pet.label);}
    scene.add(pet.root);companions.set(owner.id,pet);
   }
   const gap=Math.hypot(owner.x-pet.last.x,owner.z-pet.last.z);
   if(gap>20){pet.trail=[];pet.root.position.set(owner.x,map.groundHeight(owner.x,owner.z),owner.z);}
   if(gap>.12){pet.trail.push({x:owner.x,z:owner.z});pet.last={x:owner.x,z:owner.z};}
   if(pet.trail.length>500)pet.trail.splice(0,pet.trail.length-500);
   let remaining=0,previous=pet.root.position;
   for(const point of pet.trail){remaining+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
   const fast=remaining>4,speed=fast?8:4.3;
   let travelled=0,budget=speed*Math.min(dt,.05);
   while(remaining>1.5&&budget>0&&pet.trail.length){
    const target=pet.trail[0],pos=pet.root.position;
    const dx=target.x-pos.x,dz=target.z-pos.z,dist=Math.hypot(dx,dz);
    if(dist<.08){pet.trail.shift();continue;}
    const step=Math.min(budget,dist,remaining-1.5),nx=pos.x+dx/dist*step,nz=pos.z+dz/dist*step;
    const ox=pos.x,oz=pos.z;
    if(map.canMove(nx,nz,ox,oz)){pos.x=nx;pos.z=nz;}
    else{if(map.canMove(nx,oz,ox,oz))pos.x=nx;if(map.canMove(pos.x,nz,pos.x,oz))pos.z=nz;}
    const moved=Math.hypot(pos.x-ox,pos.z-oz);if(moved<.0001)break;
    pos.y=map.groundHeight(pos.x,pos.z);pet.root.rotation.y=Math.atan2(pos.x-ox,pos.z-oz);
    travelled+=moved;budget-=step;remaining-=moved;
   }
   pet.distance+=travelled;animateDog(pet,pet.distance,travelled>.001,fast,serverTimeMs);
   if(pet.label&&camera){
    pet.label.textContent=owner.dog_name;
    const point=pet.root.position.clone();point.y+=.95;point.project(camera);
    pet.label.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1||Math.abs(point.y)>1;
    pet.label.style.left=(point.x*.5+.5)*width+'px';pet.label.style.top=(-point.y*.5+.5)*height+'px';
   }
  }

  for(const dog of dogs){
   const {points,length}=dog.route;
   const walkDuration=length*.4/1.1,runDuration=length*.6/3.1,period=walkDuration+runDuration+3;
   const time=((serverTimeMs/1000+dog.index*3.7)%period+period)%period;
   const running=time>=walkDuration&&time<walkDuration+runDuration;
   const moving=time<walkDuration+runDuration;
   const distance=moving?(running?length*.4+(time-walkDuration)*3.1:time*1.1):0;
   const target=Math.min(distance,length-.00001);
   let segment=1;while(segment<points.length-1&&points[segment].distance<target)segment++;
   const a=points[segment-1],b=points[segment];const start=a.distance||0,t=(target-start)/(b.distance-start);
   const x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t);
   dog.root.position.set(x,map.groundHeight(x,z),z);dog.root.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
   animateDog(dog,distance,moving,running,serverTimeMs);
  }
 }};
}
