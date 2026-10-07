import * as THREE from './vendor/three.module.js';

// Generate once; clouds do not add geometry or per-frame simulation.
export function createDaySky(){
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const sky=ctx.createLinearGradient(0,0,0,h*.58);
 sky.addColorStop(0,'#3289db');sky.addColorStop(.55,'#6db8ed');sky.addColorStop(.86,'#bce2fa');sky.addColorStop(1,'#deeff9');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 let seed=73421;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<24;i++){
  const x=random()*w,y=h*(.12+random()*.31),size=60+random()*125;
  const puffs=Array.from({length:7},()=>({dx:(random()-.5)*size*2.5,dy:(random()-.5)*size*.28,r:size*(.25+random()*.3)}));
  for(const wrap of [-w,0,w])for(const p of puffs){
   ctx.save();ctx.translate(x+wrap+p.dx,y+p.dy);ctx.scale(1,.55);
   const glow=ctx.createRadialGradient(0,-p.r*.14,p.r*.12,0,0,p.r);
   glow.addColorStop(0,'rgba(255,255,255,.96)');glow.addColorStop(.55,'rgba(252,254,255,.88)');glow.addColorStop(.8,'rgba(237,246,254,.45)');glow.addColorStop(1,'rgba(237,246,254,0)');
   ctx.fillStyle=glow;ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);ctx.restore();
  }
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;texture.wrapS=THREE.RepeatWrapping;
 return texture;
}
