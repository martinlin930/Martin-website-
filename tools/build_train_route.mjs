// Build the centerline from the actual wooden sleepers, including all imported rotations/scales.
import * as T from '../static/vendor/three.module.js';import {readFile,writeFile} from 'node:fs/promises';import {GLTFLoader} from '../static/vendor/GLTFLoader.js';
const s=JSON.parse(await readFile('static/models/village/scene.json')),records=[];
function visit(n,parent=new T.Matrix4()){if(n.hidden)return;const p=n.position,q=n.rotation,m=new T.Matrix4().compose(new T.Vector3(p[0],p[1],-p[2]),new T.Quaternion(-q[0],-q[1],q[2],q[3]).normalize(),new T.Vector3(...n.scale)).premultiply(parent);if(n.asset){m.scale(new T.Vector3().setScalar(s.importScales[n.asset]||1));if(/traintracks/.test(s.assets[n.asset]))records.push({n,m});}for(const c of n.children||[])visit(c,m);}s.nodes.forEach(n=>visit(n));
const pieces=[];
for(const {n,m} of records){const bytes=await readFile('static/models/village/'+n.asset+'.glb'),g=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;g.updateMatrixWorld(true);const centers=[];
 g.traverse(mesh=>{if(!mesh.isMesh||mesh.material.name!=='slot_0')return;const attr=mesh.geometry.attributes.position,keys=new Map(),points=[],edges=[];const indices=[];
 for(const idx of mesh.geometry.index.array){const p=new T.Vector3().fromBufferAttribute(attr,idx).applyMatrix4(mesh.matrixWorld),key=p.toArray().map(v=>v.toFixed(5)).join(',');if(!keys.has(key)){keys.set(key,points.length);points.push(p);edges.push(new Set());}indices.push(keys.get(key));}
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){edges[indices[i+j]].add(indices[i+(j+1)%3]);edges[indices[i+(j+1)%3]].add(indices[i+j]);}
 const seen=new Set();for(let i=0;i<points.length;i++){if(seen.has(i))continue;const queue=[i],box=new T.Box3();while(queue.length){const j=queue.pop();if(seen.has(j))continue;seen.add(j);box.expandByPoint(points[j]);for(const k of edges[j])if(!seen.has(k))queue.push(k);}const center=box.getCenter(new T.Vector3());center.y=.255;centers.push(center);}
 });
 centers.sort((a,b)=>a.z-b.z);if(centers.length<2)throw Error('No sleepers '+n.name);
 const first=centers[0].clone().addScaledVector(centers[0].clone().sub(centers[1]),.5),last=centers.at(-1).clone().addScaledVector(centers.at(-1).clone().sub(centers.at(-2)),.5);
 pieces.push([first,...centers,last].map(p=>p.applyMatrix4(m)));
}
const remaining=pieces.slice(),ordered=[remaining.splice(remaining.findIndex(p=>Math.min(p[0].z,p.at(-1).z)<-240),1)[0]];if(ordered[0][0].z>ordered[0].at(-1).z)ordered[0].reverse();
while(remaining.length){let best={gap:Infinity};for(let i=0;i<remaining.length;i++)for(const reverse of [false,true]){const gap=ordered.at(-1).at(-1).distanceTo(reverse?remaining[i].at(-1):remaining[i][0]);if(gap<best.gap)best={gap,i,reverse};}const next=remaining.splice(best.i,1)[0];if(best.reverse)next.reverse();ordered.push(next);}
// Original Unity rail pieces overlap; trim each overlap instead of backtracking at a junction.
for(let i=1;i<ordered.length;i++){const a=ordered[i-1],b=ordered[i];let best={gap:Infinity};for(let j=Math.floor(a.length*.6);j<a.length;j++)for(let k=0;k<Math.ceil(b.length*.4);k++){const gap=a[j].distanceTo(b[k]);if(gap<best.gap)best={gap,j,k};}if(best.gap>1.2)throw Error('Disconnected track '+best.gap);const join=a[best.j].clone().add(b[best.k]).multiplyScalar(.5);a.splice(best.j);a.push(join);b.splice(0,best.k+1);b.unshift(join.clone());console.log('Rail connection:',best.gap.toFixed(3));}
const result=ordered.flat().filter((p,i,all)=>!i||p.distanceTo(all[i-1])>.005);await writeFile('static/train-route.json',JSON.stringify(result.map(p=>p.toArray())));console.log('Route points:',result.length);
