import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {GLTFLoader} from './static/vendor/GLTFLoader.js';
import {galleryLighting,galleryShadows,removePhotoFrame} from './static/gallery-lighting.js';
import * as THREE from './static/vendor/three.module.js';
import {removeGalleryFrames,galleryPhotos} from './static/gallery-photos.js';
import {normalizePictureFrame,fitPictureFrame} from './static/gallery-frame.js';
const glb=zlib.gunzipSync(fs.readFileSync('static/models/gallery/showroom.glb.gz'));
assert.equal(glb.readUInt32LE(0),0x46546c67);
assert.equal(glb.readUInt32LE(8),glb.length);
const jsonLength=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+jsonLength));
for(const im of doc.images)assert(fs.statSync('static/models/gallery/'+im.uri).size>0);
for(const m of doc.materials)delete m.pbrMetallicRoughness.baseColorTexture;
doc.images=[];doc.textures=[];
const bin=glb.subarray(28+jsonLength),encoded=Buffer.from(JSON.stringify(doc)),pad=Buffer.alloc((4-encoded.length%4)%4,32),js=Buffer.concat([encoded,pad]);
const rebuilt=Buffer.alloc(28+js.length+bin.length);
rebuilt.writeUInt32LE(0x46546c67,0);rebuilt.writeUInt32LE(2,4);rebuilt.writeUInt32LE(rebuilt.length,8);rebuilt.writeUInt32LE(js.length,12);rebuilt.writeUInt32LE(0x4e4f534a,16);js.copy(rebuilt,20);rebuilt.writeUInt32LE(bin.length,20+js.length);rebuilt.writeUInt32LE(0x004e4942,24+js.length);bin.copy(rebuilt,28+js.length);
const model=await new GLTFLoader().parseAsync(rebuilt.buffer,'');let meshes=0,triangles=0;
model.scene.traverse(m=>{if(m.isMesh){meshes++;triangles+=m.geometry.index.count/3;assert(m.geometry.attributes.normal.count===m.geometry.attributes.position.count);m.geometry.computeBoundingSphere();assert(Number.isFinite(m.geometry.boundingSphere.radius));}});
assert(meshes>50);assert(triangles>100000);
const layout=JSON.parse(fs.readFileSync('static/models/gallery/layout.json','utf8'));
const photos=JSON.parse(fs.readFileSync('static/models/gallery/photos.json','utf8'));
assert.equal(photos.length,58);
for(const photo of photos){assert(fs.statSync('static/models/gallery/'+photo.thumb).size>0);assert(fs.statSync('static/models/gallery/'+photo.full).size>0);assert(photo.aspect>0);}
assert.equal(removeGalleryFrames(model.scene,photos),1092,'All 42 original empty frames are removed');
const frameBytes=fs.readFileSync('static/models/gallery/picture-frame.glb');
const frameModel=await new GLTFLoader().parseAsync(frameBytes.buffer.slice(frameBytes.byteOffset,frameBytes.byteOffset+frameBytes.byteLength),'');
const frameTemplate=normalizePictureFrame(frameModel.scene);
assert.equal(frameTemplate.root.children.length,1,'Original dark placeholder is replaced by the photograph');
const exhibition=galleryPhotos(new THREE.Scene(),photos,'/static/models/gallery/',frameTemplate);
assert.equal(exhibition.items.length,58);assert(exhibition.nearest(-20,-17));
for(const item of exhibition.items){assert(Math.abs(item.mesh.geometry.parameters.width/item.mesh.geometry.parameters.height-item.photo.aspect)<1e-6);assert.equal(item.display.children.length,2);const fit=fitPictureFrame(frameTemplate,item.mesh.geometry.parameters.width,item.mesh.geometry.parameters.height);assert(fit.photoDepth<frameTemplate.bounds.max.z*fit.group.scale.z);}
for(let i=0;i<photos.length;i++)for(let j=i+1;j<photos.length;j++){if(photos[i].normal.every((n,k)=>n===photos[j].normal[k]))assert(new THREE.Vector3().fromArray(photos[i].position).distanceTo(new THREE.Vector3().fromArray(photos[j].position))>1.6);}
galleryShadows(model.scene);let casting=0;model.scene.traverse(m=>{if(m.isMesh&&m.castShadow)casting++;});assert(casting>50);
const lighting=galleryLighting(new THREE.Scene(),{mobile:true});assert.equal(lighting.lamps.length,3);
for(const lamp of lighting.lamps){assert(lamp.castShadow);assert.equal(lamp.shadow.mapSize.x,1024);assert.equal(lamp.shadow.autoUpdate,false);lamp.shadow.needsUpdate=false;}
lighting.update(new THREE.Vector3(-19,5,-14),0);assert(lighting.lamps[0].shadow.needsUpdate);lighting.lamps[0].shadow.needsUpdate=false;
lighting.update(new THREE.Vector3(-19,5,-14),50);assert(!lighting.lamps[0].shadow.needsUpdate);
lighting.update(new THREE.Vector3(-19,5,-14),100);assert(lighting.lamps[0].shadow.needsUpdate);
lighting.lamps[0].shadow.needsUpdate=false;lighting.update(new THREE.Vector3(18,5,-14),110);assert(lighting.lamps[0].shadow.needsUpdate);assert(lighting.lamps[2].shadow.needsUpdate);
console.log('Gallery geometry loaded:',meshes,'meshes,',triangles,'triangles; all texture files present.');
