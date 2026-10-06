import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {galleryLighting,galleryShadows,removePhotoFrame} from './gallery-lighting.js';
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
 const [layout,response]=await Promise.all([fetch(base+'layout.json').then(r=>r.json()),fetch(base+'showroom.glb.gz')]);
 if(!response.ok)throw Error('Gallery unavailable');
 onProgress(.2);let buffer=await response.arrayBuffer();
 const magic=new Uint8Array(buffer,0,Math.min(2,buffer.byteLength));
 if(magic[0]===31&&magic[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const model=await new GLTFLoader().parseAsync(buffer,base);
 removePhotoFrame(model.scene,layout.photo);
 galleryShadows(model.scene);
 scene.add(model.scene);scene.background=new THREE.Color(0xeceae5);
 for(const b of galleryThresholds(layout)){const floor=new THREE.Mesh(new THREE.PlaneGeometry(b.max[0]-b.min[0],b.max[2]-b.min[2]),new THREE.MeshStandardMaterial({color:0xdedcd5,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.set((b.min[0]+b.max[0])/2,layout.floor,(b.min[2]+b.max[2])/2);scene.add(floor);}
 const lighting=galleryLighting(scene,{mobile:matchMedia('(pointer: coarse)').matches});
 const texture=await new THREE.TextureLoader().loadAsync(base+'martin-photo.webp');texture.colorSpace=THREE.SRGBColorSpace;
 const aspect=texture.image.width/texture.image.height,width=aspect>=1?1.13:1.13*aspect,height=aspect>=1?1.13/aspect:1.13;
 const image=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));image.position.fromArray(layout.photo);scene.add(image);
 const labelCanvas=document.createElement('canvas');labelCanvas.width=768;labelCanvas.height=128;const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#f5f3ed';ctx.fillRect(0,0,768,128);ctx.fillStyle='#242424';ctx.font='500 28px Arial';ctx.fillText('MARTIN PHOTOGRAPHY',34,49);ctx.font='22px Arial';ctx.fillText('Selected work · 01',34,91);
 const caption=new THREE.Mesh(new THREE.PlaneGeometry(.95,.16),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(labelCanvas),toneMapped:false}));caption.position.set(layout.photo[0],layout.photo[1]-.78,layout.photo[2]+.001);scene.add(caption);
 onProgress(1);const navigation=galleryNavigation(layout);navigation.updateVisibility=(camera,now)=>lighting.update(camera,now);return navigation;
}
