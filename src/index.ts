import * as THREE from 'three';

interface AnimationState {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.Renderer;
    objs: Record<string, any>;
}

const init = (): AnimationState => {
    let scene = new THREE.Scene();

    const aspectRatio = window.innerWidth / window.innerHeight;
    let camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 5;

    let renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    let geometry = new THREE.BoxGeometry(1, 1, 1);
    let material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    let cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    return {
        scene: scene,
        camera: camera,
        renderer: renderer,
        objs: { cube: cube }
    };

};

const update = (state: AnimationState): AnimationState => {
    state.objs.cube.rotation.x += 0.01;
    state.objs.cube.rotation.y += 0.01;
    return state;
}


const animate = (state: AnimationState) => {
    state = update(state);
    state.renderer.render(state.scene, state.camera);
    requestAnimationFrame(() => { animate(state); });
}

const start = () => {
    let state = init();
    animate(state);
}

start();
console.log('Animation begun.');
