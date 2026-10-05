import * as THREE from './vendor/three.module.js';

// All fixtures glow; only the nearest fixtures use real lights to keep mobile rendering affordable.
export function createNightLights(scene,fixtures){
 const group=new THREE.Group();group.name='Village night lights';scene.add(group);
 const pixels=new Uint8Array(32*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const i=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
  pixels.set([255,214,145,Math.round(255*Math.pow(Math.max(0,1-r),3))],i);
 }
 const texture=new THREE.DataTexture(pixels,32,32);texture.needsUpdate=true;
 const haloMaterial=new THREE.SpriteMaterial({map:texture,color:0xffd392,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const bulbMaterial=new THREE.MeshBasicMaterial({color:0xffdf9e,toneMapped:false});
 const bulbGeometry=new THREE.SphereGeometry(1,8,6);
 for(const fixture of fixtures){
  const bulb=new THREE.Mesh(bulbGeometry,bulbMaterial);bulb.position.copy(fixture.position);bulb.scale.setScalar(fixture.lantern?.055:.075);group.add(bulb);
  const halo=new THREE.Sprite(haloMaterial);halo.position.copy(fixture.position);halo.scale.setScalar(fixture.lantern?.65:1);group.add(halo);
 }
 const lights=Array.from({length:Math.min(8,fixtures.length)},()=>{
  const light=new THREE.PointLight(0xffc779,0,12,2);group.add(light);return light;
 });
 const glow={value:0};
 group.visible=false;
 return {fixtures,lights,group,glow,update(night,cameraPosition){
  const brightness=THREE.MathUtils.smoothstep(night,.15,.85);
  glow.value=brightness;group.visible=brightness>.001;haloMaterial.opacity=brightness;bulbMaterial.color.set(0xffdf9e).multiplyScalar(brightness);
  if(!group.visible){lights.forEach(light=>light.intensity=0);return;}
  const nearest=fixtures.map(f=>({fixture:f,distance:f.position.distanceToSquared(cameraPosition)})).sort((a,b)=>a.distance-b.distance);
  lights.forEach((light,i)=>{const f=nearest[i].fixture;light.position.copy(f.position);light.distance=f.lantern?8:18;light.intensity=(f.lantern?24:100)*brightness;});
 }};
}
