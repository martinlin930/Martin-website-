import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export async function createRoom(scene,map){
 const cx=58,cz=-133,y=3.27,halfX=4,halfZ=3,height=3.1,group=new THREE.Group();group.position.set(cx,y,cz);scene.add(group);
 const wood=new THREE.MeshStandardMaterial({color:0x8b6345,roughness:.9}),wallMat=new THREE.MeshStandardMaterial({color:0xe6dfce,roughness:.95,side:THREE.DoubleSide}),floorMat=new THREE.MeshStandardMaterial({color:0xac8760,roughness:.9});
 const colliders=[];
 function box(w,h,d,x,py,z,material,solid=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,py,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);if(solid)colliders.push({minX:cx+x-w/2,maxX:cx+x+w/2,minZ:cz+z-d/2,maxZ:cz+z+d/2});return mesh;}
 box(8.3,.6,6.3,0,-.33,0,wood,false);box(8,.08,6,0,-.04,0,floorMat,false);
 box(.18,height,6.2,-halfX,height/2,0,wallMat);box(.18,height,6.2,halfX,height/2,0,wallMat);box(8.2,height,.18,0,height/2,-halfZ,wallMat);
 box(3.3,height,.18,-2.35,height/2,halfZ,wallMat);box(3.3,height,.18,2.35,height/2,halfZ,wallMat);box(1.4,.7,.18,0,height-.35,halfZ,wallMat,false);
 box(8.6,.18,6.6,0,height+.09,0,wood,false);
 const hinge=new THREE.Group();hinge.position.set(-.7,0,halfZ+.1);group.add(hinge);const door=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.4,.1),wood);door.position.set(.7,1.2,0);door.castShadow=true;hinge.add(door);const knob=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshStandardMaterial({color:0xc4a45d,metalness:.75,roughness:.25}));knob.position.set(1.22,1.1,.085);hinge.add(knob);
 const lamp=new THREE.PointLight(0xffdfb0,35,10,2);lamp.position.set(0,2.7,0);group.add(lamp);
 const arrangements=[['Three Seater Couch',2.8,-2.25,-.7,Math.PI/2],['Rounded Coffee Table',1.1,-.6,-.7,0],['Double Bed',2.1,2.5,-1.3,0],['Small Bookshelf',1.1,-2.9,-2.4,0],['Floor Lamp',.45,-3.1,1.6,0],['Wool Carpet',2.5,-1,-.3,0],['Wood Kitchen Table',1.35,2.3,1.9,0],['Wood Kitchen Chair',.55,1.3,1.8,Math.PI/2],['Tv',.9,-3.75,-.5,Math.PI/2]];
 const loader=new GLTFLoader();await Promise.all(arrangements.map(async([name,width,x,z,rotation])=>{
  const model=(await loader.loadAsync('/static/models/interior/'+encodeURIComponent(name)+'.glb')).scene;model.rotation.y=rotation;model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),scale=width/Math.max(size.x,size.z);model.scale.multiplyScalar(scale);model.position.set(x-(b.min.x+b.max.x)*.5*scale,-b.min.y*scale,z-(b.min.z+b.max.z)*.5*scale);model.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});group.add(model);
  if(!['Wool Carpet','Floor Lamp','Tv'].includes(name))colliders.push({minX:cx+x-size.x*scale/2,maxX:cx+x+size.x*scale/2,minZ:cz+z-size.z*scale/2,maxZ:cz+z+size.z*scale/2});
 }));
 let open=false,target=0;
 const baseMove=map.canMove.bind(map),baseGround=map.groundHeight.bind(map);
 map.groundHeight=(x,z)=>Math.abs(x-cx)<halfX+.08&&Math.abs(z-cz)<halfZ+.08?y:baseGround(x,z);
 map.canMove=(x,z,fx,fz)=>{if(colliders.some(b=>x>b.minX-.17&&x<b.maxX+.17&&z>b.minZ-.17&&z<b.maxZ+.17))return false;if(!open&&Math.abs(x-cx)<.87&&Math.abs(z-(cz+halfZ))<.27)return false;return baseMove(x,z,fx,fz);};
 return {group,colliders,door,hinge,setOpen(value){open=!!value;target=open?-Math.PI*.48:0;},near(x,z){return Math.hypot(x-cx,z-(cz+halfZ+1))<2.5;},inside(x,z){return Math.abs(x-cx)<halfX&&Math.abs(z-cz)<halfZ;},get open(){return open;},toggle(){open=!open;target=open?-Math.PI*.48:0;},update(dt){hinge.rotation.y=THREE.MathUtils.damp(hinge.rotation.y,target,8,dt);}};
}
