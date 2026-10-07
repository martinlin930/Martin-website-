import * as THREE from './vendor/three.module.js';

// Restore Unity's surface detail without adding geometry or per-frame work.
export async function galleryMaterialDetails(model,base,renderer){
 const response=await fetch(base+'material-details.json');
 if(!response.ok)throw Error('Gallery materials unavailable');
 const details=await response.json(),materials=new Set(),textures=new Map();
 model.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry.getAttribute('position').count)for(const material of [].concat(mesh.material))materials.add(material);});
 const anisotropy=Math.min(renderer?.capabilities.getMaxAnisotropy()||1,4);
 function texture(path){
  if(!textures.has(path))textures.set(path,new THREE.TextureLoader().loadAsync(base+path).then(map=>{
   map.colorSpace=THREE.NoColorSpace;map.flipY=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=anisotropy;return map;
  }));
  return textures.get(path);
 }
 await Promise.all([...materials].map(async material=>{
  const detail=details[material.name];
  if(detail?.normal){material.normalMap=await texture(detail.normal);const strength=material.name==='Wall'?.055:material.name==='AquaPlants'?.25:.65;material.normalScale.set(strength,-strength);}
  if(detail?.ao){material.aoMap=await texture(detail.ao);material.aoMap.channel=0;material.aoMapIntensity=.75;}
  if(material.name==='Wall'){
   // Fine painted plaster: remove the original broad concrete stains.
   const size=128,data=new Uint8Array(size*size*4);let seed=3917;
   for(let i=0;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const grain=(seed>>>29)-3;data[i]=238+grain;data[i+1]=236+grain;data[i+2]=230+grain;data[i+3]=255;}
   const paint=new THREE.DataTexture(data,size,size);paint.colorSpace=THREE.SRGBColorSpace;paint.wrapS=paint.wrapT=THREE.RepeatWrapping;paint.repeat.set(16,16);paint.magFilter=THREE.LinearFilter;paint.minFilter=THREE.LinearMipmapLinearFilter;paint.generateMipmaps=true;paint.anisotropy=anisotropy;paint.needsUpdate=true;
   material.map=paint;material.color.set(0xffffff);material.roughness=.78;
  }
  if(material.name==='Floor')material.roughness=.3;
  if(material.name==='Wood'||material.name==='Roof Wood')material.roughness=.62;
  if(material.name==='Statue'||material.name==='Rocks')material.roughness=.8;
  material.needsUpdate=true;
 }));
}
