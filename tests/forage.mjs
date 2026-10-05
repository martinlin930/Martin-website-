import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scene,village} from './village_collision.mjs';
import * as THREE from '../static/vendor/three.module.js';
const spots=JSON.parse(fs.readFileSync(new URL('../static/food-spots.json',import.meta.url)));
const ray=new THREE.Raycaster(),ground=scene.children[0];ground.updateMatrixWorld(true);
assert.equal(spots.length,10);
for(const spot of spots)for(const [dx,dz] of [[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]]){
 const x=spot.x+dx,z=spot.z+dz;
 assert.ok(village.canMove(x,z,x,z),'Food patches must be accessible');
 ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObject(ground)[0];
 assert.ok(hit,'Ground supports food patch');
 assert.ok(Math.abs(village.groundHeight(x,z)-hit.point.y-.08)<.06,'Grass stays off elevated roads and platforms');
}
console.log('Ten forage patches have ground support and safe access away from road surfaces.');
