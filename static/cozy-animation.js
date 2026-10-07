import * as THREE from './vendor/three.module.js';
import {createCozyCharacter} from './cozy-characters.js';
import {loadCozyCharacter} from './cozy-imported.js';

export async function createAnimationWorld(scene){
 const ink='#64433e',materials=new Map(),blockers=[],characters=[];
 const geometry={sphere:new THREE.SphereGeometry(1,24,16),box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,20),cone:new THREE.ConeGeometry(1,1,24),cap:new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2)};
 const outline=new THREE.MeshBasicMaterial({color:ink,side:THREE.BackSide,toneMapped:false});let meshes=0;
 function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshBasicMaterial({color,toneMapped:false}));return materials.get(color);}
 function shape(type,color,position,scale,parent=scene,stroke=true){const mesh=new THREE.Mesh(geometry[type],material(color));mesh.position.set(...position);mesh.scale.set(...scale);parent.add(mesh);meshes++;
  if(stroke){const edge=new THREE.Mesh(geometry[type],outline);edge.scale.setScalar(1.035);mesh.add(edge);}return mesh;}
 let seed=195;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 const sky=document.createElement('canvas');sky.width=512;sky.height=256;const ctx=sky.getContext('2d');ctx.fillStyle='#b9e1f0';ctx.fillRect(0,0,512,256);
 for(let i=0;i<2000;i++){ctx.fillStyle=i%2?'#ffffff06':'#8bbacf05';ctx.beginPath();ctx.arc(random()*512,random()*256,2+random()*20,0,Math.PI*2);ctx.fill();}
 const background=new THREE.CanvasTexture(sky);background.colorSpace=THREE.SRGBColorSpace;scene.background=background;scene.fog=new THREE.Fog('#b9e1f0',65,125);
 shape('cylinder','#f7f2df',[0,-.25,0],[58,.5,58],scene,false);
 // Open cream-coloured clearing, with low scalloped bushes around its edges.
 for(let i=0;i<34;i++){const a=i*Math.PI*2/34,r=27+random()*4,x=Math.sin(a)*r,z=Math.cos(a)*r,g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  for(let j=0;j<4;j++)shape('sphere',j%2?'#9ac391':'#afd1a0',[(j-1.5)*.9,.7+random()*.4,0],[.9,1.1,.65],g);
 }
 for(let i=0;i<20;i++){const a=i*Math.PI*2/20,x=Math.sin(a)*39,z=Math.cos(a)*39;shape('cylinder','#f1e3d6',[x,3.5,z],[.62,7,.62]);
  for(let j=0;j<3;j++)shape('box',ink,[x+(j-1)*.25,2+j*1.5,z+.63],[.035,.8+random(),.025],scene,false);
  shape('sphere','#a4cbb4',[x,7.4,z],[3.1,2.5,2.2]);blockers.push({x,z,rx:.7,rz:.7});
 }
 for(let i=0;i<14;i++){const a=i*Math.PI*2/14;shape('cone','#b5afc4',[Math.sin(a)*66,4,Math.cos(a)*66],[18,16,13]);}
 for(let i=0;i<10;i++){const a=i*Math.PI*2/10,g=new THREE.Group();g.position.set(Math.sin(a)*49,15+random()*8,Math.cos(a)*49);scene.add(g);for(let j=0;j<4;j++)shape('sphere','#f8fcfc',[(j-1.5)*1.6,j%2*.3,0],[2.1,.65,1],g,false);}
 for(let i=0;i<65;i++){const x=(random()-.5)*60,z=(random()-.5)*60;if(Math.hypot(x,z)<3)continue;const grass=new THREE.Group();grass.position.set(x,.01,z);scene.add(grass);
  shape('sphere','#c5dab0',[0,0,0],[.35,.015,.22],grass,false);
  for(let j=0;j<3;j++){const blade=shape('cylinder',ink,[(j-1)*.11,.075,0],[.024,.16,.024],grass,false);blade.rotation.z=(1-j)*.4;}
 }
 for(let i=0;i<24;i++){const x=(random()-.5)*54,z=(random()-.5)*54;shape('sphere',ink,[x,.012,z],[.12+random()*.15,.008,.025],scene,false);}
 function house(x,z,color){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);shape('sphere','#fff9ed',[0,1.8,0],[3.2,2.1,2.7],g);shape('cap',color,[0,2.6,0],[3.5,1.2,3],g);shape('box','#c8a285',[0,.9,2.55],[1.2,1.8,.1],g);for(const px of [-1.9,1.9])shape('sphere','#a8d0da',[px,1.7,2.35],[.5,.55,.09],g);blockers.push({x,z,rx:3.35,rz:2.8});}
 house(-18,-14,'#dfb1ba');house(18,-16,'#92b8ce');
 // A wooded clearing with a stump, matching the quieter forest reference.
 const stump=shape('cylinder','#c6a080',[-12,.45,4],[1,.9,1]);shape('cylinder','#e8c6a0',[-12,.91,4],[.93,.025,.93],scene,false);blockers.push({x:-12,z:4,rx:1.2,rz:1.2});
 scene.add(new THREE.HemisphereLight(0xfffaf3,0xc8c3bf,2.7));
 const keyLight=new THREE.DirectionalLight(0xfff6e9,2.5);keyLight.position.set(-5,8,6);scene.add(keyLight);
 async function character(kind,x,z){const model=kind==='cat'?createCozyCharacter(kind):await loadCozyCharacter(kind),g=model.root;g.position.set(x,0,z);scene.add(g);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,24),new THREE.MeshBasicMaterial({color:ink,transparent:true,opacity:.18,depthWrite:false,toneMapped:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.6;shadow.position.set(x,.008,z);scene.add(shadow);
  characters.push({g,limbs:model.limbs,shadow,x,z});blockers.push({x,z,rx:.85,rz:.7});
 }
 await Promise.all([character('bear',-2.3,7),character('rabbit',0,6.8),character('cat',2.3,7)]);
 // Batch static outlines, grass and scenery; animated character parts stay separate.
 scene.updateMatrixWorld(true);const batches=new Map();
 scene.traverse(mesh=>{if(!mesh.isMesh||mesh.material.transparent)return;let ancestor=mesh;while(ancestor){if(ancestor.userData.animated)return;ancestor=ancestor.parent;}
  const key=mesh.geometry.uuid+'|'+mesh.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({mesh,matrix:mesh.matrixWorld.clone()});
 });
 for(const entries of batches.values()){if(entries.length<2)continue;const first=entries[0].mesh,instances=new THREE.InstancedMesh(first.geometry,first.material,entries.length);entries.forEach(({mesh,matrix},index)=>{instances.setMatrixAt(index,matrix);mesh.parent.remove(mesh);});instances.computeBoundingSphere();scene.add(instances);}
 return {blockers,meshes,update(time){for(let i=0;i<characters.length;i++){const c=characters[i];c.g.position.y=Math.max(0,Math.sin(time*2+i*.5))*.08;c.g.rotation.y=Math.sin(time*.6+i)*.12;for(let j=0;j<c.limbs.length;j++)c.limbs[j].rotation.x=Math.sin(time*2+i+j)*.1;}},characters};
}
