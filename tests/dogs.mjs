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
// Follow an actual safe patrol around obstacles, then remove the owner.
const owner={id:'owner',x:models[0].position.x,z:models[0].position.z,dog_name:'雪 🐶'};
const beforePet=scene.children.length;
dogs.update(0,[owner],.05);
const companion=scene.children.at(-1);
assert.equal(scene.children.length,beforePet+1);
let old=companion.position.clone();
let maxGap=0;
for(let frame=1;frame<1600;frame++){
 const now=frame*50;
 dogs.update(now,[owner],0);
 owner.x=models[0].position.x;owner.z=models[0].position.z;
 dogs.update(now,[owner],.05);
 const pos=companion.position;
 assert.ok(village.canMove(pos.x,pos.z,old.x,old.z),'Follower avoids building collision');
 assert.ok(Math.abs(pos.y-village.groundHeight(pos.x,pos.z))<.001,'Follower stays grounded');
 assert.ok(pos.distanceTo(old)<.5,'Follower moves smoothly');
 maxGap=Math.max(maxGap,Math.hypot(pos.x-owner.x,pos.z-owner.z));old.copy(pos);
}
assert.ok(maxGap<5,'Dog keeps up with owner');
assert.ok(companion.position.distanceTo(models[0].position)<3,'Dog follows close behind');
dogs.update(90000,[]);
assert.equal(scene.children.length,beforePet,'Leaving removes the companion');
console.log('Pet following: grounded, collision-safe, continuous, keeps up and cleans up.');
