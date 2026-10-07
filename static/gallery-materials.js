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
  if(detail?.normal){material.normalMap=await texture(detail.normal);const strength=material.name==='Wall'?.38:material.name==='AquaPlants'?.25:.65;material.normalScale.set(strength,-strength);}
  if(detail?.ao){material.aoMap=await texture(detail.ao);material.aoMap.channel=0;material.aoMapIntensity=.75;}
  if(material.name==='Floor'){
   // Marble has a restrained polished coat over a subtly varying stone surface.
   const stone=new THREE.MeshPhysicalMaterial();
   THREE.MeshStandardMaterial.prototype.copy.call(stone,material);
   stone.roughness=.34;stone.clearcoat=.16;stone.clearcoatRoughness=.3;
   if(material.map?.image){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const context=canvas.getContext('2d');context.drawImage(material.map.image,0,0,256,256);
    const pixels=context.getImageData(0,0,256,256);
    for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(210+(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3*.15);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}
    context.putImageData(pixels,0,0);
    const surface=new THREE.CanvasTexture(canvas);surface.colorSpace=THREE.NoColorSpace;
    surface.flipY=material.map.flipY;surface.wrapS=material.map.wrapS;surface.wrapT=material.map.wrapT;
    surface.repeat.copy(material.map.repeat);surface.offset.copy(material.map.offset);surface.rotation=material.map.rotation;
    surface.anisotropy=anisotropy;stone.roughnessMap=surface;
   }
   model.traverse(mesh=>{if(mesh.isMesh){if(Array.isArray(mesh.material))mesh.material=mesh.material.map(m=>m===material?stone:m);else if(mesh.material===material)mesh.material=stone;}});
   material.dispose();
  }
  if(material.name==='Wood'||material.name==='Roof Wood')material.roughness=.62;
  if(material.name==='Statue'||material.name==='Rocks')material.roughness=.8;
  material.needsUpdate=true;
 }));
}
