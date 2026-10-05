import * as THREE from './vendor/three.module.js';
export async function createForage(scene,map){
 const spots=await fetch('/static/food-spots.json').then(r=>r.json());
 const leaf=new THREE.MeshStandardMaterial({color:0x457d32,roughness:1});
 const foodMaterial=new THREE.MeshStandardMaterial({color:0xf1ba65,roughness:.8});
 const patches=spots.map((spot,index)=>{
  const root=new THREE.Group();root.position.set(spot.x,map.groundHeight(spot.x,spot.z),spot.z);
  for(let j=0;j<9;j++){
   const blade=new THREE.Mesh(new THREE.ConeGeometry(.12,.6+(j%3)*.12,4),leaf);
   const angle=j*2.4;blade.position.set(Math.cos(angle)*.42,.28,Math.sin(angle)*.42);blade.rotation.z=Math.sin(angle)*.22;blade.castShadow=true;root.add(blade);
  }
  const bag=new THREE.Mesh(new THREE.BoxGeometry(.24,.3,.18),foodMaterial);bag.position.y=.24;bag.rotation.y=index;bag.castShadow=true;root.add(bag);
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.08),new THREE.MeshBasicMaterial({color:0xffdc83}));marker.position.y=.95;root.add(marker);
  scene.add(root);return {...spot,root,bag,marker};
 });
 return {update(time,claims,x,z){
  let nearest=null,distance=3;
  for(const patch of patches){
   const ready=time-(claims[patch.id]||0)>=120;patch.bag.visible=patch.marker.visible=ready;
   patch.marker.position.y=.95+Math.sin(time*2+Number(patch.id))*.06;patch.marker.rotation.y=time;
   const gap=Math.hypot(patch.x-x,patch.z-z);
   if(ready&&gap<distance){nearest=patch.id;distance=gap;}
  }
  return nearest;
 }};
}
