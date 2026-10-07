import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export async function loadCozyCharacter(kind){
 const file=kind==='rabbit'?'usagi':'chiikawa';
 const asset=await new GLTFLoader().loadAsync('/static/models/cozy/'+file+'.glb');
 const model=asset.scene;model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid character bounds');
 const scale=(kind==='rabbit'?2.7:2)/size.y;
 model.scale.multiplyScalar(scale);
 model.position.set(-(bounds.min.x+bounds.max.x)*.5*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*.5*scale);
 const root=new THREE.Group();root.userData.animated=true;root.add(model);
 return {root,limbs:[]};
}
