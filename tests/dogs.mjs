import assert from 'node:assert/strict';
import {scene,village} from './village_collision.mjs';
import {createDogs} from '../static/dogs.js';
import * as THREE from '../static/vendor/three.module.js';
globalThis.self=globalThis;
THREE.TextureLoader.prototype.load=function(url,onLoad){const texture=new THREE.Texture();queueMicrotask(()=>onLoad(texture));return texture;};
const before=scene.children.length,dogs=await createDogs(scene,village);
assert.equal(dogs.count,6,'All six dogs should find safe patrol routes');
const models=scene.children.slice(before);
const previous=new Map();
for(let frame=0;frame<1200;frame++){
 dogs.update(frame*50);
 for(const dog of models){
  const {x,y,z}=dog.position;
  assert.ok(Number.isFinite(x+y+z));
  assert.ok(Math.abs(y-village.groundHeight(x,z))<.001,'Dog stays on walkable ground');
  const old=previous.get(dog);
  if(old){assert.ok(village.canMove(x,z,old.x,old.z),'Patrol must not enter buildings');assert.ok(Math.hypot(x-old.x,z-old.z)<.2,'No teleport when switching walk/run/rest');}
  previous.set(dog,{x,z});
 }
}
dogs.update(123456);const first=models.map(d=>d.position.toArray());dogs.update(456789);dogs.update(123456);
assert.deepEqual(models.map(d=>d.position.toArray()),first,'Server time gives every player the same dog positions');
console.log('Six dogs: ground support, safe routes, continuous movement and shared timing verified.');
