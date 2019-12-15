import * as THREE from 'three';

interface ShaderState {
  uniforms: Record<string, any>;
  mesh: THREE.Mesh;
}

interface Metaball {
  position: [number, number];
  radius: number;
}

interface AnimationState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.Renderer;
  shader: ShaderState;
  aspectRatio: number;
  metaballs?: Metaball[];
  time: { start: number, elapsed: number };
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
    u_metaball_pos: { type: "v2v", value: [] },
    u_metaball_radius: {
      type: "fv", value: []
    },
    u_num_metaballs: {
      type: "int", value: 2
    },
    u_threshold: {
      type: "float", value: 0.3
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
    aspectRatio,
    shader: { uniforms, mesh },
    time: { start: Date.now(), elapsed: 0 }
  };
};

interface Oscillation {
  inScale: number;
  inOffset: number;
  outMin: number;
  outMax: number;
  fn: (x: number) => number;
}

const oscillate = (t: number, {
  inScale = 1 / 1000,
  inOffset = 0,
  outMin = 0,
  outMax = 1,
  fn = Math.sin,
}: Oscillation): number => {
  const range = outMax - outMin;
  return fn(t * inScale + inOffset) * range / 2 + (range / 2) + outMin;
};

const metaballState = (state: AnimationState): Metaball[] => {
  console.log([oscillate(state.time.elapsed, {}),
  oscillate(state.time.elapsed, { fn: Math.cos })])
  let metaballs: Metaball[] = [
    {
      position: [
        oscillate(state.time.elapsed,
          {
            outMin: 0.1,
            outMax: 1 / state.aspectRatio
          }),
        oscillate(state.time.elapsed,
          {
            outMin: 0.1,
            outMax: 1 / state.aspectRatio, fn: Math.cos
          })],
      radius: 0.02;
    }, { position: [0.2, 0.2], radius: 0.02 },
  ];
  return metaballs;
}

interface MetaballUniformValues {
  u_metaball_pos: number[];
  u_metaball_radius: number[];
}

const metaballsToUniforms = (metaballs: Metaball[]): MetaballUniformValues => {
  let flat_positions: number[] = [];
  let radii: number[] = [];
  for (const metaball of metaballs) {
    flat_positions.push(metaball.position[0], metaball.position[1]);
    radii.push(metaball.radius);
  }
  return {
    u_metaball_pos: flat_positions,
    u_metaball_radius: radii,
  }
}

const update = (state: AnimationState): AnimationState => {
  state.time.elapsed = Date.now() - state.time.start;

  const metaballs = metaballState(state);
  const { u_metaball_pos, u_metaball_radius } = metaballsToUniforms(metaballs);
  state.shader.uniforms['u_metaball_pos'].value = u_metaball_pos;
  state.shader.uniforms['u_metaball_radius'].value = u_metaball_radius;

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
