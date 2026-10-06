import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {galleryLighting,galleryShadows,galleryReflections} from './gallery-lighting.js';
import {galleryPhotos,removeGalleryFrames} from './gallery-photos.js';
import {normalizePictureFrame} from './gallery-frame.js';
const base='/static/models/gallery/';

export function galleryNavigation(layout){
 const floors=[...layout.floors,...galleryThresholds(layout)],blocks=layout.blockers,radius=.24;
 const onFloor=(x,z)=>floors.some(b=>x>=b.min[0]-.03&&x<=b.max[0]+.03&&z>=b.min[2]-.03&&z<=b.max[2]+.03);
 function clearSegment(x,z,fromX,fromZ){
  for(const b of blocks){
   if(b.min[1]>=layout.floor+1.8||b.max[1]<=layout.floor+.3)continue;
   const minX=b.min[0]-radius,maxX=b.max[0]+radius,minZ=b.min[2]-radius,maxZ=b.max[2]+radius;
   if(x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ)return false;
   const dx=x-fromX,dz=z-fromZ;let enter=0,exit=1;
   for(const [start,delta,min,max] of [[fromX,dx,minX,maxX],[fromZ,dz,minZ,maxZ]]){
    if(Math.abs(delta)<1e-9){if(start<min||start>max){enter=2;break;}}
    else{const a=(min-start)/delta,c=(max-start)/delta;enter=Math.max(enter,Math.min(a,c));exit=Math.min(exit,Math.max(a,c));}
   }
   if(enter<=exit&&exit>=0&&enter<=1)return false;
  }
  return true;
 }
 return {spawn:layout.spawn,yaw:layout.yaw,size:60,groundHeight:()=>layout.floor,
  canMove(x,z,fromX,fromZ){return Number.isFinite(x)&&Number.isFinite(z)&&onFloor(x,z)&&clearSegment(x,z,fromX,fromZ);},
  updateVisibility(){},nightLights:{update(){}},nearPhoto(x,z){return Math.hypot(x-layout.photo[0],z-layout.photo[2])<3.5;}};
}

function galleryThresholds(layout){
 return [[-7.0762,-6.6830],[9.0350,9.4283]].map(([a,b])=>({min:[a,layout.floor,-13.868],max:[b,layout.floor,-9.0144]}));
}

export async function loadGallery(scene,onProgress=()=>{},renderer){
 const [layout,response,photos,frame]=await Promise.all([fetch(base+'layout.json').then(r=>r.json()),fetch(base+'showroom.glb.gz'),fetch(base+'photos.json').then(r=>r.json()),new GLTFLoader().loadAsync(base+'picture-frame.glb')]);
 if(!response.ok)throw Error('Gallery unavailable');
 onProgress(.2);let buffer=await response.arrayBuffer();
 const magic=new Uint8Array(buffer,0,Math.min(2,buffer.byteLength));
 if(magic[0]===31&&magic[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const model=await new GLTFLoader().parseAsync(buffer,base);
 removeGalleryFrames(model.scene,photos);
 galleryShadows(model.scene);
 scene.add(model.scene);scene.background=new THREE.Color(0xeceae5);
 galleryReflections(scene,renderer);
 for(const b of galleryThresholds(layout)){const floor=new THREE.Mesh(new THREE.PlaneGeometry(b.max[0]-b.min[0],b.max[2]-b.min[2]),new THREE.MeshStandardMaterial({color:0xdedcd5,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.set((b.min[0]+b.max[0])/2,layout.floor,(b.min[2]+b.max[2])/2);scene.add(floor);}
 const lighting=galleryLighting(scene,{mobile:matchMedia('(pointer: coarse)').matches});
 const exhibition=galleryPhotos(scene,photos,base,normalizePictureFrame(frame.scene));
 exhibition.update(new THREE.Vector3(layout.spawn[0],layout.floor+1.65,layout.spawn[1]),0);
 onProgress(1);const navigation=galleryNavigation(layout);navigation.updateVisibility=(camera,now)=>{lighting.update(camera,now);exhibition.update(camera,now);};navigation.nearestPhoto=(x,z,yaw,pitch)=>exhibition.nearest(x,z,yaw,pitch);navigation.nearPhoto=(x,z)=>!!exhibition.nearest(x,z);return navigation;
}
