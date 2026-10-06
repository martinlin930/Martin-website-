import * as THREE from './vendor/three.module.js';

export function galleryLighting(scene,{mobile=false}={}){
 const lamps=[];
 for(const x of [-14.95,1.18,17.29]){
  const lamp=new THREE.SpotLight(0xfff2df,115,22,1.17,.55,2);
  lamp.position.set(x,7.85,-11.44);lamp.target.position.set(x,3.49,-11.44);
  lamp.castShadow=true;lamp.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  lamp.shadow.camera.near=.2;lamp.shadow.camera.far=22;
  lamp.shadow.bias=-.00012;lamp.shadow.normalBias=.025;
  lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=true;
  scene.add(lamp,lamp.target);lamps.push(lamp);
 }
 // Small wall washes illuminate the art without removing furniture shadows.
 for(const x of [-21,-8.4,-5.8,8.1,10.4,24]){
  const lamp=new THREE.PointLight(0xfff3e4,12,7,2);
  lamp.position.set(x,7.6,-15.8);scene.add(lamp);
 }
 let previous=-1,lastUpdate=-Infinity;
 return {lamps,update(camera,now){
  const closest=lamps.reduce((best,lamp,i)=>Math.abs(lamp.position.x-camera.x)<Math.abs(lamps[best].position.x-camera.x)?i:best,0);
  if(closest!==previous){if(previous>=0)lamps[previous].shadow.needsUpdate=true;lamps[closest].shadow.needsUpdate=true;previous=closest;}
  if(now-lastUpdate>=100){lamps[closest].shadow.needsUpdate=true;lastUpdate=now;}
 }};
}

export function galleryShadows(model){
 model.traverse(mesh=>{if(mesh.isMesh){
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  mesh.castShadow=!materials.some(m=>m.transparent&&m.opacity<.95);
  mesh.receiveShadow=true;mesh.geometry.computeBoundingSphere();
 }});
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
