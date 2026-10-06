
import * as THREE from '/static/vendor/three.module.js';
import { GLTFLoader } from '/static/vendor/GLTFLoader.js';

export function assemblePlayer(player, record) {
    player.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(player);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 3 / Math.max(size.x, size.z);
    const group = new THREE.Group();
    player.scale.setScalar(scale);
    player.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    group.add(player);
    record.updateMatrixWorld(true);
    const discBounds = new THREE.Box3().setFromObject(record);
    const discSize = discBounds.getSize(new THREE.Vector3());
    const discCenter = discBounds.getCenter(new THREE.Vector3());
    const discScale = (907 * scale * .94) / Math.max(discSize.x, discSize.z);
    record.scale.setScalar(discScale);
    record.position.set(-discCenter.x * discScale, -discBounds.min.y * discScale, -discCenter.z * discScale);
    const spindle = new THREE.Group();
    spindle.position.set((1452.76 - center.x) * scale, (260.21 - bounds.min.y) * scale + .004, (1021.15 - center.z) * scale);
    spindle.add(record);
    group.add(spindle);
    group.traverse(object => {
        if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    return { group, spindle };
}

export async function createRecordScene(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 50);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc5c5c5, 2.3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-3, 7, 5); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
    light.shadow.bias = -.001;
    scene.add(light);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .13 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.005; floor.receiveShadow = true; scene.add(floor);
    const loader = new GLTFLoader();
    let assets;
    try { assets = await Promise.all([
        loader.loadAsync('/static/models/record-player.glb'),
        loader.loadAsync('/static/models/vinyl-record.glb')
    ]); } catch (error) { renderer.dispose(); throw error; }
    const {group, spindle} = assemblePlayer(assets[0].scene, assets[1].scene);
    scene.add(group);
    let yaw = -1.05, pitch = .65, distance = 7.4, active = false, frame = 0, previous = 0, pointer = null;
    const target = new THREE.Vector3(0, 1.15, 0);
    function draw(time) {
        if (!active) return;
        const dt = previous ? Math.min((time - previous) / 1000, .05) : 0; previous = time;
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) spindle.rotation.y += dt * .4;
        const width = canvas.clientWidth, height = canvas.clientHeight;
        if (width && height) {
            const pixelRatio = renderer.getPixelRatio();
            if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) renderer.setSize(width, height, false);
            camera.aspect = width / height; camera.updateProjectionMatrix();
            const radius = distance * (width < height ? 1.25 : 1);
            camera.position.set(Math.sin(yaw) * Math.cos(pitch) * radius, target.y + Math.sin(pitch) * radius, Math.cos(yaw) * Math.cos(pitch) * radius);
            camera.lookAt(target); renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(draw);
    }
    canvas.addEventListener('pointerdown', event => {
        if (!active || pointer) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
        if (!pointer || event.pointerId !== pointer.id) return;
        yaw -= (event.clientX - pointer.x) * .006;
        pitch = THREE.MathUtils.clamp(pitch + (event.clientY - pointer.y) * .006, .12, 1.25);
        pointer.x = event.clientX; pointer.y = event.clientY;
    });
    function release(event) { if (pointer?.id === event.pointerId) pointer = null; }
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('wheel', event => {
        if (!active) return; event.preventDefault();
        distance = THREE.MathUtils.clamp(distance + event.deltaY * .006, 4.5, 11);
    }, { passive: false });
    return {
        start(saved) {
            yaw = Number.isFinite(saved?.yaw) ? saved.yaw : -1.05;
            pitch = Number.isFinite(saved?.pitch) ? THREE.MathUtils.clamp(saved.pitch, .12, 1.25) : .65;
            distance = Number.isFinite(saved?.distance) ? THREE.MathUtils.clamp(saved.distance, 4.5, 11) : 7.4;
            if (!active) { active = true; previous = 0; frame = requestAnimationFrame(draw); }
        },
        stop() { active = false; cancelAnimationFrame(frame); pointer = null; previous = 0; },
        snapshot() { return { yaw, pitch, distance }; }
    };
}
