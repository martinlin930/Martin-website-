import * as THREE from './vendor/three.module.js';

export function galleryShafts(scene){
 const positions=[-21,-13,-5,3,11,19].map(x=>[x,-17.35,x+3.3,-13.8]);
 const shafts=[];
 for(const [x,z,tx,tz] of positions){
  const start=new THREE.Vector3(x,7.85,z),end=new THREE.Vector3(tx,3.53,tz),length=start.distanceTo(end);
  const group=new THREE.Group();group.position.copy(start).add(end).multiplyScalar(.5);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),start.clone().sub(end).normalize());
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{beamColor:{value:new THREE.Color(0xffefd3)}},
   vertexShader:'varying vec2 beamUv;void main(){beamUv=uv;vec3 p=position;p.x*=mix(1.8,.10,uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
   fragmentShader:'varying vec2 beamUv;uniform vec3 beamColor;void main(){float edge=1.0-smoothstep(.08,.5,abs(beamUv.x-.5));float fade=smoothstep(0.,.15,beamUv.y)*(1.0-smoothstep(.92,1.,beamUv.y));float alpha=edge*edge*fade*.11;gl_FragColor=vec4(beamColor,alpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  // Shader preprocessor directives must start on their own lines.
  material.fragmentShader=material.fragmentShader.replace(';#include',';\n#include');
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,length),material);mesh.renderOrder=2;group.add(mesh);scene.add(group);
  shafts.push({group,mesh,inverse:group.quaternion.clone().invert()});
 }
 const local=new THREE.Vector3();
 return {shafts,update(camera){for(const shaft of shafts){local.copy(camera).sub(shaft.group.position).applyQuaternion(shaft.inverse);shaft.mesh.rotation.y=Math.atan2(local.x,local.z);}}};
}
