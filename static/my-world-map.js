import * as THREE from './vendor/three.module.js';
const base='/static/models/my-world/';
async function unpack(path){const response=await fetch(base+path);if(!response.ok)throw Error('地图下载失败');let buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);if(bytes[0]===31&&bytes[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return buffer;}
export async function loadMyWorld(scene,onProgress=()=>{}){
 const [meta,navBuffer,textures]=await Promise.all([fetch(base+'map.json').then(r=>{if(!r.ok)throw Error('地图不可用');return r.json();}),unpack('navigation.bin.gz'),Promise.all([0,1].map(i=>new THREE.TextureLoader().loadAsync(base+'atlas-'+i+'.png').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapNearestFilter;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})))]);
 const length=new DataView(navBuffer).getUint32(0,true),nav=JSON.parse(new TextDecoder().decode(new Uint8Array(navBuffer,4,length))),start=4+length,count=nav.width*nav.height+1;
 const offsets=new Uint32Array(navBuffer.slice(start,start+count*4)),heights=new Int16Array(navBuffer.slice(start+count*4));
 function levels(x,z){const ix=Math.floor(x+1e-4)-nav.minX,iz=Math.floor(z+1e-4)-nav.minZ;if(ix<0||iz<0||ix>=nav.width||iz>=nav.height)return null;const i=iz*nav.width+ix;return heights.subarray(offsets[i],offsets[i+1]);}
 function ground(x,z,ceiling){const cell=levels(x,z);if(!cell)return null;for(let i=cell.length-1;i>=0;i--){const y=cell[i]/32;if(y<=ceiling+.001)return y;}return null;}
 function canMove(x,z,y){for(const [dx,dz] of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){const floor=ground(x+dx,z+dz,y+.55);if(floor===null||floor<y-1.25)return false;const cell=levels(x+dx,z+dz);if(cell.some(v=>v/32>y+.55&&v/32<y+1.7))return false;}return true;}
 const materials=new Map();function material(atlas,kind){const key=atlas+'|'+kind;if(!materials.has(key))materials.set(key,new THREE.MeshBasicMaterial({map:textures[atlas],side:THREE.DoubleSide,alphaTest:kind==='cutout'?.45:kind==='water'?.02:0,transparent:kind==='water',opacity:kind==='water'?.8:1,depthWrite:kind!=='water',toneMapped:false}));return materials.get(key);}
 const radius=matchMedia('(pointer:coarse)').matches?75:105;
 const loaded=new Map(),pending=new Set(),failed=new Map();let current=new THREE.Vector3(...meta.spawn),disposed=false,inFlight=0,last=-Infinity;
 async function chunk(info){const key=info.file;if(loaded.has(key)||pending.has(key))return;pending.add(key);inFlight++;
 try{const buffer=await unpack(key),length=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),begin=4+length,group=new THREE.Group();
 for(const part of header){let at=begin+part.offset;const positions=new Uint16Array(buffer.slice(at,at+part.vertices*6));at+=part.vertices*6;const uv=new Uint16Array(buffer.slice(at,at+part.vertices*4));at+=part.vertices*4;const indices=new Uint32Array(buffer.slice(at,at+part.indices*4));
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2,true));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();
 const mesh=new THREE.Mesh(geometry,material(part.atlas,part.kind));mesh.position.fromArray(part.origin);mesh.scale.setScalar(1/256);group.add(mesh);}
 if(disposed){group.traverse(m=>{if(m.isMesh)m.geometry.dispose();});return;}scene.add(group);loaded.set(key,{group,info});failed.delete(key);onProgress(loaded.size);
 }catch(error){failed.set(key,performance.now()+5000);console.warn('Region load failed',key,error);}finally{pending.delete(key);inFlight--;}}
 const distance=info=>Math.hypot((info.x+.5)*64-current.x,(info.z+.5)*64-current.z);
 function update(position,now){current.copy(position);if(now-last<250)return;last=now;
 for(const [key,item] of loaded)if(distance(item.info)>radius+50){scene.remove(item.group);item.group.traverse(m=>{if(m.isMesh)m.geometry.dispose();});loaded.delete(key);}
 for(const info of meta.chunks.filter(i=>distance(i)<radius).sort((a,b)=>distance(a)-distance(b))){if(inFlight>=2)break;if(!loaded.has(info.file)&&!pending.has(info.file)&&(failed.get(info.file)||0)<=now)chunk(info);}
 }
 const first=meta.chunks.find(c=>c.x===Math.floor(meta.spawn[0]/64)&&c.z===Math.floor(meta.spawn[2]/64));if(!first)throw Error('缺少出生区域');await chunk(first);if(!loaded.has(first.file))throw Error('出生区域加载失败');update(current,0);
 return {spawn:meta.spawn,ground,canMove,update,loaded,meta,readyAt(x,z){return loaded.has(meta.chunks.find(c=>c.x===Math.floor(x/64)&&c.z===Math.floor(z/64))?.file);},dispose(){disposed=true;for(const item of loaded.values()){scene.remove(item.group);item.group.traverse(m=>{if(m.isMesh)m.geometry.dispose();});}loaded.clear();materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
