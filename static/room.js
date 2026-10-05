import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export async function createRoom(scene,map){
 const cx=58,cz=-133,y=3.27,halfX=4,halfZ=3,height=3.1,group=new THREE.Group();group.position.set(cx,y,cz);scene.add(group);
 const wood=new THREE.MeshStandardMaterial({color:0x44332b,roughness:.9}),wallMat=new THREE.MeshStandardMaterial({color:0xf0e9db,roughness:.95,side:THREE.DoubleSide}),floorMat=new THREE.MeshStandardMaterial({color:0xac8760,roughness:.9});
 const colliders=[];
 function box(w,h,d,x,py,z,material,solid=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,py,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);if(solid)colliders.push({minX:cx+x-w/2,maxX:cx+x+w/2,minZ:cz+z-d/2,maxZ:cz+z+d/2});return mesh;}
 box(8.3,.6,6.3,0,-.33,0,wood,false);box(8,.08,6,0,-.04,0,floorMat,false);
 box(.18,height,6.2,-halfX,height/2,0,wallMat);box(.18,height,6.2,halfX,height/2,0,wallMat);box(8.2,height,.18,0,height/2,-halfZ,wallMat);
 box(3.3,height,.18,-2.35,height/2,halfZ,wallMat);box(3.3,height,.18,2.35,height/2,halfZ,wallMat);box(1.4,.7,.18,0,height-.35,halfZ,wallMat,false);
 // Traditional village house: deep eaves, a tiled gable roof, timber frame and shoji lattice.
 const roofMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.72}),paper=new THREE.MeshStandardMaterial({color:0xeee9d9,roughness:1}),frame=new THREE.MeshStandardMaterial({color:0x302724,roughness:.9});
 const textures=new THREE.TextureLoader();
 const [roofTexture,roofNormal,timberTexture]=await Promise.all([
  textures.loadAsync('/static/models/village/55756a4a15ece1c4fab90d7dfd96a1e2.webp'),
  textures.loadAsync('/static/models/village/a883e851d4ace5a4a8cccee5ff3f37f5.webp'),
  textures.loadAsync('/static/models/village/3e665bb629d7d854ea02e90ee6904d9e.webp')
 ]);
 roofTexture.colorSpace=THREE.SRGBColorSpace;timberTexture.colorSpace=THREE.SRGBColorSpace;
 for(const texture of [roofTexture,roofNormal]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4.6,2);}
 roofMat.map=roofTexture;roofMat.normalMap=roofNormal;roofMat.normalScale.setScalar(.8);frame.map=timberTexture;
 const rise=1.4,run=3.7,pitch=Math.atan2(rise,run),slope=Math.hypot(rise,run);
 for(const side of [-1,1]){
  const roof=box(9.2,.14,slope,0,height+rise/2,side*run/2,roofMat,false);roof.rotation.x=side*pitch;
  // Slightly lifted outer eaves give the roof its Japanese profile.
  const eave=box(9.3,.12,.48,0,height+.045,side*(run+.22),roofMat,false);eave.rotation.x=-side*.16;
  box(9.25,.14,.12,0,height-.03,side*run,frame,false);
 }
 const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,9.35,12),roofMat);ridge.rotation.z=Math.PI/2;ridge.position.y=height+rise+.06;ridge.castShadow=true;group.add(ridge);
 // Close the gable ends above the room walls.
 for(const side of [-1,1]){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([side*halfX,height,-halfZ,side*halfX,height,halfZ,side*halfX,height+rise,0],3));geometry.computeVertexNormals();
  const gable=new THREE.Mesh(geometry,wallMat);gable.castShadow=true;gable.receiveShadow=true;group.add(gable);
  const beam=box(.15,rise+.1,.15,side*(halfX+.04),height+rise/2,0,frame,false);
  for(const z of [-halfZ,0,halfZ])box(.17,height,.17,side*(halfX+.06),height/2,z,frame,false);
  box(.13,.17,6.2,side*(halfX+.1),.65,0,frame,false);
 }
 for(const z of [-halfZ-.1,halfZ+.1]){
  box(8.3,.18,.14,0,height-.05,z,frame,false);
  for(const x of [-4,-.8,.8,4])box(.14,height,.14,x,height/2,z,frame,false);
 }
 // Lower timber siding and an engawa porch outside the entrance.
 for(const x of [-2.35,2.35])box(3.3,.65,.10,x,.33,halfZ+.11,wood,false);
 box(8.2,.65,.10,0,.33,-halfZ-.11,wood,false);
 box(8.6,.10,.70,0,-.05,halfZ+.35,floorMat,false);
 for(let x=-4.2;x<=4.2;x+=.28)box(.012,.006,.70,x,.004,halfZ+.35,frame,false);
 // Opaque paper lattice windows on both sides of the entrance.
 for(const x of [-2.35,2.35]){
  box(2.25,1.45,.035,x,1.62,halfZ+.105,paper,false);
  for(let j=0;j<=6;j++)box(.045,1.52,.06,x-1.15+j*2.3/6,1.62,halfZ+.14,frame,false);
  for(let j=0;j<=3;j++)box(2.34,.045,.06,x,.88+j*.49,halfZ+.14,frame,false);
 }

 const hinge=new THREE.Group();hinge.position.set(-.7,0,halfZ+.1);group.add(hinge);const door=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.4,.1),wood);door.position.set(.7,1.2,0);door.castShadow=true;hinge.add(door);const knob=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshStandardMaterial({color:0xc4a45d,metalness:.75,roughness:.25}));knob.position.set(1.22,1.1,.085);hinge.add(knob);
 // Keep the working hinged entrance, with a traditional wooden/paper lattice panel.
 const doorPaper=new THREE.Mesh(new THREE.BoxGeometry(1.13,1.4,.024),paper);doorPaper.position.set(.7,1.53,.062);hinge.add(doorPaper);
 for(let i=0;i<=4;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.04,1.48,.035),frame);bar.position.set(.12+i*.29,1.53,.085);hinge.add(bar);}
 for(let i=0;i<=3;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(1.2,.04,.035),frame);bar.position.set(.7,.8+i*.48,.085);hinge.add(bar);}
 const lamp=new THREE.PointLight(0xffdfb0,35,10,2);lamp.position.set(0,2.7,0);group.add(lamp);
 const arrangements=[['Three Seater Couch',2.8,-2.25,-.7,Math.PI/2],['Rounded Coffee Table',1.1,-.6,-.7,0],['Double Bed',2.1,2.5,-1.3,0],['Small Bookshelf',1.1,-2.9,-2.4,0],['Floor Lamp',.45,-3.1,1.6,0],['Wool Carpet',2.5,-1,-.3,0],['Wood Kitchen Table',1.35,2.3,1.9,0],['Wood Kitchen Chair',.55,1.3,1.8,Math.PI/2],['Tv',.9,-3.75,-.5,Math.PI/2]];
 const loader=new GLTFLoader();await Promise.all(arrangements.map(async([name,width,x,z,rotation])=>{
  const model=(await loader.loadAsync('/static/models/interior/'+encodeURIComponent(name)+'.glb')).scene;model.rotation.y=rotation;model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),scale=width/Math.max(size.x,size.z);model.scale.multiplyScalar(scale);model.position.set(x-(b.min.x+b.max.x)*.5*scale,-b.min.y*scale,z-(b.min.z+b.max.z)*.5*scale);model.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});group.add(model);
  if(!['Wool Carpet','Floor Lamp','Tv'].includes(name))colliders.push({minX:cx+x-size.x*scale/2,maxX:cx+x+size.x*scale/2,minZ:cz+z-size.z*scale/2,maxZ:cz+z+size.z*scale/2});
 }));
 let open=false,target=0;
 const baseMove=map.canMove.bind(map),baseGround=map.groundHeight.bind(map);
 map.groundHeight=(x,z)=>(Math.abs(x-cx)<halfX+.08&&Math.abs(z-cz)<halfZ+.08)||(Math.abs(x-cx)<4.3&&z-cz>=halfZ&&z-cz<=halfZ+.7)?y:baseGround(x,z);
 map.canMove=(x,z,fx,fz)=>{if(colliders.some(b=>x>b.minX-.17&&x<b.maxX+.17&&z>b.minZ-.17&&z<b.maxZ+.17))return false;if(!open&&Math.abs(x-cx)<.87&&Math.abs(z-(cz+halfZ))<.27)return false;return baseMove(x,z,fx,fz);};
 return {group,colliders,door,hinge,setOpen(value){open=!!value;target=open?-Math.PI*.48:0;},near(x,z){return Math.hypot(x-cx,z-(cz+halfZ+1))<2.5;},inside(x,z){return Math.abs(x-cx)<halfX&&Math.abs(z-cz)<halfZ;},get open(){return open;},toggle(){open=!open;target=open?-Math.PI*.48:0;},update(dt){hinge.rotation.y=THREE.MathUtils.damp(hinge.rotation.y,target,8,dt);}};
}
