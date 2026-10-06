import * as THREE from './vendor/three.module.js';

export function removeGalleryFrames(model,photos){
 let removed=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.name!=='Canvas')return;
  const geometry=mesh.geometry,positions=geometry.attributes.position,indices=geometry.index,kept=[];
  const inside=(i,b)=>[0,1,2].every(axis=>positions.getComponent(i,axis)>=b.min[axis]-.001&&positions.getComponent(i,axis)<=b.max[axis]+.001);
  for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(photos.some(p=>p.frame&&inside(a,p.frame)&&inside(b,p.frame)&&inside(c,p.frame))){removed++;continue;}kept.push(a,b,c);}
  geometry.setIndex(kept);
 });return removed;
}

export function galleryPhotos(scene,photos,base){
 const loader=new THREE.TextureLoader(),items=photos.map(photo=>{
  const width=photo.aspect>=1?1.25:1.25*photo.aspect,height=photo.aspect>=1?1.25/photo.aspect:1.25;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:0xe9e6df,toneMapped:false}));
  mesh.position.fromArray(photo.position);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3().fromArray(photo.normal));scene.add(mesh);
  return {photo,mesh,loaded:false,loading:false};
 });let last=-Infinity,inFlight=0;
 function update(camera,now){
  if(now-last<250)return;last=now;
  const candidates=items.filter(i=>!i.loaded&&!i.loading&&i.mesh.position.distanceTo(camera)<19).sort((a,b)=>a.mesh.position.distanceTo(camera)-b.mesh.position.distanceTo(camera));
  for(const item of candidates){if(inFlight>=4)break;item.loading=true;inFlight++;
   loader.load(base+item.photo.thumb,texture=>{texture.colorSpace=THREE.SRGBColorSpace;item.mesh.material.map=texture;item.mesh.material.color.set(0xffffff);item.mesh.material.needsUpdate=true;item.loaded=true;item.loading=false;inFlight--;},undefined,()=>{item.loading=false;inFlight--;});
  }
 }
 function nearest(x,z,yaw,pitch){
  if(Number.isFinite(yaw)&&Number.isFinite(pitch)){
   const direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
   const ray=new THREE.Raycaster(new THREE.Vector3(x,5.13906,z),direction,0,7);
   const hit=ray.intersectObjects(items.map(i=>i.mesh))[0];
   if(hit)return items.find(i=>i.mesh===hit.object).photo;
  }
  let best=null,distance=3;
  for(const item of items){const d=Math.hypot(x-item.photo.position[0],z-item.photo.position[2]);if(d<distance){distance=d;best=item.photo;}}
  return best;
 }
 return {update,nearest,items};
}
