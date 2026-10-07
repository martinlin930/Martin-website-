// Keep the local character in shadow passes without covering the first-person view.
export function prepareAvatarShadow(body){
 body.traverse(node=>{if(node.isMesh){
  node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
  for(const material of [].concat(node.material)){material.colorWrite=false;material.depthWrite=false;}
  node.castShadow=true;node.receiveShadow=false;node.frustumCulled=false;
 }});
 return body;
}
