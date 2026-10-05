import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../static/vendor/three.module.js';
import {GLTFLoader} from '../static/vendor/GLTFLoader.js';
import {loadVillage} from '../static/village.js';
const root=new URL('../',import.meta.url);
globalThis.fetch=async url=>{const bytes=await readFile(new URL(url.replace(/^\//,''),root));return {json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
THREE.TextureLoader.prototype.loadAsync=async()=>new THREE.Texture();
GLTFLoader.prototype.loadAsync=async function(url){const r=await fetch(url);return this.parseAsync(await r.arrayBuffer(),'');};
const scene=new THREE.Scene();const village=await loadVillage(scene);
// Stairs are in Props and their connecting platforms are in Modular pieces.
// Sample both actual meshes; a stair-only check misses falls at the landings.
const data=await (await fetch('/static/models/village/scene.json')).json();
const bounds=await (await fetch('/static/models/village/bounds.json')).json();
const stairs=[];
function visit(node,parent=new THREE.Matrix4()){
 if(node.hidden)return;
 const p=node.position,q=node.rotation;
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(p[0],p[1],-p[2]),new THREE.Quaternion(-q[0],-q[1],q[2],q[3]).normalize(),new THREE.Vector3(...node.scale)).premultiply(parent);
 if(node.asset)matrix.scale(new THREE.Vector3().setScalar(data.importScales?.[node.asset]||1));
 if(/staircase|platform/i.test(node.name)&&node.asset)stairs.push({node,matrix});
 for(const child of node.children||[])visit(child,matrix);
}
data.nodes.forEach(n=>visit(n));
assert.equal(stairs.filter(s=>/staircase/i.test(s.node.name)).length,7);
assert.equal(stairs.filter(s=>/platform/i.test(s.node.name)).length,16);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
let checked=0;
for(const {node,matrix} of stairs){
 const b=bounds[node.asset];
 const model=(await new GLTFLoader().loadAsync("/static/models/village/"+node.asset+".glb")).scene;model.applyMatrix4(matrix);model.updateMatrixWorld(true);
 for(const side of [-.6,0,.6])for(let z=b.min[2]+.3;z<b.max[2]-.3;z+=.15){
  const p=new THREE.Vector3((b.max[0]+b.min[0])/2+side*(b.max[0]-b.min[0])/2,0,z).applyMatrix4(matrix);
  ray.set(new THREE.Vector3(p.x,100,p.z),down);
  const hit=ray.intersectObject(model,true)[0];
  if(!hit)continue;
  assert.ok(village.groundHeight(p.x,p.z)>=hit.point.y-.01,`${node.name}: feet ${village.groundHeight(p.x,p.z)} below surface ${hit.point.y} at ${p.x},${p.z}`);
  checked++;
 }
}
assert.ok(checked>30);
console.log(`Verified ${checked} walking surface samples across ${stairs.length} stairs and platforms.`);
