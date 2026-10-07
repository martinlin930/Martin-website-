import * as THREE from './vendor/three.module.js';

export function galleryShafts(scene){
 const positions=[[-22.2,-17.35,-18.9,-13.8],[-7.8,-5.8,-10,-8.2],[-6.1,-15.1,-3.9,-13.1],[8.45,-7.4,6.3,-9.5],[9.98,-15.1,12.2,-13.1],[24.6,-5.8,22.4,-8]];
 const shafts=[];
 for(const [x,z,tx,tz] of positions){
  const start=new THREE.Vector3(x,7.85,z),end=new THREE.Vector3(tx,3.53,tz),length=start.distanceTo(end);
  const light=new THREE.SpotLight(0xfff2d9,105,10,.27,.78,2);light.position.copy(start);light.target.position.copy(end);scene.add(light,light.target);
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
