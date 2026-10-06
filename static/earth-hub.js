import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export function hubStep(position,yaw,forward,side,dt){
 const length=Math.max(1,Math.hypot(forward,side)),speed=3.5;
 const x=position.x+(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*dt*speed/length;
 const z=position.z+(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*dt*speed/length;
 if(Math.hypot(x,z)<2.2||Math.hypot(x,z)>24)return false;
 position.set(x,1.65,z);return true;
}
export async function createHubScene(scene){
 scene.background=new THREE.Color(0x000000);
 scene.add(new THREE.HemisphereLight(0xdceaff,0x505575,2));
 const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-4,6,8);scene.add(light);
 const loader=new GLTFLoader();
 const [earthAsset,folderAsset]=await Promise.all([loader.loadAsync('/static/models/earth.glb'),loader.loadAsync('/static/models/file-folder.glb')]);
 function centered(model,width){const group=new THREE.Group();model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),scale=width/Math.max(size.x,size.y,size.z);model.scale.multiplyScalar(scale);model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);group.add(model);return group;}
 const earth=centered(earthAsset.scene,3.6);earth.position.y=1.65;scene.add(earth);
 const folders=[0,1,2].map(i=>{const folder=centered(folderAsset.scene.clone(true),1.15);folder.userData.destination=i===0?'town':null;scene.add(folder);return folder;});
 const points=[];let seed=12031;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 for(let i=0;i<240;i++){const a=random()*Math.PI*2,b=Math.acos(2*random()-1),r=60+random()*20;points.push(Math.sin(b)*Math.cos(a)*r,Math.cos(b)*r,Math.sin(b)*Math.sin(a)*r);}
 const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(points,3));scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xbac8e0,size:.075,transparent:true,opacity:.65,depthWrite:false})));
 function update(time){earth.rotation.y=time*.04;folders.forEach((folder,i)=>{const angle=time*.075+i*Math.PI*2/3-Math.PI/3;folder.position.set(Math.sin(angle)*5,1.65,Math.cos(angle)*5);folder.rotation.y=-angle+.25;});}
 update(0);return {earth,folders,update};
}
export async function createEarthHub({canvas,music,onTown}){
 const scene=new THREE.Scene(),space=await createHubScene(scene),camera=new THREE.PerspectiveCamera(65,1,.1,100);camera.rotation.order='YXZ';
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const keys=new Set(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),stick=document.getElementById('hubJoystick'),knob=document.getElementById('hubKnob'),status=document.getElementById('hubStatus'),labels=[...document.querySelectorAll('.hub-folder-label')],musicButton=document.getElementById('hubMusic');
 let active=false,frame=0,last=0,time=0,yaw=0,pitch=0,press=null,stickId=null,stickX=0,stickY=0;
 function release(){keys.clear();press=null;stickId=null;stickX=stickY=0;knob.style.transform='translate(-50%,-50%)';}
 function enterTown(){stop();onTown();}
 labels[0].onclick=enterTown;
 function musicLabel(){musicButton.textContent=music.paused?'播放音乐':'音乐：开';}
 music.addEventListener('play',musicLabel);music.addEventListener('pause',musicLabel);
 musicButton.onclick=()=>{if(music.paused)music.play().catch(()=>{status.textContent='点击音乐按钮播放';});else music.pause();};
 document.addEventListener('keydown',event=>{if(!active)return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(event.key.toLowerCase())){keys.add(event.key.toLowerCase());event.preventDefault();}});
 document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
 canvas.addEventListener('pointerdown',event=>{if(!active||press)return;press={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(!press||event.pointerId!==press.id)return;const dx=event.clientX-press.x,dy=event.clientY-press.y;press.x=event.clientX;press.y=event.clientY;if(Math.hypot(event.clientX-press.startX,event.clientY-press.startY)>7)press.moved=true;if(press.moved){yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.1,1.1);}});
 canvas.addEventListener('pointerup',event=>{if(!press||event.pointerId!==press.id)return;if(!press.moved){const box=canvas.getBoundingClientRect();pointer.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(space.folders,true)[0];if(hit){let root=hit.object;while(root.parent&&root.parent!==scene)root=root.parent;if(root.userData.destination==='town')enterTown();else status.textContent='这个文件夹暂未开放';}}press=null;});
 canvas.addEventListener('pointercancel',()=>{press=null;});
 function joystick(event){const box=stick.getBoundingClientRect(),radius=box.width*.34;let dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2;const length=Math.hypot(dx,dy);if(length>radius){dx*=radius/length;dy*=radius/length;}stickX=dx/radius;stickY=dy/radius;knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}
 stick.addEventListener('pointerdown',event=>{if(stickId!==null)return;stickId=event.pointerId;stick.setPointerCapture(event.pointerId);joystick(event);});
 stick.addEventListener('pointermove',event=>{if(event.pointerId===stickId)joystick(event);});
 for(const name of ['pointerup','pointercancel'])stick.addEventListener(name,event=>{if(event.pointerId===stickId){stickId=null;stickX=stickY=0;knob.style.transform='translate(-50%,-50%)';}});
 function draw(now){if(!active)return;frame=requestAnimationFrame(draw);if(document.hidden){last=now;return;}const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
  if(renderer.domElement.width!==Math.round(width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))-stickY,side=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+stickX;
  hubStep(camera.position,yaw,forward,side,dt);camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();space.update(time);
  space.folders.forEach((folder,i)=>{const point=folder.position.clone().add(new THREE.Vector3(0,-.85,0)).project(camera);labels[i].hidden=point.z>1||point.z< -1||Math.abs(point.x)>.95||Math.abs(point.y)>.95;labels[i].style.left=(point.x*.5+.5)*width+'px';labels[i].style.top=(-point.y*.5+.5)*height+'px';});
  renderer.render(scene,camera);
 }
 function start(saved){stop();active=true;time=Number.isFinite(saved?.time)?saved.time:0;yaw=Number.isFinite(saved?.yaw)?saved.yaw:0;pitch=Number.isFinite(saved?.pitch)?saved.pitch:0;camera.position.set(0,1.65,12);if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.z)&&Math.hypot(saved.x,saved.z)>=2.2&&Math.hypot(saved.x,saved.z)<=24)camera.position.set(saved.x,1.65,saved.z);camera.rotation.set(pitch,yaw,0);space.update(time);last=performance.now();status.textContent='选择 Town Life 进入村庄';musicLabel();frame=requestAnimationFrame(draw);canvas.focus();}
 function stop(){active=false;cancelAnimationFrame(frame);release();labels.forEach(label=>label.hidden=true);}
 return {start,stop,snapshot:()=>({x:camera.position.x,z:camera.position.z,yaw,pitch,time})};
}
