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
 return {count:dogs.length,update(serverTimeMs){
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
