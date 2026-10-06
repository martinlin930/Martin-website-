
import * as THREE from '/static/vendor/three.module.js';
import { GLTFLoader } from '/static/vendor/GLTFLoader.js';

// Front face of the supplied computer's display: top-left, top-right,
// bottom-right, bottom-left, viewed from the keyboard side.
export const SCREEN_CORNERS = [
    [.0821959823, .3871329129, .0389943682],
    [-.1475400031, .3729937077, .0378584005],
    [-.1360301971, .1841550022, .0606130697],
    [.0937057585, .1982938945, .0617490411]
];
export function screenFrame(model) {
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 6;
    const offset = new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.scale.setScalar(scale); model.position.copy(offset); model.updateMatrixWorld(true);
    const corners = SCREEN_CORNERS.map(p => new THREE.Vector3(...p).multiplyScalar(scale).add(offset));
    const right = corners[1].clone().sub(corners[0]);
    const down = corners[3].clone().sub(corners[0]);
    const normal = down.clone().cross(right).normalize();
    corners.forEach(p => p.addScaledVector(normal, .001));
    return {
        corners, right, up: down.clone().negate().normalize(), normal,
        center: corners.reduce((sum,p) => sum.add(p), new THREE.Vector3()).multiplyScalar(.25),
        width: right.length(), height: down.length(),
        modelCenter: new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()),
        modelSize: new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()),
        scale, offset
    };
}
export function screenViewDirection(screen) {
    return screen.normal.clone().addScaledVector(screen.right.clone().normalize(), .34).addScaledVector(screen.up, .22).normalize();
}
export function fitDistance(width, height, aspect, fov, widthFraction=.84, heightFraction=.72) {
    const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    return Math.max(height / (2 * tan * heightFraction), width / (2 * tan * aspect * widthFraction));
}
// Map an ordinary clickable HTML rectangle onto the four projected screen corners.
export function screenTransform(points, width, height) {
    const [p0,p1,p2,p3] = points;
    const dx1=p1.x-p2.x, dx2=p3.x-p2.x, dx3=p0.x-p1.x+p2.x-p3.x;
    const dy1=p1.y-p2.y, dy2=p3.y-p2.y, dy3=p0.y-p1.y+p2.y-p3.y;
    const denominator=dx1*dy2-dx2*dy1;
    if (Math.abs(denominator)<1e-8) return null;
    const g=(dx3*dy2-dx2*dy3)/denominator;
    const h=(dx1*dy3-dx3*dy1)/denominator;
    const a=p1.x-p0.x+g*p1.x, b=p3.x-p0.x+h*p3.x;
    const d=p1.y-p0.y+g*p1.y, e=p3.y-p0.y+h*p3.y;
    return [a/width,d/width,0,g/width,b/height,e/height,0,h/height,0,0,1,0,p0.x,p0.y,0,1];
}
export async function createComputerScreen({canvas, desktop}) {
    const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(any-pointer: coarse)').matches?1.5:2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0xf3f3ee);
    scene.add(new THREE.HemisphereLight(0xffffff,0xc5c5ba,2.4));
    const light=new THREE.DirectionalLight(0xffffff,3);
    light.position.set(3,7,-5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);
    Object.assign(light.shadow.camera,{left:-4,right:4,top:5,bottom:-4});light.shadow.bias=-.001;scene.add(light);
    let model;
    try { model=(await new GLTFLoader().loadAsync('/static/models/simple-computer.glb')).scene; }
    catch(error){renderer.dispose();throw error;}
    const screen=screenFrame(model); scene.add(model);
    model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.12}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    const camera=new THREE.PerspectiveCamera(36,1,.01,100);
    const width=640,height=width*screen.height/screen.width;
    const viewDirection=screenViewDirection(screen);
    desktop.style.width=width+'px';desktop.style.height=height+'px';
    let active=false, frame=0, token=0, settle=null, progress=1, source=null;
    let viewportWidth=0,viewportHeight=0;
    const from=new THREE.Vector3(),to=new THREE.Vector3(),fromTarget=new THREE.Vector3(),target=new THREE.Vector3(),worldUp=new THREE.Vector3(0,1,0);
    const projected=screen.corners.map(()=>new THREE.Vector3());
    const points=screen.corners.map(()=>({x:0,y:0}));
    function configure(t) {
        const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return false;
        if(w!==viewportWidth||h!==viewportHeight){
            viewportWidth=w;viewportHeight=h;renderer.setSize(w,h,false);
        }
        const aspect=w/h;
        const rect=source?.rect;
        const sourceAspect=rect&&rect.width>0&&rect.height>0?rect.width/rect.height:aspect;
        camera.aspect=THREE.MathUtils.lerp(sourceAspect,aspect,t);
        camera.fov=THREE.MathUtils.lerp(source?.fov||36,36,t);
        camera.updateProjectionMatrix();
        if(rect&&rect.width>0&&rect.height>0){
            const sx=THREE.MathUtils.lerp(rect.width/w,1,t),sy=THREE.MathUtils.lerp(rect.height/h,1,t);
            const ox=((rect.left+rect.width/2)/w*2-1)*(1-t);
            const oy=(1-(rect.top+rect.height/2)/h*2)*(1-t);
            const elements=camera.projectionMatrix.elements;
            elements[0]*=sx;elements[5]*=sy;elements[8]=elements[8]*sx-ox;elements[9]=elements[9]*sy-oy;
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        }
        const distance=fitDistance(screen.width,screen.height,aspect,36,.78,.65);
        const initialDistance=fitDistance(screen.modelSize.x,screen.modelSize.y,aspect,36,.62,.66);
        fromTarget.copy(screen.modelCenter);
        if(source?.orbit&&source?.target){
            fromTarget.set(source.target.x,source.target.y,source.target.z).multiplyScalar(screen.scale).add(screen.offset);
            from.setFromSphericalCoords(source.orbit.radius*screen.scale,source.orbit.phi,source.orbit.theta).add(fromTarget);
        }else{
            from.set(.4,.25,-.88).normalize().multiplyScalar(initialDistance).add(fromTarget);
        }
        to.copy(screen.center).addScaledVector(viewDirection,distance);
        camera.position.lerpVectors(from,to,t);
        camera.up.copy(worldUp);
        target.lerpVectors(fromTarget,screen.center,t);camera.lookAt(target);camera.updateMatrixWorld(true);
        return true;
    }
    function render(t) {
        if(!configure(t))return;
        renderer.render(scene,camera);
        const w=canvas.clientWidth,h=canvas.clientHeight;
        screen.corners.forEach((p,i)=>{const v=projected[i].copy(p).project(camera);points[i].x=(v.x+1)*w/2;points[i].y=(1-v.y)*h/2;});
        const matrix=screenTransform(points,width,height);
        if(matrix)desktop.style.transform='matrix3d('+matrix.join(',')+')';
        desktop.style.opacity=String(THREE.MathUtils.smoothstep(t,.2,.85));
        desktop.style.pointerEvents=t>=1?'auto':'none';
    }
    // Compile and render once while hidden; shadows stay fixed for this static scene.
    configure(0);
    if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
    renderer.render(scene,camera);
    renderer.shadowMap.autoUpdate=false;
    desktop.style.opacity='0';
    const resize=new ResizeObserver(()=>{if(active)render(progress);});
    resize.observe(canvas);
    return {
        start(instant=false,origin=null){
            source=origin;
            token++;const thisToken=token;cancelAnimationFrame(frame);settle?.();active=true;
            const reduced=instant||matchMedia('(prefers-reduced-motion: reduce)').matches;
            return new Promise(resolve=>{
                settle=resolve;const start=performance.now();
                function tick(now){
                    if(!active||thisToken!==token){resolve();return;}
                    const raw=reduced?1:Math.min((now-start)/900,1);
                    progress=raw*raw*(3-2*raw);render(progress);
                    if(raw<1)frame=requestAnimationFrame(tick);
                    else{desktop.style.pointerEvents='auto';settle=null;resolve();}
                }
                frame=requestAnimationFrame(tick);
            });
        },
        stop(){active=false;token++;cancelAnimationFrame(frame);settle?.();settle=null;desktop.style.opacity='0';desktop.style.pointerEvents='none';}
    };
}
