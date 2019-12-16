import * as THREE from 'three';

interface ShaderState {
  uniforms: Record<string, any>;
  mesh: THREE.Mesh;
}

type Point = [number, number];

interface Metaball {
  position: Point;
  radius: number;
}

interface AnimationState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.Renderer;
  shader: ShaderState;
  aspectRatio: number;
  mouse: Point;
  metaballs?: Metaball[];
  time: { start: number, elapsed: number };
}

const aspectRatio = (): number => window.innerWidth / window.innerHeight;

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
      type: "float", value: Number.POSITIVE_INFINITY,
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

const windowSizeUpdater = (state: AnimationState): (e: UIEvent) => void => {
  return (e: UIEvent) => {
    state.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const mouseUpdater = (state: AnimationState): (e: MouseEvent) => void => {
  return (e: MouseEvent) => {
    state.mouse = [
      2 * (e.pageX - (window.innerWidth / 2)) / window.innerWidth,
      2 * ((window.innerHeight - e.pageY) - (window.innerHeight / 2))
      / window.innerHeight
    ];
    if (state.aspectRatio > 1) {
      state.mouse[0] *= state.aspectRatio;
    } else {
      state.mouse[1] /= state.aspectRatio;
    }
  };
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
  let state: AnimationState = {
    scene,
    camera,
    renderer,
    aspectRatio,
    mouse: [0, 0],
    shader: { uniforms, mesh },
    time: { start: Date.now(), elapsed: 0 }
  };
  document.onmousemove = mouseUpdater(state);
  window.addEventListener('resize', windowSizeUpdater(state), false);
  return state;
};

interface Oscillation {
  period?: number;
  tOffset?: number;
  outMin?: number;
  outMax?: number;
  fn?: (x: number) => number;
}

const oscillate = (t: number, {
  period = 4000,
  tOffset = 0,
  outMin = -0.5,
  outMax = 0.5,
  fn = Math.sin,
}: Oscillation): number => {
  const range = outMax - outMin;
  const tScale = 2 * Math.PI / period;
  return fn((t + tOffset) * tScale) * range / 2 + (range / 2) + outMin;
};


interface Orbit {
  period?: number,
  tOffset?: number,
  xAxis?: number,
  yAxis?: number,
}

const orbit = (t: number, {
  period = 4000,
  tOffset = 0,
  xAxis = 1,
  yAxis = 1,
}: Orbit): Point => {
  return [
    oscillate(t,
      {
        period: period,
        tOffset: tOffset,
        outMin: -xAxis,
        outMax: xAxis,
      }),
    oscillate(t,
      {
        period: period,
        tOffset: tOffset,
        outMin: -yAxis,
        outMax: yAxis,
        fn: Math.cos
      })];
}

interface CircularOrbit extends Orbit {
  radius?: number;
};

const circularOrbit = (t: number, {
  period = 4000, tOffset = 0, radius = 1,
}: CircularOrbit): Point => {
  return orbit(t, {
    period, tOffset,
    xAxis: radius,
    yAxis: radius,
  });
}

const orbitalRing = (t: number, orbit: CircularOrbit,
  num_balls: number, ball_radius: number): Metaball[] {
  let balls: Metaball[] = [];
  for (let i = 0; i < num_balls; i++) {
    orbit.tOffset = i * (orbit.period / num_balls)
    balls.push({
      position: circularOrbit(t, orbit),
      radius: ball_radius,
    });
  }
  return balls;
}

const metaballState = (state: AnimationState): Metaball[] => {
  let metaballs: Metaball[] = [];
  const num_balls = 4;
  const period = 16000;
  const radius = 0.77;
  metaballs.push({ position: state.mouse, radius: 0.06 });
  metaballs.push({
    position:
      circularOrbit(state.time.elapsed, { period: 32000, radius: radius - 0.05 }),
    radius: 0.08
  });
  metaballs.push({
    position:
      circularOrbit(state.time.elapsed { period: 32000, radius: 0.00 }),
    radius: 0.1688
  });
  metaballs.push(...orbitalRing(state.time.elapsed,
    { period: period, radius: radius }, num_balls, 0.06));
  metaballs.push(...orbitalRing(state.time.elapsed,
    { period: -period, radius: radius }, num_balls, 0.06));
  // if (state.time.elapsed % 30 === 0) {
  //   console.log(metaballs[0].position)
  //   console.log(metaballs);
  // }
  return metaballs;
}

interface MetaballUniformValues {
  u_num_metaballs: number;
  u_metaball_pos: number[];
  u_metaball_radius: number[];
  u_threshold: number;
}

const metaballsToUniforms = (metaballs: Metaball[]): MetaballUniformValues => {
  let flat_positions: number[] = [];
  let radii: number[] = [];
  for (const metaball of metaballs) {
    flat_positions.push(metaball.position[0], metaball.position[1]);
    radii.push(metaball.radius);
  }
  return {
    u_num_metaballs: metaballs.length,
    u_metaball_pos: flat_positions,
    u_metaball_radius: radii,
    u_threshold: 0.3,
  }
}

const update = (state: AnimationState): AnimationState => {
  state.time.elapsed = Date.now() - state.time.start;

  state.shader.uniforms.u_resolution.value.x = state.renderer.domElement.width;
  state.shader.uniforms.u_resolution.value.y = state.renderer.domElement.height;

  state.aspectRatio = aspectRatio();

  const metaballs = metaballState(state);
  const {
    u_num_metaballs,
    u_metaball_pos,
    u_metaball_radius,
    u_threshold } =
    metaballsToUniforms(metaballs);
  state.shader.uniforms['u_num_metaballs'].value = u_num_metaballs;
  state.shader.uniforms['u_metaball_pos'].value = u_metaball_pos;
  state.shader.uniforms['u_metaball_radius'].value = u_metaball_radius;
  state.shader.uniforms['u_threshold'].value = u_threshold;

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
