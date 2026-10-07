import * as THREE from './vendor/three.module.js';
const $=id=>document.getElementById(id),mobile=matchMedia('(pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({canvas:$('view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.4:1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#c9eaf1');scene.fog=new THREE.Fog('#c9eaf1',55,115);
const camera=new THREE.PerspectiveCamera(65,1,.1,130);camera.rotation.order='YXZ';
scene.add(new THREE.HemisphereLight(0xfffcf0,0x93b080,2));
const sun=new THREE.DirectionalLight(0xffefd1,3);sun.position.set(-25,38,18);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:100});sun.shadow.normalBias=.025;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun);
const palette={grass:'#a9cd8e',path:'#f1dfbf',cream:'#fff3d8',pink:'#edb4b5',blue:'#a8cddb',green:'#c1d294',wood:'#b79877'};
const materials=new Map(),geometry={sphere:new THREE.SphereGeometry(1,20,12),box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,16),cone:new THREE.ConeGeometry(1,1,24)};
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.86}));return materials.get(color);}
let meshes=0;const blockers=[];
function shape(type,color,pos,scale,parent=scene){const m=new THREE.Mesh(geometry[type],mat(color));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);meshes++;return m;}
function label(text,pos,width=3,color='#665e54',parent=scene){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff8e9';ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='bold 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:texture,roughness:1}));m.position.set(...pos);parent.add(m);return m;}
shape('cylinder',palette.grass,[0,-.3,0],[58,.6,58]);
// Broad rounded paths and a central meeting square.
shape('cylinder',palette.path,[0,.018,0],[8,.04,8]);shape('box',palette.path,[0,.02,3],[3,.05,58]);shape('box',palette.path,[0,.021,-1],[56,.05,3]);
function house(x,z,color,title){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);shape('box',palette.cream,[0,1.65,0],[6,3.3,5],g);shape('sphere',color,[0,3.3,0],[3.6,1.7,3.1],g);shape('box',palette.wood,[0,1.05,2.53],[1.35,2.1,.15],g);shape('sphere','#f5dfad',[.43,1,2.66],[.08,.08,.06],g);
 for(const px of [-1.9,1.9]){shape('cylinder',palette.wood,[px,1.75,2.56],[.65,.12,.65],g).rotation.x=Math.PI/2;shape('cylinder',palette.blue,[px,1.75,2.64],[.52,.06,.52],g).rotation.x=Math.PI/2;shape('box',palette.cream,[px,1.75,2.69],[1.08,.08,.06],g);shape('box',palette.cream,[px,1.75,2.69],[.08,1.08,.06],g);}
 label(title,[0,3,2.8],2.7,'#77654f',g);blockers.push({x,z,rx:3.35,rz:2.8});
 for(const sx of [-3,3]){shape('cylinder',palette.wood,[sx,.5,3.2],[.35,1,.35],g);shape('sphere',palette.green,[sx,1.15,3.2],[.7,.6,.7],g);}return g;}
house(-13,-9,palette.pink,'小小面包店');house(12,-10,palette.blue,'杂货铺');house(-15,10,palette.green,'草莓小屋');house(14,10,'#f5d795','午后小屋');
// Shop counters sit outside so the first version has no inaccessible interiors.
for(const [x,z] of [[-13,-5.8],[12,-6.8]]){shape('box',palette.wood,[x,.65,z],[3.4,1.3,1.2]);blockers.push({x,z,rx:1.9,rz:.8});for(let i=0;i<5;i++)shape('sphere','#e9c18d',[x-1.2+i*.6,1.45,z],[.24,.16,.2]);}
shape('cylinder','#e8dac0',[0,.28,-1],[2.1,.55,2.1]);shape('cylinder','#b4dfe6',[0,.58,-1],[1.8,.06,1.8]);shape('sphere','#fff6dc',[0,1.1,-1],[.45,.55,.45]);blockers.push({x:0,z:-1,rx:2.3,rz:2.3});
function bench(x,z){shape('box',palette.wood,[x,.55,z],[2.8,.18,.8]);shape('box',palette.wood,[x,1,z-.4],[2.8,.8,.12]);for(const dx of [-1,1])shape('box',palette.wood,[x+dx,.25,z],[.18,.5,.65]);blockers.push({x,z,rx:1.6,rz:.65});}bench(-4,3);bench(4,3);
let seed=411;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<32;i++){const a=i*Math.PI*2/32,r=27+random()*12,x=Math.sin(a)*r,z=Math.cos(a)*r;shape('cylinder',palette.wood,[x,1.5,z],[.22,3,.22]);shape('sphere',i%3?'#a5c988':'#eabec2',[x,3.6,z],[1.65,1.8,1.65]);shape('sphere',i%3?'#b9d89d':'#f0ccd1',[x+.7,4,z],[1.2,1.2,1.2]);blockers.push({x,z,rx:.5,rz:.5});}
for(let i=0;i<18;i++){const a=i*Math.PI*2/18;shape('sphere',i%2?'#b7d79a':'#c1dda7',[Math.sin(a)*53,-1,Math.cos(a)*53],[10+random()*8,5+random()*6,10]);}
for(let i=0;i<14;i++){const a=random()*Math.PI*2,r=26+random()*35,g=new THREE.Group();g.position.set(Math.sin(a)*r,17+random()*7,Math.cos(a)*r);scene.add(g);for(let j=0;j<3;j++){const cloud=shape('sphere','#fffaf1',[j*1.7,0,0],[2.5,1,1.3],g);cloud.castShadow=false;}}
for(let i=0;i<150;i++){const x=(random()-.5)*80,z=(random()-.5)*80;if(Math.abs(x)<3||Math.abs(z+1)<3||Math.hypot(x,z)<9)continue;shape('sphere',i%3===0?'#f2bec7':i%3===1?'#f6edbd':'#d9c7ed',[x,.14,z],[.13,.17,.13]).castShadow=false;}
label('慢慢走，今天也很好。',[0,2.5,-23],5);shape('box',palette.wood,[-2,1,-23.1],[.12,2,.12]);shape('box',palette.wood,[2,1,-23.1],[.12,2,.12]);
let x=0,z=16,yaw=0,pitch=0,height=0,velocity=0,active=false,last=performance.now(),sx=0,sy=0,finger=null,stickId=null;const keys=new Set();
function canMove(px,pz){return Math.hypot(px,pz)<46&&!blockers.some(b=>Math.abs(px-b.x)<b.rx+.25&&Math.abs(pz-b.z)<b.rz+.25);}
function reset(){keys.clear();finger=null;stickId=null;sx=sy=0;$('knob').style.transform='translate(-50%,-50%)';}
function jump(){if(active&&height===0)velocity=5;}
$('jump').onpointerdown=e=>{e.preventDefault();jump();};$('leave').onclick=()=>{save();location.href='/#work';};
let saved=null;try{saved=JSON.parse(localStorage.getItem('martin-xxxx-state'));if(saved){$('nickname').value=saved.name||'';if(Number.isFinite(saved.x)&&Number.isFinite(saved.z)&&canMove(saved.x,saved.z)){x=saved.x;z=saved.z;}if(Number.isFinite(saved.yaw))yaw=saved.yaw;}}catch{}
function save(){if(active)try{localStorage.setItem('martin-xxxx-state',JSON.stringify({name:$('nickname').value,x,z,yaw}));}catch{}}
$('entry').onsubmit=e=>{e.preventDefault();if(!$('nickname').value.trim())return;active=true;$('entry').hidden=true;$('notice').textContent='欢迎，'+$('nickname').value.trim();setTimeout(()=>$('notice').style.opacity=0,4000);last=performance.now();save();};
window.addEventListener('pagehide',save);setInterval(save,5000);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
window.addEventListener('keydown',e=>{if(!active||e.target.matches('input'))return;const key=e.key.toLowerCase();if(['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)){e.preventDefault();keys.add(key);if(key===' ')jump();}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
$('view').onpointerdown=e=>{if(!active||finger)return;finger={id:e.pointerId,x:e.clientX,y:e.clientY};$('view').setPointerCapture(e.pointerId);};$('view').onpointermove=e=>{if(finger?.id!==e.pointerId)return;yaw-=(e.clientX-finger.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-finger.y)*.004,-1.1,1.1);finger.x=e.clientX;finger.y=e.clientY;};for(const event of ['pointerup','pointercancel','lostpointercapture'])$('view').addEventListener(event,()=>finger=null);
function stick(e){const b=$('stick').getBoundingClientRect(),r=38;let dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2;const d=Math.hypot(dx,dy);if(d>r){dx*=r/d;dy*=r/d;}sx=dx/r;sy=dy/r;$('knob').style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
$('stick').onpointerdown=e=>{if(!active||stickId!==null)return;stickId=e.pointerId;$('stick').setPointerCapture(e.pointerId);stick(e);};$('stick').onpointermove=e=>{if(e.pointerId===stickId)stick(e);};for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(event,()=>{stickId=null;sx=sy=0;$('knob').style.transform='translate(-50%,-50%)';});
function draw(now){requestAnimationFrame(draw);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;const w=innerWidth,h=innerHeight;if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 if(active){let f=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))-sy,s=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+sx;const length=Math.max(1,Math.hypot(f,s)),speed=keys.has('shift')||Math.hypot(sx,sy)>.9?6:3.2;const nx=x+(-Math.sin(yaw)*f+Math.cos(yaw)*s)*dt*speed/length,nz=z+(-Math.cos(yaw)*f-Math.sin(yaw)*s)*dt*speed/length;if(canMove(nx,z))x=nx;if(canMove(x,nz))z=nz;velocity-=12*dt;height=Math.max(0,height+velocity*dt);if(height===0)velocity=0;}
 camera.position.set(x,1.65+height,z);camera.rotation.set(pitch,yaw,0);renderer.render(scene,camera);
}
$('enter').disabled=false;$('enter').textContent='进入小世界';$('notice').textContent='柔软的小世界';requestAnimationFrame(draw);window.galleryReady=true;
window.cozyTest={canMove,blockers,meshes,scene,camera,renderer};
