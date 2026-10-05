import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
const $ = id => document.getElementById(id);
let active=false, x=0,z=0,yaw=0,pitch=0, peers=[],keys=new Set(),last=performance.now(),timer,busy=false;
const canvas=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color('white');scene.fog=new THREE.Fog('white',35,100);
scene.add(new THREE.HemisphereLight(0xffffff,0xe5e5e5,2));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(10,20,10);scene.add(sun);
const camera=new THREE.PerspectiveCamera(70,1,.1,150);camera.rotation.order='YXZ';
const grid=new THREE.GridHelper(200,100,0xf3f3f3,0xf3f3f3);scene.add(grid);
const avatars=new Map();let human;
new GLTFLoader().load('/static/models/human.glb',g=>{
    human=g.scene;
    const box=new THREE.Box3().setFromObject(human),size=box.getSize(new THREE.Vector3());
    const scale=1.8/size.y;human.scale.setScalar(scale);
    human.position.set(-(box.min.x+box.max.x)/2*scale,-box.min.y*scale,-(box.min.z+box.max.z)/2*scale);
},undefined,()=>{$('status').textContent='Avatar could not load. Refresh to retry.';});
function avatar(p){
    const group=new THREE.Group();group.add(human.clone(true));
    const label=document.createElement('span');label.textContent=p.nickname;label.style.cssText='position:fixed;pointer-events:none;color:#444;font:13px Arial;transform:translate(-50%,-100%);';
    $('world').appendChild(label);scene.add(group);return {group,label};
}

async function api(route,data){const r=await fetch('/api/world/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':window.worldToken},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'Connection unavailable');return result;}
$('join').onsubmit=async e=>{e.preventDefault();try{const user=await api('join',{nickname:$('nickname').value});$('entry').hidden=true;$('world').hidden=false;$('identity').textContent=user.nickname;active=true;x=z=yaw=pitch=0;timer=setInterval(sync,400);sync();canvas.focus();}catch(e){$('entryError').textContent=e.message;}};
async function sync(){if(!active||busy)return;busy=true;try{const data=await api('state',{x,z});peers=data.players;$('status').textContent=(peers.length+1)+' online';const list=$('messages');list.replaceChildren(...data.messages.map(m=>{const li=document.createElement('li');li.textContent=m.nickname+': '+m.body;return li;}));list.scrollTop=list.scrollHeight;}catch(e){$('status').textContent='Reconnecting…';}finally{busy=false;}}
$('message').addEventListener('focus',()=>keys.clear());
$('send').onsubmit=async e=>{e.preventDefault();try{await api('chat',{message:$('message').value});$('message').value='';$('chatError').textContent='';sync();}catch(e){$('chatError').textContent=e.message;}};
$('leave').onclick=async()=>{active=false;clearInterval(timer);document.exitPointerLock?.();try{await api('leave',{});}catch{}location.href='/';};
window.addEventListener('pagehide',()=>{if(active)fetch('/api/world/leave',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-CSRF-Token':window.worldToken},body:'{}'});});
function lock(){try{const result=canvas.requestPointerLock?.();result?.catch(()=>{$('look').textContent='Drag to look around';});}catch{$('look').textContent='Drag to look around';}}canvas.onclick=lock;$('look').onclick=lock;
document.addEventListener('pointerlockchange',()=>{$('look').hidden=document.pointerLockElement===canvas;keys.clear();});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw+=e.movementX*.003;pitch=Math.max(-.7,Math.min(.7,pitch+e.movementY*.003));}});
let finger=null;canvas.onpointerdown=e=>{if(document.pointerLockElement!==canvas){finger=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}};canvas.onpointermove=e=>{if(finger){yaw+=(e.clientX-finger[0])*.005;pitch=Math.max(-.7,Math.min(.7,pitch+(e.clientY-finger[1])*.005));finger=[e.clientX,e.clientY];}};canvas.onpointerup=canvas.onpointercancel=()=>{finger=null;};
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key);});
window.onkeydown=e=>{if(!active||e.target.matches('input'))return;if(e.key==='Enter'){document.exitPointerLock?.();$('message').focus();return;}const map={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};const k=map[e.key]||e.key.toLowerCase();if('wasd'.includes(k)){e.preventDefault();keys.add(k);}};window.onkeyup=e=>{const map={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};keys.delete(map[e.key]||e.key.toLowerCase());};window.onblur=()=>keys.clear();
function draw(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(active){
  let f=(keys.has('w')?1:0)-(keys.has('s')?1:0),s=(keys.has('d')?1:0)-(keys.has('a')?1:0);const length=Math.hypot(f,s)||1;
  x=Math.max(-9999,Math.min(9999,x+(-Math.sin(yaw)*f-Math.cos(yaw)*s)*dt*4/length));z=Math.max(-9999,Math.min(9999,z+(Math.cos(yaw)*f-Math.sin(yaw)*s)*dt*4/length));
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  camera.position.set(x,1.65,z);camera.rotation.set(-pitch,Math.PI-yaw,0);camera.updateMatrixWorld();grid.position.set(Math.round(x/2)*2,0,Math.round(z/2)*2);
  const alive=new Set(peers.map(p=>p.id));
  avatars.forEach((a,id)=>{if(!alive.has(id)){scene.remove(a.group);a.label.remove();avatars.delete(id);}});
  if(human)peers.forEach(p=>{
   if(!avatars.has(p.id))avatars.set(p.id,avatar(p));
   const a=avatars.get(p.id);a.group.position.set(p.x,0,p.z);
   const point=new THREE.Vector3(p.x,2.05,p.z).project(camera);
   a.label.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1||Math.abs(point.y)>1;
   a.label.style.left=(point.x*.5+.5)*w+'px';a.label.style.top=(-point.y*.5+.5)*h+'px';
  });
  renderer.render(scene,camera);
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
