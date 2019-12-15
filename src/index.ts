import * as THREE from 'three';

interface ShaderState {
  uniforms: Record<string, any>;
  mesh: THREE.Mesh;
}

interface AnimationState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.Renderer;
  shader: ShaderState;
  objs?: Record<string, any>;
}

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  return response.text();
}

const initShader = async () => {
  const [vertexShader, fragmentShader] = await Promise.all([
    fetchText("shader/metaball.vert"),
    fetchText("shader/metaball.frag")
  ]);
  let geometry = new THREE.PlaneBufferGeometry(2, 2);
  let uniforms = {
    u_resolution: {
      type: "v2", value: new THREE.Vector2(window.innerWidth,
        window.innerHeight)
    },
    u_mouse: { type: "v2", value: new THREE.Vector2() },
    u_metaball_pos: { type: "v2v", value: [0.0, 0.0, 0.0, 0.0] },
    u_metaball_radius: {
      type: "fv", value: [0.2, 0.2]
    },
    u_num_metaballs: {
      type: "int", value: 2
    },
    u_threshold: {
      type: "float", value: 0.5
    },
  };
  let material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader
  });
  let mesh = new THREE.Mesh(geometry, material);
  return { uniforms, mesh };
}

const init = async (): Promise<AnimationState> => {
  let scene = new THREE.Scene();

  const aspectRatio = window.innerWidth / window.innerHeight;
  let camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.z = 1;

  let { uniforms, mesh } = await initShader();
  scene.add(mesh);

  let renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  return {
    scene,
    camera,
    renderer,
    shader: { uniforms, mesh }
  };
};

const update = (state: AnimationState): AnimationState => {
  return state;
}


const animate = (state: AnimationState) => {
  state = update(state);
  state.renderer.render(state.scene, state.camera);
  requestAnimationFrame(() => { animate(state); });
}

const start = async () => {
  let state = await init();
  animate(state);
}

start();
console.log('Animation begun.');
