import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

// Reuse one small model; distant water costs no draw calls or server updates.
export async function createOcean(scene,size=250){
 const source=(await new GLTFLoader().loadAsync('/static/models/ocean.glb')).scene;
 source.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(source),span=bounds.getSize(new THREE.Vector3());
 const tileSize=50,range=110,tiles=[],pieces=[];
 source.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,(p.getX(i)-bounds.min.x)/span.x*tileSize,(p.getY(i)-bounds.min.y)*.003-.6,(p.getZ(i)-bounds.min.z)/span.z*tileSize);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const original=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  const material=new THREE.MeshStandardMaterial({color:original.color,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 oceanPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n oceanPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
   shader.fragmentShader='varying vec3 oceanPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float seaDistance=length(oceanPosition.xz-cameraPosition.xz);\n if(seaDistance>=110.0)discard;\n diffuseColor.a*=1.0-smoothstep(75.0,110.0,seaDistance);');
  };
  material.customProgramCacheKey=()=> 'nearby-ocean-v1';
  pieces.push({geometry,material});
 });
 const edge=Math.ceil(size/tileSize),margin=Math.ceil(range/tileSize);
 for(let ix=-margin;ix<edge+margin;ix++)for(let iz=-edge-margin;iz<margin;iz++){
  if(ix>=0&&ix<edge&&iz>=-edge&&iz<0)continue;
  const group=new THREE.Group();group.position.set(ix*tileSize,0,iz*tileSize);group.visible=false;
  for(const piece of pieces){const mesh=new THREE.Mesh(piece.geometry,piece.material);mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=true;mesh.renderOrder=-1;group.add(mesh);}
  scene.add(group);tiles.push(group);
 }
 return {tiles,update(camera){
  for(const tile of tiles){
   const dx=Math.max(tile.position.x-camera.position.x,0,camera.position.x-tile.position.x-tileSize);
   const dz=Math.max(tile.position.z-camera.position.z,0,camera.position.z-tile.position.z-tileSize);
   tile.visible=dx*dx+dz*dz<range*range;
  }
 }};
}
