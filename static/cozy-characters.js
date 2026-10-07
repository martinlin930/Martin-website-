import * as THREE from './vendor/three.module.js';

// Smooth three-dimensional heads, compact bodies and accessories from the supplied views.
export function createCozyCharacter(kind){
 const root=new THREE.Group();root.userData.animated=true;
 const bodyColor=kind==='rabbit'?0xfff1c5:0xfffaf7;
 const bodyMaterial=new THREE.MeshStandardMaterial({color:bodyColor,roughness:.86});
 const pink=new THREE.MeshStandardMaterial({color:0xf4b7cc,roughness:.9});
 const blue=new THREE.MeshStandardMaterial({color:0x80abc4,roughness:.8});
 const white=new THREE.MeshStandardMaterial({color:0xfffcf4,roughness:.9});
 const sphere=new THREE.SphereGeometry(1,40,28),limbs=[];
 function ellipsoid(material,x,y,z,sx,sy,sz,parent=root){const mesh=new THREE.Mesh(sphere,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
 const head=ellipsoid(bodyMaterial,0,1.24,0,.79,.70,.65);
 ellipsoid(bodyMaterial,0,.44,-.03,.49,.49,.39);
 for(const side of [-1,1]){const arm=ellipsoid(bodyMaterial,side*.47,.46,.005,.12,.25,.135);arm.rotation.z=side*.23;limbs.push(arm);limbs.push(ellipsoid(bodyMaterial,side*.27,.115,.04,.13,.18,.15));}
 ellipsoid(kind==='cat'?blue:white,0,.32,-.42,kind==='rabbit'?.16:.105,kind==='rabbit'?.16:.105,.12);
 if(kind==='rabbit'){
  for(const side of [-1,1]){
   const ear=new THREE.Group();ear.position.set(side*.24,1.87,0);ear.rotation.z=-side*.055;root.add(ear);
   ellipsoid(bodyMaterial,0,.34,0,.14,.43,.14,ear);
   // Raised pink inset follows the front of the ear, with no coplanar overlap.
   ellipsoid(pink,0,.35,.108,.081,.345,.044,ear);
  }
 }else if(kind==='bear'){
  for(const side of [-1,1])ellipsoid(bodyMaterial,side*.48,1.82,-.03,.15,.17,.145);
 }else{
  // Curved blue cap with two scallops meeting above the forehead.
  const vertices=[],indices=[],rows=18,columns=64;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
   const phi=col/columns*Math.PI*2,front=Math.max(0,Math.cos(phi));
   const boundary=.95+.22*front*Math.abs(Math.sin(phi*2));
   const theta=row/rows*boundary;
   vertices.push(.8*Math.sin(theta)*Math.sin(phi),1.24+.71*Math.cos(theta),.66*Math.sin(theta)*Math.cos(phi));
  }
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const cap=new THREE.Mesh(geometry,blue);cap.material.side=THREE.DoubleSide;root.add(cap);
  for(const side of [-1,1]){
   const profile=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.18,0),new THREE.Vector3(.16,-.16,0),new THREE.Vector3(.18,-.04,0),new THREE.Vector3(.12,.13,0),new THREE.Vector3(.055,.27,0),new THREE.Vector3(0,.31,0)]);
   const ear=new THREE.Mesh(new THREE.LatheGeometry(profile.getPoints(24).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)),32),blue);ear.position.set(side*.46,1.78,-.035);ear.rotation.z=-side*.18;root.add(ear);
  }
 }
 // Face decal is curved along the ellipsoid instead of floating on a flat card.
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;const ctx=canvas.getContext('2d'),ink='#4c3530';ctx.lineCap='round';ctx.lineJoin='round';
 ctx.fillStyle='#f4b3c5';for(const cx of [102,666]){ctx.beginPath();ctx.ellipse(cx,327,78,43,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=8;for(let j=0;j<4;j++){ctx.beginPath();ctx.moveTo(cx-38+j*24,309);ctx.lineTo(cx-48+j*24,339);ctx.stroke();}}
 for(const cx of [240,528]){ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(cx,252,43,48,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fffdf8';ctx.beginPath();ctx.ellipse(cx-7,235,23,18,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(cx+6,274,21,7,0,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=ink;ctx.lineWidth=7;for(const cx of [240,528]){ctx.beginPath();ctx.moveTo(cx-23,151);ctx.quadraticCurveTo(cx,140,cx+21,149);ctx.stroke();}
 ctx.fillStyle=ink;ctx.beginPath();ctx.ellipse(384,322,8,6,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(354,341);ctx.bezierCurveTo(353,361,378,363,384,344);ctx.bezierCurveTo(390,363,415,361,415,341);ctx.stroke();ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(376,379);ctx.quadraticCurveTo(384,382,392,379);ctx.stroke();
 if(kind==='rabbit'){ctx.beginPath();ctx.moveTo(384,359);ctx.quadraticCurveTo(381,385,402,386);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const faceGeometry=new THREE.PlaneGeometry(1.42,.93,36,24),positions=faceGeometry.attributes.position;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i)-.03;positions.setXYZ(i,x,y,.65*Math.sqrt(Math.max(.005,1-x*x/(.79*.79)-y*y/(.70*.70)))+.008);}
 faceGeometry.computeVertexNormals();const face=new THREE.Mesh(faceGeometry,new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,roughness:1}));face.position.y=1.24;root.add(face);
 function strap(color){const points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;points.push(new THREE.Vector3(Math.sin(a)*.46,.52+Math.sin(a)*.12,Math.cos(a)*.395));}root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),64,.018,8,true),new THREE.MeshStandardMaterial({color,roughness:.9})));}
 if(kind==='bear'){
  strap(0xf4eee7);const bag=new THREE.Group();bag.position.set(.27,.39,.39);root.add(bag);const bagMaterial=new THREE.MeshStandardMaterial({color:0xf0aeba,roughness:.8});ellipsoid(bagMaterial,0,0,0,.19,.20,.08,bag);for(const side of [-1,1])ellipsoid(bagMaterial,side*.11,.15,0,.065,.065,.045,bag);ellipsoid(white,0,-.035,.077,.075,.065,.012,bag);for(const side of [-1,1])ellipsoid(new THREE.MeshBasicMaterial({color:ink}),side*.027,-.027,.09,.009,.011,.006,bag);
 }else if(kind==='rabbit'){
  strap(0xfffcdf);const star=new THREE.Shape();for(let i=0;i<10;i++){const angle=i*Math.PI/5+Math.PI/2,r=i%2?.105:.22;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();const geometry=new THREE.ExtrudeGeometry(star,{depth:.06,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1});const bag=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffe76a,roughness:.65}));bag.position.set(.25,.37,.37);root.add(bag);for(const side of [-1,1])ellipsoid(new THREE.MeshBasicMaterial({color:ink}),.25+side*.045,.385,.465,.012,.014,.008);
 }else{
  strap(0x6ca7b8);const camera=new THREE.Group();camera.position.set(0,.4,.43);root.add(camera);const box=new THREE.Mesh(new THREE.BoxGeometry(.44,.29,.12),new THREE.MeshStandardMaterial({color:0x383c40,roughness:.65}));camera.add(box);const top=new THREE.Mesh(new THREE.BoxGeometry(.46,.085,.13),new THREE.MeshStandardMaterial({color:0xd4d9db,metalness:.25,roughness:.5}));top.position.y=.13;camera.add(top);ellipsoid(new THREE.MeshStandardMaterial({color:0xd7dcda,metalness:.3,roughness:.4}),0,-.015,.073,.10,.10,.022,camera);ellipsoid(new THREE.MeshStandardMaterial({color:0x2c414c,roughness:.25}),0,-.015,.094,.063,.063,.014,camera);ellipsoid(white,-.12,.045,.067,.025,.018,.008,camera);
 }
 return {root,limbs,head};
}
