import * as THREE from 'three';
import { Vec2 } from './common-types';
import { Metaball, MetaballKind, metaballScene } from './metaball';
import { OrbitWorld } from './orbit-world';
// import * as gifjs from './assets/js/gif'
import * as RL from './rl';

interface ShaderState {
  uniforms: Record<string, any>;
  mesh: THREE.Mesh;
}

interface RLState {
  agent: RL.Agent;
  lastAction?: RL.ActionProp;
  lastState?: any;
}

interface AnimationState {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.Renderer;
  canvas: HTMLCanvasElement;
  shader: ShaderState;
  aspectRatio: number;
  mouse: Vec2;
  metaballs?: Metaball[];
  time: {
    // Time (millis) at which the animation started.
    start: number;
    // Time (millis) elapsed since the beginning.
    elapsed: number;
    // Time (millis) elapsed since last step.
    stepTime: number;
    // Number of steps elapsed.
    steps: number;
  };
  world: OrbitWorld;
}

const getAspectRatio = (): number => window.innerWidth / window.innerHeight;

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  return response.text();
};

const initShader = async () => {
  const [vertexShader, fragmentShader] = await Promise.all([
    fetchText('shader/metaball.vert'),
    fetchText('shader/metaball.frag')
  ]);
  const geometry = new THREE.PlaneBufferGeometry(2, 2);
  const uniforms: Record<
    string,
    { type: string; value: number[] | number | THREE.Vector2 }
  > = {
    u_resolution: {
      type: 'v2',
      value: new THREE.Vector2(window.innerWidth, window.innerHeight)
    },
    u_mouse: { type: 'v2', value: new THREE.Vector2() },
    u_metaball_kind: { type: 'intv', value: [] },
    u_metaball_pos: { type: 'v2v', value: [] },
    u_metaball_radius: {
      type: 'fv',
      value: []
    },
    u_num_metaballs: {
      type: 'int',
      value: 2
    },
    u_threshold: {
      type: 'float',
      value: Number.POSITIVE_INFINITY
    }
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { uniforms, mesh };
};

const windowSizeUpdater = (state: AnimationState): ((e: UIEvent) => void) => {
  return (e: UIEvent) => {
    state.renderer.setSize(window.innerWidth, window.innerHeight);
  };
};

const mouseUpdater = (state: AnimationState): ((e: MouseEvent) => void) => {
  return (e: MouseEvent) => {
    state.mouse = [
      (2 * (e.pageX - window.innerWidth / 2)) / window.innerWidth,
      (2 * (window.innerHeight - e.pageY - window.innerHeight / 2)) /
        window.innerHeight
    ];
    if (state.aspectRatio > 1) {
      state.mouse[0] *= state.aspectRatio;
    } else {
      state.mouse[1] /= state.aspectRatio;
    }
  };
};

const init = async (): Promise<AnimationState> => {
  const scene = new THREE.Scene();

  const aspectRatio = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.z = 1;

  const { uniforms, mesh } = await initShader();
  scene.add(mesh);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio * 2);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const canvas = renderer.domElement;
  document.body.appendChild(canvas);

  const world = new OrbitWorld();
  world.init(10);

  const state: AnimationState = {
    scene,
    camera,
    renderer,
    canvas,
    aspectRatio,
    mouse: [0, 0],
    shader: { uniforms, mesh },
    time: { start: Date.now(), elapsed: 0, steps: 0 },
    world: world
  };
  document.onmousemove = mouseUpdater(state);
  window.addEventListener('resize', windowSizeUpdater(state), false);
  return state;
};

interface MetaballUniformValues {
  u_num_metaballs: number;
  u_metaball_kind: MetaballKind[];
  u_metaball_pos: number[];
  u_metaball_radius: number[];
  u_threshold: number;
}

const metaballsToUniforms = (metaballs: Metaball[]): MetaballUniformValues => {
  const kinds: MetaballKind[] = [];
  const flatPositions: number[] = [];
  const radii: number[] = [];
  for (const metaball of metaballs) {
    kinds.push(metaball.kind || MetaballKind.QUADRATIC);
    flatPositions.push(metaball.position[0], metaball.position[1]);
    radii.push(metaball.radius);
  }
  return {
    u_num_metaballs: metaballs.length,
    u_metaball_kind: kinds,
    u_metaball_pos: flatPositions,
    u_metaball_radius: radii,
    u_threshold: 0.3
  };
};

const updateRLState = (state: AnimationState): RLState => {
  const outcome: Outcome = {};
  outcome.situation = 0;
  if ('lastAction' in state.rl) {
    outcome.lastAction = state.rl.lastAction;
    outcome.reward = 0.0;
    if (state.rl.lastAction.action) {
      outcome.reward = Math.random() < 0.6 ? 1.0 : 0.0;
    } else {
      outcome.reward = Math.random() < 0.255 ? 1.0 : 0.0;
    }
  }
  const reaction = state.rl.agent.react(outcome);
  console.debug('Received reaction:', reaction);
  return { agent: state.rl.agent, lastAction: reaction.action };
};

const update = (state: AnimationState): AnimationState => {
  const prevElapsed: number = state.time.elapsed;
  state.time.elapsed = Date.now() - state.time.start;
  state.time.stepTime = state.time.elapsed - prevElapsed;

  state.shader.uniforms.u_resolution.value.x = state.renderer.domElement.width;
  state.shader.uniforms.u_resolution.value.y = state.renderer.domElement.height;

  state.aspectRatio = getAspectRatio();

  // const metaballs = metaballScene({
  //   elapsed_time: state.time.elapsed,
  //   mouse: state.mouse
  // });
  state.world.step(state.time.stepTime, state.time.elapsed);
  const metaballs = state.world.asMetaballs();

  const {
    u_num_metaballs,
    u_metaball_kind,
    u_metaball_pos,
    u_metaball_radius,
    u_threshold
  } = metaballsToUniforms(metaballs);
  state.shader.uniforms.u_num_metaballs.value = u_num_metaballs;
  state.shader.uniforms.u_metaball_kind.value = u_metaball_kind;
  state.shader.uniforms.u_metaball_pos.value = u_metaball_pos;
  state.shader.uniforms.u_metaball_radius.value = u_metaball_radius;
  state.shader.uniforms.u_threshold.value = u_threshold;

  state.time.steps++;
  return state;
};

const animate = (
  state: AnimationState,
  capturer?: any,
  capturerStarted?: boolean
) => {
  state = update(state);
  state.renderer.render(state.scene, state.camera);
  if (capturer !== undefined) {
    if (!capturerStarted) {
      capturer.start();
      capturerStarted = true;
    }
    capturer.capture(state.canvas);
  }
  requestAnimationFrame(() => {
    animate(state, capturer, capturerStarted);
  });
};

const start = async () => {
  const state = await init();
  animate(state);
};

interface CaptureArgs {
  // See https://github.com/spite/ccapture.js
  framerate: number;
  format: 'webm' | 'gif' | 'png' | 'jpg' | 'ffmpegserver';
  timeLimit?: number; // Seconds until stop and download
  motionBlurFrames?: number;
  verbose?: boolean;
  display?: boolean; // Adds a widget with capturing info
  autoSaveTime?: number; // Interval of seconds between saves
  startTime?: number; // Seconds to jump forawrd at start
  workersPath?: string;
}

const captureArgs: CaptureArgs = {
  framerate: 24,
  timeLimit: 48,
  format: 'gif',
  display: true,
  verbose: true,
  workersPath: 'http://localhost:1234/js/'
};

const startAndCapture = async () => {
  const state = await init();
  const processedCaptureArgs: CaptureArgs = { ...captureArgs };
  processedCaptureArgs.timeLimit -= 1 / captureArgs.framerate;
  const capturer = new CCapture(processedCaptureArgs);
  animate(state, capturer);
};

const capture = false;
// const capture = true;

// console.debug = () => {};

if (capture) {
  startAndCapture();
} else {
  start();
}

console.log('Animation begun.');
