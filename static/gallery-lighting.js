import * as THREE from './vendor/three.module.js';
import {galleryShafts} from './gallery-shafts.js';

export function galleryLighting(scene,{mobile=false}={}){
 const lamps=[];
 // A single fixed sun casts the same direction of shadows throughout the gallery.
 const sunlight=new THREE.DirectionalLight(0xfff2d9,2.8);
 sunlight.target.position.set(1,3.53,-11.44);
 sunlight.position.copy(sunlight.target.position).add(new THREE.Vector3(-3.3,4.32,-3.55).multiplyScalar(9));
 sunlight.castShadow=true;sunlight.shadow.mapSize.set(mobile?2048:4096,mobile?2048:4096);
 Object.assign(sunlight.shadow.camera,{left:-30,right:30,top:20,bottom:-20,near:1,far:100});
 sunlight.shadow.bias=-.00015;sunlight.shadow.normalBias=.018;
 sunlight.shadow.camera.updateProjectionMatrix();
 sunlight.shadow.autoUpdate=false;sunlight.shadow.needsUpdate=true;
 scene.add(sunlight,sunlight.target);
 for(const x of [-14.95,1.18,17.29]){
  const lamp=new THREE.SpotLight(0xfff4e7,28,22,.95,.55,2);
  lamp.position.set(x,7.85,-11.44);lamp.target.position.set(x,3.49,-11.44);
  lamp.castShadow=false;
  scene.add(lamp,lamp.target);lamps.push(lamp);
 }
 const shafts=galleryShafts(scene);
 let lastUpdate=-Infinity;
 return {lamps,sunlight,update(camera,now){
  shafts.update(camera);
  if(now-lastUpdate>=100){sunlight.shadow.needsUpdate=true;lastUpdate=now;}
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
 scene.environment=environment.texture;scene.environmentIntensity=.3;
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
