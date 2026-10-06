import fs from 'node:fs';
import assert from 'node:assert/strict';
import {galleryNavigation} from './static/gallery-map.js';
const layout=JSON.parse(fs.readFileSync('static/models/gallery/layout.json','utf8'));
const nav=galleryNavigation(layout),[sx,sz]=layout.spawn;
assert(nav.canMove(sx,sz,sx,sz));
assert(!nav.canMove(100,100,sx,sz));
const queue=[[sx,sz]],seen=new Set([`${sx},${sz}`]);let rooms=new Set();
for(let i=0;i<queue.length;i++){
 const [x,z]=queue[i];rooms.add(x< -7?'west':x<9?'center':'east');
 for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
  const nx=x+dx,nz=z+dz,key=`${nx},${nz}`;
  if(!seen.has(key)&&nav.canMove(nx,nz,x,z)){seen.add(key);queue.push([nx,nz]);}
 }
}
console.log(queue.length,Math.min(...queue.map(p=>p[0])),Math.max(...queue.map(p=>p[0])),Math.min(...queue.map(p=>p[1])),Math.max(...queue.map(p=>p[1])));
assert.equal(rooms.size,3,'All three exhibit rooms must be connected');
assert(queue.some(([x,z])=>nav.nearPhoto(x,z)),'Photo is accessible');
console.log('Gallery navigation passed:',queue.length,'reachable positions, all 3 rooms, photo corner.');
