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
// Staircase meshes are in Props, rather than Roads. Test actual transformed stair
// geometry so missing walking surfaces cannot silently regress.
const data=await (await fetch('/static/models/village/scene.json')).json();
const bounds=await (await fetch('/static/models/village/bounds.json')).json();
const stairs=[];
function visit(node,parent=new THREE.Matrix4()){
 if(node.hidden)return;
 const p=node.position,q=node.rotation;
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(p[0],p[1],-p[2]),new THREE.Quaternion(-q[0],-q[1],q[2],q[3]).normalize(),new THREE.Vector3(...node.scale)).premultiply(parent);
 if(node.asset)matrix.scale(new THREE.Vector3().setScalar(data.importScales?.[node.asset]||1));
 if(/staircase/i.test(node.name)&&node.asset)stairs.push({node,matrix});
 for(const child of node.children||[])visit(child,matrix);
}
data.nodes.forEach(n=>visit(n));
assert.equal(stairs.length,7);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
let checked=0;
for(const {node,matrix} of stairs){
 const b=bounds[node.asset];
 const model=(await new GLTFLoader().loadAsync("/static/models/village/"+node.asset+".glb")).scene;model.applyMatrix4(matrix);model.updateMatrixWorld(true);
 for(let z=b.min[2]+.3;z<b.max[2]-.3;z+=.3){
  const p=new THREE.Vector3(0,0,z).applyMatrix4(matrix);
  ray.set(new THREE.Vector3(p.x,100,p.z),down);
  const hit=ray.intersectObject(model,true)[0];
  if(!hit)continue;
  assert.ok(village.groundHeight(p.x,p.z)>=hit.point.y-.01,'Player feet must stay above the staircase surface');
  checked++;
 }
}
assert.ok(checked>30);
console.log(`Verified ${checked} staircase surface samples across ${stairs.length} staircases.`);
