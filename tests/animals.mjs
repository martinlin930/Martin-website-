import assert from 'node:assert/strict';
const nativeFetch=globalThis.fetch;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1});
const {scene,village}=await import('./village_collision.mjs');
const localFetch=globalThis.fetch;globalThis.fetch=(url,...args)=>String(url).startsWith('blob:')?nativeFetch(url,...args):localFetch(url,...args);
const {createAnimals}=await import('../static/animals.js');
const before=scene.children.length,animals=await createAnimals(scene,village),roots=scene.children.slice(before);
assert.equal(roots.length,7);
let skinned=0;for(const root of roots)root.traverse(m=>{if(m.isSkinnedMesh)skinned++;});assert.ok(skinned>=7);
for(let frame=0;frame<180;frame++){animals.update(frame*150,[],.016,null,0,0);for(const root of roots){assert.ok(root.position.toArray().every(Number.isFinite));assert.ok(Math.abs(root.position.y-village.groundHeight(root.position.x,root.position.z))<.01);}}
console.log('Loaded seven rigged animals and verified animation and terrain-safe patrols.');
