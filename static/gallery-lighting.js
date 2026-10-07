import * as THREE from './vendor/three.module.js';
import {galleryShafts} from './gallery-shafts.js';

export function galleryLighting(scene,{mobile=false}={}){
 const lamps=[];
 for(const x of [-14.95,1.18,17.29]){
  const lamp=new THREE.SpotLight(0xfff4e7,175,22,.95,.55,2);
  lamp.position.set(x,7.85,-11.44);lamp.target.position.set(x,3.49,-11.44);
  lamp.castShadow=true;lamp.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  lamp.shadow.camera.near=.2;lamp.shadow.camera.far=22;
  lamp.shadow.bias=-.0002;lamp.shadow.normalBias=.045;lamp.shadow.radius=3;
  lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=true;
  scene.add(lamp,lamp.target);lamps.push(lamp);
 }
 const shafts=galleryShafts(scene);
 let previous=-1,lastUpdate=-Infinity;
 return {lamps,update(camera,now){
  shafts.update(camera);
  const closest=lamps.reduce((best,lamp,i)=>Math.abs(lamp.position.x-camera.x)<Math.abs(lamps[best].position.x-camera.x)?i:best,0);
  if(closest!==previous){if(previous>=0)lamps[previous].shadow.needsUpdate=true;lamps[closest].shadow.needsUpdate=true;previous=closest;}
  if(now-lastUpdate>=100){lamps[closest].shadow.needsUpdate=true;lastUpdate=now;}
 }};
}

export function galleryShadows(model){
 model.traverse(mesh=>{if(mesh.isMesh){
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials){if(material.name==='Floor')material.roughness=.36;else if(material.name==='Wall')material.roughness=.92;}
  mesh.castShadow=!materials.some(m=>m.transparent&&m.opacity<.95);
  mesh.receiveShadow=true;mesh.geometry.computeBoundingSphere();
 }});
}

export function galleryReflections(scene,renderer){
 if(!renderer)return;
 const studio=new THREE.Scene();studio.background=new THREE.Color(0x181b22);
 const shell=new THREE.Mesh(new THREE.BoxGeometry(18,10,18),new THREE.MeshBasicMaterial({color:0x686c73,side:THREE.BackSide}));studio.add(shell);
 for(const [x,z] of [[-4,-3],[4,-3],[-4,3],[4,3]]){
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.4),new THREE.MeshBasicMaterial({color:new THREE.Color(1,.96,.88).multiplyScalar(5)}));
  panel.position.set(x,4.8,z);panel.rotation.x=Math.PI/2;studio.add(panel);
 }
 const generator=new THREE.PMREMGenerator(renderer),environment=generator.fromScene(studio,.06,.1,60);
 scene.environment=environment.texture;scene.environmentIntensity=.4;
 studio.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});generator.dispose();
 return environment;
}

export function removePhotoFrame(model,photo){
 let removed=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.name!=='Canvas')return;
  const geometry=mesh.geometry,positions=geometry.attributes.position,indices=geometry.index;
  const inside=i=>Math.abs(positions.getX(i)-photo[0])<.63&&Math.abs(positions.getY(i)-photo[1])<.63&&Math.abs(positions.getZ(i)-photo[2])<.08;
  const kept=[];
  for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(inside(a)&&inside(b)&&inside(c)){removed++;continue;}kept.push(a,b,c);}
  geometry.setIndex(kept);
 });
 return removed;
}
