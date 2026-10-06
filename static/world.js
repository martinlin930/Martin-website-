import * as THREE from './vendor/three.module.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { loadVillage } from './village.js';
import {createOcean} from './ocean.js';
import { worldTime } from './day-night.js';
import { createForage } from './forage.js';
import {createTrain} from './train.js';
import {createRoom} from './room.js';
import {createAnimals,animalNames} from './animals.js';
import { createDogs } from './dogs.js';
const $ = id => document.getElementById(id);
let playerId=null, active=false, x=0,z=0,yaw=0,pitch=0, peers=[],keys=new Set(),last=performance.now(),timer,busy=false;
const canvas=$('view');
let animalPets={},animals,nearAnimal=null,animalBusy=false;
let dogName='',petState={food:0,xp:0,level:0,claims:{}},forageSpot=null,petBusy=false;
let noticeTimer;
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
const ambient=new THREE.HemisphereLight(0xfff6df,0x667c50,.55);scene.add(ambient);
const daySky=new THREE.Color(0x91c8ee),nightSky=new THREE.Color(0x071b42);
const dayAmbient=new THREE.Color(0xfff6df),nightAmbient=new THREE.Color(0x769bd6);
let worldClockAnchor=Date.now(),worldClockReceived=performance.now(),skyDome;
const skyNight={value:0};
function updateDayNight(now){
 const time=worldTime(worldClockAnchor+now-worldClockReceived);
 const daylight=time.daylight;
 village?.nightLights.update(1-daylight,camera.position);
 skyNight.value=1-daylight;scene.fog.color.copy(nightSky).lerp(daySky,daylight);
 ambient.color.copy(nightAmbient).lerp(dayAmbient,daylight);ambient.intensity=.3+.25*daylight;
 sun.intensity=2.4*daylight;scene.environmentIntensity=.04+.26*daylight;
 const angle=time.hour/24*Math.PI*2-Math.PI/2;
 sunOffset.set(Math.cos(angle)*60,Math.max(2,time.altitude*65),-25);
 if(skyDome)skyDome.position.copy(camera.position);
 $('worldClock').textContent=(time.day?'☀ ':'☾ ')+time.label;
}
const sun=new THREE.DirectionalLight(new THREE.Color(1,.8694853,.6650944),2.4);sun.position.set(10,20,10);sun.castShadow=true;
const shadowSize=matchMedia('(pointer: coarse)').matches?2048:4096;sun.shadow.mapSize.set(shadowSize,shadowSize);
Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:180});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=3;
scene.add(sun,sun.target);
const sunOffset=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion(-.5429736,.7981683,.19599362,.17231831).normalize()).multiplyScalar(-70);
const camera=new THREE.PerspectiveCamera(70,1,.1,500);camera.rotation.order='YXZ';
let village,dogs,forage,train,room,ocean;const joinButton=$('join').querySelector('button[type="submit"]');joinButton.disabled=true;
const villageReady=loadVillage(scene,progress=>{joinButton.textContent='Loading village… '+Math.round(progress*100)+'%';},renderer).then(async map=>{village=map;[train,room,ocean]=await Promise.all([createTrain(scene),createRoom(scene,map),createOcean(scene,map.size)]);dogs=await createDogs(scene,map);animals=await createAnimals(scene,map);forage=await createForage(scene,map);
 const skyMaterial=new THREE.MeshBasicMaterial({map:scene.background,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false});
 skyMaterial.onBeforeCompile=shader=>{shader.uniforms.nightMix=skyNight;shader.uniforms.nightColor={value:nightSky};shader.fragmentShader='uniform float nightMix; uniform vec3 nightColor;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,nightColor,nightMix);');};
 skyDome=new THREE.Mesh(new THREE.SphereGeometry(450,32,16),skyMaterial);skyDome.frustumCulled=false;skyDome.renderOrder=-1;scene.add(skyDome);scene.background=null;
 joinButton.disabled=false;joinButton.textContent='Enter the village →';}).catch(()=>{$('entryError').textContent='村庄加载失败，请刷新后重试。';joinButton.textContent='Village unavailable';});
const avatars=new Map(), templates=new Map(), pendingModels=new Map();



const avatarNames=["Alien Skeleton","Aspraragoose","Astronaut","Ballony","Ban Hammer Dude","Battery Character","Bed Character","Bell Character","Broom Character","Bubble Boi","Bunny Character","Business Dude","Cake Character","Can Character","Candle Character","Captain Lantern","Circle Boy","Cloud Character","Coconut Character","Coffee Maker Character","Cola Character","Conehead Being","Cool Baguette","Cool Barrel","Cool Egg","Cool Lemon","Cool Pizza","Cool Plunger","Cool Polygonal Mind","Cool Shield Character","Cool Taco","Coolfries","Cosmic Dweller","Cosmic Person","Cow Character","Cylinder Head","Dope Screwdriver Character","Drink Character","Drumstick Character","Egg Boy","Eye Cleric","Eye Fighter","Eye Summoner","Eye Wizard","Face guy","Falcon Dude","Fridge Character","Gold Fish Bag Character","Goldfish Bag Person","Guitar Character","Hourglass Person","Hydrant Character","Icecream Character","Jam Character","Ketchup Character","Lalobot","Lup Lup","Mailbox Character","Money Bag Character","Moon Girl","Mowchok","Mr Zurb Zurb","Orange Character","Palm Tree Character","Pan character","Pancake Character","Peanut Character","Pencil Character","Penguin Character","Pin Character","Pirate","Poo Character","Potato Character","Pyresorcerer","Ramen Character","Salty Salt","Sandwich Character","Shovel Character","Skateboard Character","Slim Ringo","Slug Person","Sr Stickbug","Steak Character","Stickman","Sun Flower Person","Supersup","Sword Character","TNT Character","Traffic Cone Character","Trash Bin Character","Turtle Character","Unicorn Person","Washing Machine Character","Wonkerls"];
function avatarKind(p){
 if(/^r2-\d{3}$/.test(p.avatar||'')&&Number(p.avatar.slice(3))<avatarNames.length)return p.avatar.slice(3);
 let hash=2166136261;for(const ch of (p.avatar||'01m')+'|'+p.nickname)hash=Math.imul(hash^ch.codePointAt(0),16777619)>>>0;
 return String(hash%avatarNames.length).padStart(3,'0');
}
function loadAvatar(kind){
 if(templates.has(kind))return Promise.resolve(templates.get(kind));
 if(pendingModels.has(kind))return pendingModels.get(kind);
 const promise=fetch('/static/models/avatars-r2/'+kind+'.glb.gz').then(async response=>{
  if(!response.ok)throw Error('Character unavailable');
  const buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new GLTFLoader().parseAsync(buffer,'');
 }).then(g=>{
  const model=g.scene;model.updateMatrixWorld(true);
  model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
  const scale=Math.min(1.8/size.y,1.6/Math.max(size.x,size.z));model.scale.multiplyScalar(scale);
  model.position.set(-(box.min.x+box.max.x)/2*scale,-box.min.y*scale,-(box.min.z+box.max.z)/2*scale);
  templates.set(kind,model);pendingModels.delete(kind);return model;
 }).catch(()=>{pendingModels.delete(kind);$('status').textContent='Character unavailable. Reconnecting…';return null;});
 pendingModels.set(kind,promise);return promise;
}
const skin=$('skin');
skin.replaceChildren(...avatarNames.map((name,i)=>{const option=document.createElement('option');option.value='r2-'+String(i).padStart(3,'0');option.textContent=name;return option;}));
skin.value=/^r2-\d{3}$/.test(window.worldAvatar||'')&&Number(window.worldAvatar.slice(3))<avatarNames.length?window.worldAvatar:skin.options[Math.floor(Math.random()*avatarNames.length)].value;
const previewScene=new THREE.Scene();previewScene.background=new THREE.Color(0xf5f5f5);
previewScene.add(new THREE.HemisphereLight(0xffffff,0x8e8e8e,2.5));
const previewLight=new THREE.DirectionalLight(0xffffff,3);previewLight.position.set(2,3,4);previewScene.add(previewLight);
const previewCamera=new THREE.PerspectiveCamera(40,1,.1,20);previewCamera.position.set(0,1,3.9);previewCamera.lookAt(0,.9,0);
const previewRenderer=new THREE.WebGLRenderer({canvas:$('skinPreview'),antialias:true});previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.setSize(200,200,false);
let previewBody,previewVersion=0;
async function showSkin(){
 const version=++previewVersion;$('skinStatus').textContent='正在加载皮肤…';
 const model=await loadAvatar(skin.value.slice(3));if(version!==previewVersion)return;
 if(previewBody)previewScene.remove(previewBody);
 if(model){previewBody=model.clone(true);previewScene.add(previewBody);$('skinStatus').textContent=avatarNames[Number(skin.value.slice(3))];}else $('skinStatus').textContent='加载失败，请重试或选择其他皮肤。';
 previewRenderer.render(previewScene,previewCamera);
}
skin.onchange=showSkin;
for(const [id,step] of [['skinPrevious',-1],['skinNext',1]])$(id).onclick=()=>{skin.selectedIndex=(skin.selectedIndex+step+avatarNames.length)%avatarNames.length;showSkin();};
showSkin();

function avatar(p){
 const group=new THREE.Group(),body=cloneSkeleton(templates.get(avatarKind(p)));group.add(body);
 const bones=[];body.traverse(n=>{if(/^(Left|Right)(Arm|UpLeg|Leg)(?:_\d+)?$/.test(n.name)&&n.position.lengthSq()>1e-8){bones.push({bone:n,rest:n.quaternion.clone()});}});
 const label=document.createElement('span');label.textContent=p.nickname;label.style.cssText='position:fixed;pointer-events:none;color:#fff;text-shadow:0 1px 3px #000;font:13px Arial;transform:translate(-50%,-100%);';
 $('world').appendChild(label);scene.add(group);group.position.set(p.x,village.groundHeight(p.x,p.z),p.z);return {group,body,restY:body.position.y,label,bones,phase:0,stride:0};
}

async function api(route,data){const r=await fetch('/api/world/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':window.worldToken},body:JSON.stringify({...data,player_id:playerId})});let result;try{result=await r.json();}catch{throw Error('连接异常，请刷新页面后重试。');}if(!r.ok)throw Error(result.error||'Connection unavailable');return result;}
$('join').onsubmit=async e=>{e.preventDefault();if(!village)return;startMusic();try{const user=await api('join',{nickname:$('nickname').value,avatar:$('skin').value});$('entry').hidden=true;$('world').hidden=false;$('identity').textContent=user.nickname;playerId=user.id;room?.setOpen(user.room_open);animalPets=user.animals||{};dogName=user.dog_name||'';petState=user.pet||petState;active=true;if(Number.isFinite(user.server_time)){worldClockAnchor=user.server_time*1000;worldClockReceived=performance.now();}x=user.state.x;z=user.state.z;yaw=user.state.yaw;pitch=user.state.pitch;music.muted=!!user.state.music_muted;musicLabel();$('saveStatus').textContent=user.persistent?'账户存档：自动保存':'访客模式：不保存进度';jumpHeight=jumpVelocity=0;timer=setInterval(sync,150);sync();canvas.focus();}catch(e){stopMusic();$('entryError').textContent=e.message;}};
async function sync(){if(!active||busy)return;busy=true;try{const data=await api('state',{x,z,yaw,pitch,music_muted:music.muted,jump:jumpHeight,running});const now=performance.now();if(Number.isFinite(data.server_time)){worldClockAnchor=data.server_time*1000;worldClockReceived=now;}room?.setOpen(data.room_open);animalPets=data.animals||{};dogName=data.dog_name||'';petState=data.pet||petState;const previous=new Map(peers.map(p=>[p.id,p]));peers=data.players.map(p=>{const old=previous.get(p.id);p.movingUntil=old&&Math.hypot(p.x-old.x,p.z-old.z)>.015?now+350:(old?.movingUntil||0);return p;});$('status').textContent=(peers.length+1)+' online';$('saveStatus').textContent=window.worldAccount?'账户存档：已保存':'访客模式：不保存进度';const list=$('messages');list.replaceChildren(...data.messages.map(m=>{const li=document.createElement('li');li.textContent=m.nickname+': '+m.body;return li;}));list.scrollTop=list.scrollHeight;}catch(e){$('status').textContent='Reconnecting…';$('saveStatus').textContent='连接中断，存档等待同步';}finally{busy=false;}}
$('message').addEventListener('focus',()=>keys.clear());
$('send').onsubmit=async e=>{e.preventDefault();try{await api('chat',{message:$('message').value});$('message').value='';$('chatError').textContent='';sync();}catch(e){$('chatError').textContent=e instanceof DOMException ? '消息未发送成功，请重试或刷新页面。' : e.message;}};
async function petInteract(action){
 if(petBusy)return;
 if(!window.worldAccount){location.href='/login';return;}
 petBusy=true;
 try{const result=await api('pet-action',{action,spot:forageSpot});petState=result.pet;
  if(action!=='collect')dogs?.interact(playerId,action);
  $('petNotice').textContent=result.message;
 }catch(error){$('petNotice').textContent=error.message;}
 finally{petBusy=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('petNotice').textContent='',4000);}
}
$('collectFood').onclick=()=>petInteract('collect');
$('feedDog').onclick=()=>petInteract('feed');
$('petDog').onclick=()=>petInteract('pet');
$('callDog').onclick=()=>petInteract('call');
$('petAction').onclick=()=>{
 if(!window.worldAccount){location.href='/login';return;}
 document.exitPointerLock?.();keys.clear();stickX=stickY=0;
 $('petName').value=dogName;$('petError').textContent='';
 $('petTitle').textContent=dogName?'给狗改名字':'领养你的狗';
 $('petSubmit').textContent=dogName?'保存名字':'领养并保存';
 $('petDialog').showModal();$('petName').focus();
};
function animalStats(){
 const pet=animalPets[$('animalKind').value];$('animalStats').textContent=pet?'Lv. '+Math.min(100,Math.floor(pet.xp/100))+' · '+(pet.xp>=10000?'已满级':pet.xp%100+' / 100 经验')+' · 食物 '+petState.food+' 份':'尚未领养';
 for(const id of ['feedAnimal','petAnimal','callAnimal'])$(id).disabled=animalBusy||!pet||animalPets.active!==$('animalKind').value;
}
$('animalAction').onclick=()=>{
 if(!window.worldAccount){location.href='/login';return;}document.exitPointerLock?.();keys.clear();stickX=stickY=0;
 const options=Object.keys(animalNames).filter(k=>animalPets[k]||k===nearAnimal);$('animalKind').replaceChildren(...options.map(k=>{const o=document.createElement('option');o.value=k;o.textContent=animalNames[k]+(animalPets[k]?' · 已领养':' · 可领养');return o;}));
 $('animalKind').value=nearAnimal||animalPets.active;$('animalKind').onchange();$('animalError').textContent='';$('animalDialog').showModal();
};
$('animalKind').onchange=()=>{$('animalName').value=animalPets[$('animalKind').value]?.name||'';animalStats();};
$('animalCancel').onclick=()=>$('animalDialog').close();
async function animalAction(action){if(animalBusy)return;animalBusy=true;$('animalSubmit').disabled=true;animalStats();try{const result=await api('animal',{action,kind:$('animalKind').value,name:$('animalName').value});animalPets=result.animals;petState=result.pet;animals?.interact(playerId,action);$('animalError').textContent=result.message;animalStats();}catch(e){$('animalError').textContent=e.message;}finally{animalBusy=false;$('animalSubmit').disabled=false;animalStats();}}
$('animalForm').onsubmit=e=>{e.preventDefault();animalAction('adopt');};
$('feedAnimal').onclick=()=>animalAction('feed');$('petAnimal').onclick=()=>animalAction('pet');$('callAnimal').onclick=()=>animalAction('call');
$('roomAction').onclick=async()=>{if(!room?.near(x,z))return;$('roomAction').disabled=true;try{const data=await api('room-door',{});room.setOpen(data.room_open);}catch(e){$('petNotice').textContent=e.message;}finally{$('roomAction').disabled=false;}};
$('petCancel').onclick=()=>$('petDialog').close();
$('petForm').onsubmit=async e=>{
 e.preventDefault();$('petSubmit').disabled=true;
 try{const data=await api('dog',{name:$('petName').value});dogName=data.dog_name;$('petDialog').close();}
 catch(error){$('petError').textContent=error.message;}
 finally{$('petSubmit').disabled=false;}
};
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

window.onkeydown=e=>{if(!active||e.target.matches('input,select,textarea')||$('animalDialog').open||$('petDialog').open)return;if(e.code==='KeyE'&&room?.near(x,z)){e.preventDefault();if(!e.repeat)$('roomAction').click();return;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();return;}if(e.key==='Shift'){keys.add('shift');return;}if(e.key==='Enter'){document.exitPointerLock?.();$('message').focus();return;}const map={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};let k=map[e.key]||({'KeyW':'w','KeyA':'a','KeyS':'s','KeyD':'d'}[e.code])||e.key.toLowerCase();if(['w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);}};window.onkeyup=e=>{const map={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};keys.delete(map[e.key]||({'KeyW':'w','KeyA':'a','KeyS':'s','KeyD':'d'}[e.code])||e.key.toLowerCase());};window.onblur=()=>keys.clear();
function animateWalk(avatar,moving,dt,isRunning=false,isJumping=false){
 avatar.stride+=(Number(moving)-avatar.stride)*(1-Math.exp(-dt*10));
 if(moving)avatar.phase+=dt*(isRunning?12:8);
 const swing=Math.sin(avatar.phase)*avatar.stride*(isRunning?1.35:1);
 avatar.body.position.y=avatar.restY+(isJumping?0:Math.abs(Math.sin(avatar.phase))*.045*avatar.stride);
 avatar.body.rotation.z=isJumping?0:swing*.025;
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
  if($('petDialog').open||$('animalDialog').open){keys.clear();stickX=stickY=0;}
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
   const kind=avatarKind(p);loadAvatar(kind);if(!templates.has(kind))return;
   if(!avatars.has(p.id))avatars.set(p.id,avatar(p));
   const a=avatars.get(p.id);a.group.position.lerp(new THREE.Vector3(p.x,village.groundHeight(p.x,p.z)+(p.jump||0),p.z),1-Math.exp(-dt*18));
   const target=-(p.yaw||0);const delta=Math.atan2(Math.sin(target-a.group.rotation.y),Math.cos(target-a.group.rotation.y));a.group.rotation.y+=delta*(1-Math.exp(-dt*18));
   animateWalk(a,p.movingUntil>now,dt,!!p.running,(p.jump||0)>.1);
   const point=new THREE.Vector3(p.x,village.groundHeight(p.x,p.z)+2.05+(p.jump||0),p.z).project(camera);
   a.label.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1||Math.abs(point.y)>1;
   a.label.style.left=(point.x*.5+.5)*w+'px';a.label.style.top=(-point.y*.5+.5)*h+'px';
  });
  room?.update(dt);$('roomAction').hidden=!room?.near(x,z);$('roomAction').textContent=room?.open?'关门 · E':'打开小屋门 · E';
  if(train)train.update(worldClockAnchor+now-worldClockReceived);
  if(room){const marker=new THREE.Vector3(58,5.9,-129.8).project(camera);$('roomMarker').hidden=Math.hypot(x-58,z+130)>32||marker.z>1||marker.z< -1||Math.abs(marker.x)>1||Math.abs(marker.y)>1;$('roomMarker').style.left=(marker.x*.5+.5)*w+'px';$('roomMarker').style.top=(-marker.y*.5+.5)*h+'px';}
  animals?.update(worldClockAnchor+now-worldClockReceived,[{id:playerId,x,z,animals:animalPets},...peers],dt,camera,w,h);
  nearAnimal=animals?.nearest(x,z)?.kind??null;
  $('animalAction').hidden=!nearAnimal&&!animalPets.active;
  $('animalAction').textContent=nearAnimal?'领养 / 管理'+animalNames[nearAnimal]:'我的动物';
  if($('animalDialog').open)animalStats();
  dogs?.update(worldClockAnchor+now-worldClockReceived,[{id:playerId,x,z,yaw,dog_name:dogName,dog_xp:petState.xp},...peers],dt,camera,w,h);
  $('petAction').hidden=!dogName&&(!dogs||dogs.nearest(x,z)>3);
  $('petAction').textContent=dogName?dogName+' · 改名字':window.worldAccount?'领养这只狗':'登录后领养狗';
  forageSpot=forage?.update((worldClockAnchor+now-worldClockReceived)/1000,petState.claims||{},x,z)??null;
  $('collectFood').hidden=forageSpot===null;$('collectFood').disabled=petBusy;
  $('petPanel').hidden=!dogName;
  $('petStats').textContent='Lv. '+petState.level+' · 狗粮 '+petState.food+' 份';
  $('petXp').value=petState.level===100?100:petState.xp%100;
  $('petProgress').textContent=petState.level===100?'已达到 100 级':(petState.xp%100)+' / 100 经验';
  for(const id of ['feedDog','petDog','callDog'])$(id).disabled=petBusy;
  updateDayNight(now);ocean?.update(camera);renderer.render(scene,camera);
 }
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
