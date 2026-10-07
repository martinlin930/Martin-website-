import * as THREE from './vendor/three.module.js';
import {loadMyWorld} from './my-world-map.js';
const $=id=>document.getElementById(id),mobile=matchMedia('(pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.4:1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#a9d4ef');scene.fog=new THREE.Fog('#a9d4ef',mobile?35:70,mobile?60:115);
const camera=new THREE.PerspectiveCamera(65,1,.1,130);camera.rotation.order='YXZ';renderer.shadowMap.enabled=false;
let terrain;try{terrain=await loadMyWorld(scene,n=>{$('notice').textContent='正在准备附近的地图…';});}catch(error){$('notice').textContent='地图加载失败，请刷新重试';$('enter').textContent='加载失败';throw error;}
let [x,feet,z]=terrain.spawn,yaw=0,pitch=0,height=0,velocity=0,active=false,last=performance.now(),sx=0,sy=0,finger=null,stickId=null;const keys=new Set();
function canMove(px,pz){return terrain.canMove(px,pz,feet+height)&&terrain.readyAt(px,pz);}
function reset(){keys.clear();finger=null;stickId=null;sx=sy=0;$('knob').style.transform='translate(-50%,-50%)';}
function jump(){if(active&&height===0)velocity=5.8;}
$('jump').onpointerdown=e=>{e.preventDefault();jump();};$('leave').onclick=()=>{save();location.href='/#work';};
let saved=null;try{saved=JSON.parse(localStorage.getItem('martin-my-world-state'));if(saved){$('nickname').value=saved.name||'';if(Number.isFinite(saved.x)&&Number.isFinite(saved.z)&&Number.isFinite(saved.feet)&&terrain.ground(saved.x,saved.z,saved.feet+.1)!==null){x=saved.x;z=saved.z;feet=terrain.ground(x,z,saved.feet+.1);}if(Number.isFinite(saved.yaw))yaw=saved.yaw;}}catch{}
function save(){if(active)try{localStorage.setItem('martin-my-world-state',JSON.stringify({name:$('nickname').value,x,z,feet,yaw}));}catch{}}
$('entry').onsubmit=e=>{e.preventDefault();if(!$('nickname').value.trim())return;active=true;$('entry').hidden=true;$('notice').textContent='欢迎，'+$('nickname').value.trim();setTimeout(()=>$('notice').style.opacity=0,4000);last=performance.now();save();};
window.addEventListener('pagehide',save);setInterval(save,5000);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
window.addEventListener('keydown',e=>{if(!active||e.target.matches('input'))return;const key=e.key.toLowerCase();if(['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)){e.preventDefault();keys.add(key);if(key===' ')jump();}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
$('view').onpointerdown=e=>{if(!active||finger)return;finger={id:e.pointerId,x:e.clientX,y:e.clientY};$('view').setPointerCapture(e.pointerId);};$('view').onpointermove=e=>{if(finger?.id!==e.pointerId)return;yaw-=(e.clientX-finger.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-finger.y)*.004,-1.1,1.1);finger.x=e.clientX;finger.y=e.clientY;};for(const event of ['pointerup','pointercancel','lostpointercapture'])$('view').addEventListener(event,()=>finger=null);
function stick(e){const b=$('stick').getBoundingClientRect(),r=38;let dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2;const d=Math.hypot(dx,dy);if(d>r){dx*=r/d;dy*=r/d;}sx=dx/r;sy=dy/r;$('knob').style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
$('stick').onpointerdown=e=>{if(!active||stickId!==null)return;stickId=e.pointerId;$('stick').setPointerCapture(e.pointerId);stick(e);};$('stick').onpointermove=e=>{if(e.pointerId===stickId)stick(e);};for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(event,()=>{stickId=null;sx=sy=0;$('knob').style.transform='translate(-50%,-50%)';});
function draw(now){requestAnimationFrame(draw);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;const w=innerWidth,h=innerHeight;if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 if(active){let f=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))-sy,s=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+sx;const length=Math.max(1,Math.hypot(f,s)),speed=keys.has('shift')||Math.hypot(sx,sy)>.9?6:3.2;const nx=x+(-Math.sin(yaw)*f+Math.cos(yaw)*s)*dt*speed/length,nz=z+(-Math.cos(yaw)*f-Math.sin(yaw)*s)*dt*speed/length;if(canMove(nx,z))x=nx;if(canMove(x,nz))z=nz;
 const floor=terrain.ground(x,z,feet+height+.55);
 if(height===0&&velocity<=0&&floor!==null&&floor<=feet+.55){feet=floor;velocity=0;}
 else{velocity-=12*dt;height+=velocity*dt;if(floor!==null&&feet+height<=floor){feet=floor;height=0;velocity=0;}else if(height<0){height=0;velocity=0;}}
}
 camera.position.set(x,feet+1.65+height,z);terrain.update(camera.position,now);camera.rotation.set(pitch,yaw,0);renderer.render(scene,camera);
}
$('enter').disabled=false;$('enter').textContent='进入小世界';$('notice').textContent='我的世界' ;requestAnimationFrame(draw);window.galleryReady=true;
window.cozyTest={canMove,scene,camera,renderer,terrain};
