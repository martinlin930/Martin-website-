import * as THREE from './vendor/three.module.js';
export function nearby(x,z,p,radius=85){return (x-p.x)**2+(z-p.z)**2<=radius*radius;}
export function animationTick(actor,time,p){
 const d=Math.hypot(actor.root.position.x-p.x,actor.root.position.z-p.z);
 actor.root.visible=d<=85;
 if(d>85){if(actor.label)actor.label.hidden=true;return null;}
 const interval=d<25?33:d<50?100:250;
 if(actor.animationTime!==undefined&&time>=actor.animationTime&&time-actor.animationTime<interval)return null;
 const dt=actor.animationTime===undefined?.033:Math.min(.3,Math.max(0,(time-actor.animationTime)/1000));actor.animationTime=time;return dt;
}
export function spatialIndex(items,bounds,cellSize=24){
 const cells=new Map();for(const item of items){const b=bounds(item);
 for(let x=Math.floor(b.min.x/cellSize);x<=Math.floor(b.max.x/cellSize);x++)for(let z=Math.floor(b.min.z/cellSize);z<=Math.floor(b.max.z/cellSize);z++){
 const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);
 }}return {at(x,z){return cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[];}};
}
export function chunkInstances(matrices,geometry,size=32){
 geometry.computeBoundingBox();const chunks=new Map();
 for(const matrix of matrices){const p=geometry.boundingBox.clone().applyMatrix4(matrix).getCenter(new THREE.Vector3()),key=Math.floor(p.x/size)+','+Math.floor(p.z/size);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(matrix);}return [...chunks.values()];
}
export function updateChunks(meshes,p,radius=145){
 for(const mesh of meshes){const b=mesh.boundingBox,dx=Math.max(b.min.x-p.x,0,p.x-b.max.x),dz=Math.max(b.min.z-p.z,0,p.z-b.max.z);mesh.visible=dx*dx+dz*dz<=radius*radius;}
}
