import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
const base='/static/models/village/';
export async function loadVillage(scene,onProgress=()=>{}){
 const [data,terrain,binary,bounds]=await Promise.all([
  fetch(base+'scene.json').then(r=>r.json()),fetch(base+'terrain.json').then(r=>r.json()),
  fetch(base+'terrain.bin').then(r=>r.arrayBuffer()),fetch(base+'bounds.json').then(r=>r.json())
 ]);
 const heights=new Float32Array(binary),n=terrain.resolution,size=terrain.size;
 const groundHeight=(x,z)=>{
  const gx=THREE.MathUtils.clamp(x/size*(n-1),0,n-1),gz=THREE.MathUtils.clamp(-z/size*(n-1),0,n-1);
  const ix=Math.min(n-2,Math.floor(gx)),iz=Math.min(n-2,Math.floor(gz)),fx=gx-ix,fz=gz-iz;
  const a=heights[iz*n+ix]*(1-fx)+heights[iz*n+ix+1]*fx,b=heights[(iz+1)*n+ix]*(1-fx)+heights[(iz+1)*n+ix+1]*fx;
  return a*(1-fz)+b*fz+.08;
 };
 const geometry=new THREE.PlaneGeometry(size,size,n-1,n-1);geometry.rotateX(-Math.PI/2);geometry.translate(size/2,0,-size/2);
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++)positions.setY(i,groundHeight(positions.getX(i),positions.getZ(i))-.08);
 geometry.computeVertexNormals();
 const textureLoader=new THREE.TextureLoader(),textureCache=new Map();
 const groundTexture=await textureLoader.loadAsync(base+'ground.webp');groundTexture.colorSpace=THREE.SRGBColorSpace;
 const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:groundTexture,roughness:1}));ground.receiveShadow=true;scene.add(ground);
 const sky=await textureLoader.loadAsync(base+'sky.webp');sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;
 const materialCache=new Map(),texturePromises=[];
 function material(guid){
  if(materialCache.has(guid))return materialCache.get(guid);
  const info={...(data.materials[guid]||{color:[.65,.65,.65]})};if(/leaves/i.test(info.name||''))info.cutout=true;const m=new THREE.MeshStandardMaterial({color:new THREE.Color().fromArray(info.color),roughness:.92,side:info.cutout?THREE.DoubleSide:THREE.FrontSide,alphaTest:info.cutout?info.cutoff:0,transparent:!!info.transparent});
  if(info.texture){const textureKey=info.texture+JSON.stringify([info.scale,info.offset]);let t=textureCache.get(textureKey);if(!t){t=new THREE.Texture();texturePromises.push(textureLoader.loadAsync(base+info.texture+'.webp').then(loaded=>{t.image=loaded.image;t.needsUpdate=true;}));t.flipY=true;t.repeat.fromArray(info.scale||[1,1]);t.offset.fromArray(info.offset||[0,0]);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;textureCache.set(textureKey,t);}m.map=t;}
  materialCache.set(guid,m);return m;
 }
 const records=[],obstacles=[];
 function visit(node,parent=new THREE.Matrix4()){
  if(node.hidden)return;
  const p=node.position,q=node.rotation,s=node.scale;
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(p[0],p[1],-p[2]),new THREE.Quaternion(-q[0],-q[1],q[2],q[3]).normalize(),new THREE.Vector3(...s)).premultiply(parent);
  if(node.asset){records.push({node,matrix});const b=bounds[node.asset];if(b&&/\/Buildings\//.test(data.assets[node.asset]))obstacles.push({inverse:matrix.clone().invert(),min:new THREE.Vector3(...b.min),max:new THREE.Vector3(...b.max)});}
  for(const child of node.children||[])visit(child,matrix);
 }
 data.nodes.forEach(node=>visit(node));
 const models=new Map(),ids=Object.keys(data.assets),loader=new GLTFLoader();let cursor=0,complete=0;
 await Promise.all(Array.from({length:6},async()=>{while(cursor<ids.length){const id=ids[cursor++];const g=await loader.loadAsync(base+id+'.glb');g.scene.updateMatrixWorld(true);models.set(id,g.scene);onProgress(++complete/ids.length);}}));
 const batches=new Map();
 for(const{node,matrix}of records){models.get(node.asset)?.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;const slot=source.name.match(/slot_(\d+)/)?.[1]||'0';const guid=node.materials[slot];if(/invisible/i.test(data.materials[guid]?.name||''))return;const key=mesh.geometry.uuid+'-'+guid;
  if(!batches.has(key))batches.set(key,{geometry:mesh.geometry,material:material(guid),matrices:[],shadow:/\/(Buildings|Nature|Props)\//.test(data.assets[node.asset])&&!/grass|weeds|cornplant|riceplant/i.test(node.name)});
  batches.get(key).matrices.push(matrix.clone().multiply(mesh.matrixWorld));
 });}
 for(const batch of batches.values()){
  const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);
  batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();mesh.castShadow=batch.shadow;mesh.receiveShadow=true;scene.add(mesh);
 }
 // Wait for the maps requested by material() before opening the world.
 await Promise.all(texturePromises);
 const point=new THREE.Vector3();
 return {spawn:terrain.spawn,yaw:terrain.yaw,groundHeight,canMove(x,z,fromX,fromZ){
  if(x<1||x>size-1||z> -1||z<1-size)return false;
  const y=groundHeight(x,z);if(y-groundHeight(fromX,fromZ)>.45)return false;
  for(const o of obstacles){point.set(x,y+.8,z).applyMatrix4(o.inverse);if(point.y>o.min.y&&point.y<o.max.y&&point.x>o.min.x+.15&&point.x<o.max.x-.15&&point.z>o.min.z+.15&&point.z<o.max.z-.15)return false;}
  return true;
 }};
}
