import * as THREE from './vendor/three.module.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { loadVillage } from './village.js';
const $ = id => document.getElementById(id);
let playerId=null, active=false, x=0,z=0,yaw=0,pitch=0, peers=[],keys=new Set(),last=performance.now(),timer,busy=false;
const canvas=$('view');
let jumpHeight=0,jumpVelocity=0,running=false;
const music=new Audio('/static/world-music.m4a');music.loop=true;music.volume=.45;music.preload='none';music.muted=!!window.worldMusicMuted;
function musicLabel(){$('music').textContent=music.paused?'播放音乐':music.muted?'音乐：关':'音乐：开';}
function startMusic(){music.play().then(musicLabel).catch(musicLabel);}
function stopMusic(){music.pause();music.currentTime=0;musicLabel();}
$('music').onclick=()=>{if(music.paused)startMusic();else{music.muted=!music.muted;musicLabel();}};
function jump(){if(active&&jumpHeight<.01&&jumpVelocity===0){jumpVelocity=6;}}
$('jump').onpointerdown=e=>{e.preventDefault();document.activeElement?.blur();jump();};

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x91c8ee);scene.fog=new THREE.Fog(0x91c8ee,80,240);
scene.add(new THREE.HemisphereLight(0xfff6df,0x667c50,.55));
const sun=new THREE.DirectionalLight(new THREE.Color(1,.8694853,.6650944),2.4);sun.position.set(10,20,10);sun.castShadow=true;
const shadowSize=matchMedia('(pointer: coarse)').matches?2048:4096;sun.shadow.mapSize.set(shadowSize,shadowSize);
Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:180});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=3;
scene.add(sun,sun.target);
const sunOffset=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(-.5429736,.7981683,.19599362,.17231831).normalize()).multiplyScalar(-70);
const camera=new THREE.PerspectiveCamera(70,1,.1,500);camera.rotation.order='YXZ';
let village;const joinButton=$('join').querySelector('button');joinButton.disabled=true;
const villageReady=loadVillage(scene,progress=>{joinButton.textContent='Loading village… '+Math.round(progress*100)+'%';},renderer).then(map=>{village=map;joinButton.disabled=false;joinButton.textContent='Enter the village →';}).catch(()=>{$('entryError').textContent='村庄加载失败，请刷新后重试。';joinButton.textContent='Village unavailable';});
const avatars=new Map(), templates=new Map(), pendingModels=new Set();
const textureLoader=new THREE.TextureLoader();const textures=new Map();
let materials={};
const materialsReady=fetch('/static/models/npc/materials.json').then(r=>r.json()).then(m=>{materials=m;});
function loadAvatar(kind){
 if(templates.has(kind)||pendingModels.has(kind))return;
 pendingModels.add(kind);
 materialsReady.then(()=>new GLTFLoader().load('/static/models/npc/'+kind+'.glb',g=>{
  const model=g.scene;
  model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;const mapped=(Array.isArray(n.material)?n.material:[n.material]).map(mat=>{
   const [name,index]=mat.name.split('__');const info=materials[kind]?.[name]?.[Number(index)];
   if(info){mat.color.fromArray(info.color);if(info.texture){let tex=textures.get(info.texture);if(!tex){tex=textureLoader.load('/static/models/npc/'+info.texture);tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;textures.set(info.texture,tex);}mat.map=tex;mat.needsUpdate=true;}}
   return mat;
  });n.material=mapped.length===1?mapped[0]:mapped;}});
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  const scale=1.8/size.y;model.scale.multiplyScalar(scale);
  model.position.set(-(box.min.x+box.max.x)/2*scale,-box.min.y*scale,-(box.min.z+box.max.z)/2*scale);
  templates.set(kind,model);pendingModels.delete(kind);
 },undefined,()=>{pendingModels.delete(kind);$('status').textContent='Character unavailable. Reconnecting…';}));
}
function avatar(p){
 const group=new THREE.Group(),body=cloneSkeleton(templates.get(p.avatar||'01m'));group.add(body);
 const bones=[];body.traverse(n=>{if(/^(Left|Right)(Arm|UpLeg|Leg)(?:_\d+)?$/.test(n.name)&&n.position.lengthSq()>1e-8){bones.push({bone:n,rest:n.quaternion.clone()});}});
 const label=document.createElement('span');label.textContent=p.nickname;label.style.cssText='position:fixed;pointer-events:none;color:#fff;text-shadow:0 1px 3px #000;font:13px Arial;transform:translate(-50%,-100%);';
 $('world').appendChild(label);scene.add(group);group.position.set(p.x,village.groundHeight(p.x,p.z),p.z);return {group,label,bones,phase:0,stride:0};
}

async function api(route,data){const r=await fetch('/api/world/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':window.worldToken},body:JSON.stringify({...data,player_id:playerId})});let result;try{result=await r.json();}catch{throw Error('连接异常，请刷新页面后重试。');}if(!r.ok)throw Error(result.error||'Connection unavailable');return result;}
$('join').onsubmit=async e=>{e.preventDefault();if(!village)return;startMusic();try{const user=await api('join',{nickname:$('nickname').value});$('entry').hidden=true;$('world').hidden=false;$('identity').textContent=user.nickname;playerId=user.id;active=true;x=user.state.x;z=user.state.z;yaw=user.state.yaw;pitch=user.state.pitch;music.muted=!!user.state.music_muted;musicLabel();$('saveStatus').textContent=user.persistent?'账户存档：自动保存':'访客模式：不保存进度';jumpHeight=jumpVelocity=0;timer=setInterval(sync,150);sync();canvas.focus();}catch(e){stopMusic();$('entryError').textContent=e.message;}};
async function sync(){if(!active||busy)return;busy=true;try{const data=await api('state',{x,z,yaw,pitch,music_muted:music.muted,jump:jumpHeight,running});const now=performance.now();const previous=new Map(peers.map(p=>[p.id,p]));peers=data.players.map(p=>{const old=previous.get(p.id);p.movingUntil=old&&Math.hypot(p.x-old.x,p.z-old.z)>.015?now+350:(old?.movingUntil||0);return p;});$('status').textContent=(peers.length+1)+' online';$('saveStatus').textContent=window.worldAccount?'账户存档：已保存':'访客模式：不保存进度';const list=$('messages');list.replaceChildren(...data.messages.map(m=>{const li=document.createElement('li');li.textContent=m.nickname+': '+m.body;return li;}));list.scrollTop=list.scrollHeight;}catch(e){$('status').textContent='Reconnecting…';$('saveStatus').textContent='连接中断，存档等待同步';}finally{busy=false;}}
$('message').addEventListener('focus',()=>keys.clear());
$('send').onsubmit=async e=>{e.preventDefault();try{await api('chat',{message:$('message').value});$('message').value='';$('chatError').textContent='';sync();}catch(e){$('chatError').textContent=e instanceof DOMException ? '消息未发送成功，请重试或刷新页面。' : e.message;}};
$('leave').onclick=async()=>{active=false;stopMusic();clearInterval(timer);document.exitPointerLock?.();try{await api('state',{x,z,yaw,pitch,music_muted:music.muted,jump:0,running:false});await api('leave',{});}catch{}location.href='/';};
window.addEventListener('pagehide',()=>{stopMusic();if(active)fetch('/api/world/state',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-CSRF-Token':window.worldToken},body:JSON.stringify({player_id:playerId,x,z,yaw,pitch,music_muted:music.muted,jump:0,running:false})});});
function lock(){try{const result=canvas.requestPointerLock?.();result?.catch(()=>{$('look').textContent='Drag to look around';});}catch{$('look').textContent='Drag to look around';}}canvas.onclick=lock;$('look').onclick=lock;
document.addEventListener('pointerlockchange',()=>{$('look').hidden=document.pointerLockElement===canvas;keys.clear();});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw+=e.movementX*.003;pitch=Math.max(-.7,Math.min(.7,pitch+e.movementY*.003));}});
let finger=null;canvas.onpointerdown=e=>{if(document.pointerLockElement!==canvas){finger=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}};canvas.onpointermove=e=>{if(finger){yaw+=(e.clientX-finger[0])*.005;pitch=Math.max(-.7,Math.min(.7,pitch+(e.clientY-finger[1])*.005));finger=[e.clientX,e.clientY];}};canvas.onpointerup=canvas.onpointercancel=()=>{finger=null;};
const joystick=$('joystick'),knob=$('joystickKnob');
let stickPointer=null,stickX=0,stickY=0;
function resetStick(){stickPointer=null;stickX=stickY=0;knob.style.transform='translate(-50%,-50%)';}
function updateStick(e){
 const rect=joystick.getBoundingClientRect(),radius=rect.width*.32;
 let dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;
 const distance=Math.hypot(dx,dy),limit=Math.min(1,radius/(distance||1));dx*=limit;dy*=limit;
 const magnitude=Math.hypot(dx,dy)/radius,strength=Math.max(0,(magnitude-.12)/.88);
 stickX=magnitude?dx/radius/magnitude*strength:0;stickY=magnitude?dy/radius/magnitude*strength:0;
 knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
joystick.onpointerdown=e=>{if(stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);document.activeElement?.blur();updateStick(e);};
joystick.onpointermove=e=>{if(e.pointerId===stickPointer)updateStick(e);};
joystick.onpointerup=joystick.onpointercancel=joystick.onlostpointercapture=e=>{if(e.pointerId===stickPointer)resetStick();};
window.addEventListener('blur',resetStick);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetStick();});
$('message').addEventListener('focus',resetStick);

window.onkeydown=e=>{if(!active||e.target.matches('input'))return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();return;}if(e.key==='Shift'){keys.add('shift');return;}if(e.key==='Enter'){document.exitPointerLock?.();$('message').focus();return;}const map={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};let k=map[e.key]||({'KeyW':'w','KeyA':'a','KeyS':'s','KeyD':'d'}[e.code])||e.key.toLowerCase();if(['w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);}};window.onkeyup=e=>{const map={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};keys.delete(map[e.key]||({'KeyW':'w','KeyA':'a','KeyS':'s','KeyD':'d'}[e.code])||e.key.toLowerCase());};window.onblur=()=>keys.clear();
function animateWalk(avatar,moving,dt,isRunning=false,isJumping=false){
 avatar.stride+=(Number(moving)-avatar.stride)*(1-Math.exp(-dt*10));
 if(moving)avatar.phase+=dt*(isRunning?12:8);
 const swing=Math.sin(avatar.phase)*avatar.stride*(isRunning?1.35:1);
 avatar.bones.forEach(({bone,rest})=>{
  bone.quaternion.copy(rest);
  const name=bone.name.replace(/_\d+$/, '');const side=name.includes('Left')?1:-1;
  if(/^(Left|Right)UpLeg$/.test(name))bone.rotateX(isJumping?-.35:side*swing*.4);
  if(/^(Left|Right)Leg$/.test(name))bone.rotateX(isJumping?.55:Math.max(0,-side*swing)*.25);
  if(/^(Left|Right)Arm$/.test(name)){bone.rotateZ(-1.15);bone.rotateX(-side*swing*.32);}
 });
}

function draw(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(active){
  let f=(keys.has('w')?1:0)-(keys.has('s')?1:0)-stickY,s=(keys.has('d')?1:0)-(keys.has('a')?1:0)+stickX;const length=Math.max(1,Math.hypot(f,s));
  running=Math.hypot(f,s)>.1&&(keys.has('shift')||Math.hypot(stickX,stickY)>.9);const speed=running?7:4;
  const nextX=x+(-Math.sin(yaw)*f-Math.cos(yaw)*s)*dt*speed/length,nextZ=z+(Math.cos(yaw)*f-Math.sin(yaw)*s)*dt*speed/length;
  if(village.canMove(nextX,z,x,z))x=nextX;if(village.canMove(x,nextZ,x,z))z=nextZ;
  jumpVelocity-=12*dt;jumpHeight+=jumpVelocity*dt;if(jumpHeight<=0){jumpHeight=0;jumpVelocity=0;}
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const floor=village.groundHeight(x,z);sun.position.set(x+sunOffset.x,floor+sunOffset.y,z+sunOffset.z);sun.target.position.set(x,floor,z);
  camera.position.set(x,floor+1.65+jumpHeight,z);camera.rotation.set(-pitch,Math.PI-yaw,0);camera.updateMatrixWorld();
  const alive=new Set(peers.map(p=>p.id));
  avatars.forEach((a,id)=>{if(!alive.has(id)){scene.remove(a.group);a.label.remove();avatars.delete(id);}});
  peers.forEach(p=>{
   const kind=p.avatar||'01m';loadAvatar(kind);if(!templates.has(kind))return;
   if(!avatars.has(p.id))avatars.set(p.id,avatar(p));
   const a=avatars.get(p.id);a.group.position.lerp(new THREE.Vector3(p.x,village.groundHeight(p.x,p.z)+(p.jump||0),p.z),1-Math.exp(-dt*18));
   const target=-(p.yaw||0);const delta=Math.atan2(Math.sin(target-a.group.rotation.y),Math.cos(target-a.group.rotation.y));a.group.rotation.y+=delta*(1-Math.exp(-dt*18));
   animateWalk(a,p.movingUntil>now,dt,!!p.running,(p.jump||0)>.1);
   const point=new THREE.Vector3(p.x,village.groundHeight(p.x,p.z)+2.05+(p.jump||0),p.z).project(camera);
   a.label.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1||Math.abs(point.y)>1;
   a.label.style.left=(point.x*.5+.5)*w+'px';a.label.style.top=(-point.y*.5+.5)*h+'px';
  });
  renderer.render(scene,camera);
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
