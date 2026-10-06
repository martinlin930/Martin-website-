import assert from 'node:assert/strict';import * as T from '../static/vendor/three.module.js';import {nearby,animationTick,spatialIndex,chunkInstances,updateChunks} from '../static/nearby.js';
const p={x:0,z:0},actor={root:new T.Group(),label:{hidden:false}};let near=0,mid=0,far=0;
for(const [x,key] of [[10,'near'],[40,'mid'],[70,'far']]){actor.root.position.x=x;delete actor.animationTime;let count=0;for(let t=0;t<600000;t+=16.667)if(animationTick(actor,t,p)!==null)count++;if(key==='near')near=count;if(key==='mid')mid=count;if(key==='far')far=count;}
assert(near>mid*2&&mid>far*2);actor.root.position.x=100;assert.equal(animationTick(actor,600001,p),null);assert.equal(actor.root.visible,false);actor.root.position.x=2;assert(animationTick(actor,600300,p)!==null);assert.equal(actor.root.visible,true);
assert(nearby(85,0,p));assert(!nearby(86,0,p));
const geom=new T.BoxGeometry(8,1,8),mats=[];for(let x=-80;x<=80;x+=20)for(let z=-80;z<=80;z+=20)mats.push(new T.Matrix4().makeTranslation(x,2+(x+80)/20,z));
const chunks=chunkInstances(mats,geom),meshes=chunks.map(ms=>{const mesh=new T.InstancedMesh(geom,new T.MeshBasicMaterial(),ms.length);ms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;});assert.equal(chunks.flat().length,mats.length);
const grid=spatialIndex(meshes,m=>m.boundingBox),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);let checks=0;
for(let x=-84;x<=84;x+=2)for(let z=-84;z<=84;z+=2){ray.set(new T.Vector3(x,30,z),down);const full=ray.intersectObjects(meshes,false)[0],local=ray.intersectObjects(grid.at(x,z),false)[0];assert.equal(!!full,!!local);if(full)assert(Math.abs(full.point.y-local.point.y)<1e-9);checks++;}
updateChunks(meshes,{x:1000,z:1000});assert(meshes.every(m=>!m.visible));ray.set(new T.Vector3(0,30,0),down);assert(ray.intersectObjects(grid.at(0,0),false).length>0);updateChunks(meshes,p);assert(meshes.some(m=>m.visible));
console.log('10-minute animation test:',{near,mid,far},'; walking back restores models; all',checks,'local collision queries match full-map queries; hidden roads retain collision');
