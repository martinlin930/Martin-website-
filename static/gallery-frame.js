import * as THREE from './vendor/three.module.js';
export function normalizePictureFrame(model){
 const root=new THREE.Group(),rotation=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-.573569715,0,.819156766).normalize(),new THREE.Vector3(0,0,1)));
 model.updateMatrixWorld(true);
 model.traverse(mesh=>{if(mesh.isMesh){const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.applyMatrix4(rotation);const copy=new THREE.Mesh(geometry,mesh.material.clone());root.add(copy);}});
 const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3());root.children.forEach(m=>m.geometry.translate(-center.x,-center.y,-center.z));
 const backing=root.children.find(m=>m.material.name==='02___Default');backing.geometry.computeBoundingBox();
 const opening=backing.geometry.boundingBox.clone(),bounds=new THREE.Box3().setFromObject(root);
 root.remove(backing);
 root.traverse(mesh=>{if(mesh.isMesh){mesh.material.roughness=.52;mesh.material.metalness=0;}});
 return {root,opening,bounds};
}
export function fitPictureFrame(template,width,height){
 const group=template.root.clone(true),opening=template.opening,size=opening.getSize(new THREE.Vector3());
 group.scale.set(width/size.x,height/size.y,.06/(template.bounds.max.z-template.bounds.min.z));
 group.position.set(-opening.getCenter(new THREE.Vector3()).x*group.scale.x,-opening.getCenter(new THREE.Vector3()).y*group.scale.y,0);
 group.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 return {group,photoDepth:template.bounds.max.z*group.scale.z-.005};
}
