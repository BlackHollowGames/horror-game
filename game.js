/* ============================================================
   THE SEEKER
   BlackHollow Games
   Created by Stive Pierre

   Complete browser horror-game controller.
   Requires:
   - index.html
   - style.css
   - Three.js import map in index.html
   ============================================================ */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ = (id) => document.getElementById(id);

const qs = (selector, root = document) =>
  root.querySelector(selector);

const qsa = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const show = (idOrElement) => {
  const element =
    typeof idOrElement === "string" ? $(idOrElement) : idOrElement;

  if (element) {
    element.classList.remove("hidden");
  }
};

const hide = (idOrElement) => {
  const element =
    typeof idOrElement === "string" ? $(idOrElement) : idOrElement;

  if (element) {
    element.classList.add("hidden");
  }
};

const toggle = (idOrElement, value) => {
  const element =
    typeof idOrElement === "string" ? $(idOrElement) : idOrElement;

  if (element) {
    element.classList.toggle("hidden", !value);
  }
};

const setText = (id, value) => {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
};

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const lerp = (a, b, t) =>
  a + (b - a) * t;

const distance2D = (a, b) => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;

  return Math.sqrt(dx * dx + dz * dz);
};

const randomRange = (min, max) =>
  min + Math.random() * (max - min);

const randomInt = (min, max) =>
  Math.floor(randomRange(min, max + 1));

const formatTime = (seconds) => {
  seconds = Math.max(0, Math.ceil(seconds));

  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");

  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
};


/* ============================================================
   GAME CONFIGURATION
   ============================================================ */

const CONFIG = {
  world: {
    width: 150,
    depth: 150,
    wallHeight: 8,
    floorY: 0,
    playerRadius: 0.8
  },

  player: {
    walkSpeed: 4.5,
    sprintSpeed: 7.5,
    acceleration: 18,
    friction: 12,
    eyeHeight: 1.65,
    maxPitch: 1.28,
    mouseSensitivity: 0.0022,
    touchSensitivity: 0.008
  },

  demon: {
    startDelay: 180,
    walkSpeed: 2.55,
    chaseSpeed: 3.75,
    sprintChaseSpeed: 4.7,
    hearingRadius: 72,
    visualRadius: 27,
    closeRadius: 13,
    catchDistance: 1.7
  },

  interaction: {
    buttonDistance: 4.5,
    keyDistance: 3.5,
    gateDistance: 7
  },

  audio: {
    volume: 0.65,
    footsteps: true,
    stepWalkInterval: 0.43,
    stepRunInterval: 0.28
  },

  objective: {
    buttonCount: 3,
    setupTime: 180
  },

  minimap: {
    size: 190
  }
};


/* ============================================================
   GAME STATE
   ============================================================ */

const state = {
  screen: "menu",

  device: "pc",

  running: false,
  paused: false,
  dead: false,
  won: false,

  elapsed: 0,
  setupTime: CONFIG.objective.setupTime,

  buttons: [
    false,
    false,
    false
  ],

  keyFound: false,
  gateOpen: false,

  sanity: 100,
  noise: 0,

  flashlight: true,
  footsteps: true,
  volume: CONFIG.audio.volume,

  sprinting: false,
  moving: false,

  hiding: false,
  hideTime: 0,

  notes: [],
  notesFound: 0,

  objective:
    "Find the three buttons.",

  interactionText: "",
  interactionUntil: 0,

  danger: false,

  lastTime: performance.now(),
  stepTimer: 0,

  interactionCooldown: 0,

  demonAlert: false,
  demonLastKnown: null,

  settingsLoaded: false
};


/* ============================================================
   THREE.JS VARIABLES
   ============================================================ */

let renderer = null;
let scene = null;
let camera = null;
let clock = null;

let player = null;
let playerVelocity = new THREE.Vector3();

let playerYaw = 0;
let playerPitch = 0;

let demon = null;
let demonVelocity = new THREE.Vector3();

let gate = null;
let gateBars = null;

let flashlight = null;
let flashlightTarget = null;

let ambientLight = null;

let walls = [];
let interactables = [];
let pickups = [];

let decorations = [];

let playerSpawn = new THREE.Vector3(
  0,
  CONFIG.player.eyeHeight,
  62
);

let demonSpawn = new THREE.Vector3(
  -48,
  0,
  48
);


/* ============================================================
   INPUT STATE
   ============================================================ */

const keys = Object.create(null);

let pointerLocked = false;

let mobileRunHeld = false;
let mobileLookActive = false;

let mobileLookX = 0;
let mobileLookY = 0;

const joystick = {
  active: false,
  pointerId: null,
  x: 0,
  y: 0
};


/* ============================================================
   AUDIO
   ============================================================ */

let audioContext = null;
let masterGain = null;

let ambientOscillator = null;
let ambientGain = null;

function initializeAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    return;
  }

  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  audioContext = new AudioContextClass();

  masterGain = audioContext.createGain();

  masterGain.gain.value = state.volume;

  masterGain.connect(
    audioContext.destination
  );
}

function updateMasterVolume() {
  if (!masterGain) {
    return;
  }

  masterGain.gain.value =
    clamp(state.volume, 0, 1);
}

function createTone(
  frequency = 220,
  duration = 0.1,
  type = "sine",
  volume = 0.05
) {
  if (!audioContext || !masterGain) {
    return;
  }

  const oscillator =
    audioContext.createOscillator();

  const gain =
    audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(
    0.0001,
    audioContext.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, volume),
    audioContext.currentTime + 0.01
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioContext.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(masterGain);

  oscillator.start();

  oscillator.stop(
    audioContext.currentTime +
    duration +
    0.025
  );
}

function createNoiseBurst(
  duration = 0.1,
  volume = 0.05
) {
  if (!audioContext || !masterGain) {
    return;
  }

  const bufferSize =
    Math.floor(
      audioContext.sampleRate * duration
    );

  const buffer =
    audioContext.createBuffer(
      1,
      bufferSize,
      audioContext.sampleRate
    );

  const data =
    buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] =
      (Math.random() * 2 - 1) *
      (1 - i / bufferSize);
  }

  const source =
    audioContext.createBufferSource();

  const gain =
    audioContext.createGain();

  source.buffer = buffer;

  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(masterGain);

  source.start();
}

function playFootstep() {
  if (!state.footsteps) {
    return;
  }

  if (!state.running) {
    return;
  }

  createTone(
    state.sprinting ? 55 : 72,
    0.065,
    "triangle",
    state.sprinting ? 0.065 : 0.045
  );

  window.setTimeout(() => {
    createTone(
      state.sprinting ? 42 : 55,
      0.045,
      "triangle",
      0.025
    );
  }, 25);
}

function playButtonSound(index) {
  createTone(
    180 + index * 95,
    0.12,
    "square",
    0.065
  );

  window.setTimeout(() => {
    createTone(
      300 + index * 100,
      0.15,
      "sine",
      0.045
    );
  }, 70);
}

function playKeySound() {
  createTone(
    520,
    0.12,
    "sine",
    0.07
  );

  window.setTimeout(() => {
    createTone(
      760,
      0.2,
      "sine",
      0.055
    );
  }, 90);
}

function playGateSound() {
  createTone(
    75,
    0.75,
    "sawtooth",
    0.07
  );

  createNoiseBurst(
    0.45,
    0.035
  );
}

function playDangerSound() {
  createTone(
    48,
    0.18,
    "sine",
    0.025
  );
}

function playDeathSound() {
  createTone(
    42,
    0.7,
    "sawtooth",
    0.08
  );

  createNoiseBurst(
    0.55,
    0.045
  );
}

function startAmbientAudio() {
  if (!audioContext || !masterGain) {
    return;
  }

  if (ambientOscillator) {
    return;
  }

  ambientOscillator =
    audioContext.createOscillator();

  ambientGain =
    audioContext.createGain();

  ambientOscillator.type = "sine";
  ambientOscillator.frequency.value = 39;

  ambientGain.gain.value = 0.009;

  ambientOscillator.connect(
    ambientGain
  );

  ambientGain.connect(
    masterGain
  );

  ambientOscillator.start();
}

function stopAmbientAudio() {
  if (!ambientOscillator) {
    return;
  }

  try {
    ambientOscillator.stop();
  } catch {}

  ambientOscillator = null;
  ambientGain = null;
}


/* ============================================================
   MATERIAL HELPERS
   ============================================================ */

function material(
  color,
  roughness = 0.8,
  metalness = 0.05
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

function basicMaterial(
  color
) {
  return new THREE.MeshBasicMaterial({
    color
  });
}


/* ============================================================
   THREE.JS INITIALIZATION
   ============================================================ */

function initializeThree() {
  if (renderer) {
    return;
  }

  scene = new THREE.Scene();

  scene.background =
    new THREE.Color(0x020304);

  scene.fog =
    new THREE.FogExp2(
      0x020304,
      0.010
    );

  clock =
    new THREE.Clock();

  renderer =
    new THREE.WebGLRenderer({
      antialias: true,
      powerPreference:
        "high-performance"
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      2
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.shadowMap.enabled = true;

  renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

  const oldCanvas =
    $("gameCanvas");

  if (oldCanvas) {
    oldCanvas.replaceWith(
      renderer.domElement
    );
  }

  renderer.domElement.id =
    "gameCanvas";

  camera =
    new THREE.PerspectiveCamera(
      72,
      window.innerWidth /
      window.innerHeight,
      0.05,
      350
    );

  player =
    new THREE.Object3D();

  player.position.copy(
    playerSpawn
  );

  scene.add(player);

  player.add(camera);

  camera.position.set(
    0,
    0,
    0
  );

  flashlight =
    new THREE.SpotLight(
      0xffffff,
      3.2,
      30,
      Math.PI / 7,
      0.42,
      1.2
    );

  flashlight.position.set(
    0,
    0,
    0
  );

  flashlightTarget =
    new THREE.Object3D();

  flashlightTarget.position.set(
    0,
    0,
    -10
  );

  player.add(
    flashlight
  );

  player.add(
    flashlightTarget
  );

  flashlight.target =
    flashlightTarget;

  buildLighting();
  buildWorld();
  buildDemon();
  buildMinimap();

  window.addEventListener(
    "resize",
    resizeRenderer
  );
}


/* ============================================================
   LIGHTING
   ============================================================ */

function buildLighting() {
  ambientLight =
    new THREE.HemisphereLight(
      0x50627b,
      0x030303,
      0.28
    );

  scene.add(
    ambientLight
  );

  const moon =
    new THREE.DirectionalLight(
      0x8ca0c0,
      0.2
    );

  moon.position.set(
    -40,
    55,
    -30
  );

  moon.castShadow = true;

  moon.shadow.mapSize.width = 1024;
  moon.shadow.mapSize.height = 1024;

  moon.shadow.camera.left = -90;
  moon.shadow.camera.right = 90;
  moon.shadow.camera.top = 90;
  moon.shadow.camera.bottom = -90;

  scene.add(moon);

  for (
    let x = -60;
    x <= 60;
    x += 30
  ) {
    for (
      let z = -60;
      z <= 60;
      z += 30
    ) {
      const light =
        new THREE.PointLight(
          0x26384d,
          0.19,
          24,
          2
        );

      light.position.set(
        x,
        5.8,
        z
      );

      scene.add(light);
    }
  }
}


/* ============================================================
   WORLD
   ============================================================ */

function buildWorld() {
  createFloor();
  createOuterWalls();
  createMazeWalls();
  createRooms();
  createDecorations();
  createGate();

  createButton(
    -57,
    1,
    -54,
    0
  );

  createButton(
    56,
    1,
    -39,
    1
  );

  createButton(
    48,
    1,
    49,
    2
  );

  createKey(
    0,
    1.4,
    57
  );
}

function createFloor() {
  const floor =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        CONFIG.world.width,
        CONFIG.world.depth
      ),
      material(
        0x090c10,
        1,
        0
      )
    );

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.y =
    CONFIG.world.floorY;

  floor.receiveShadow = true;

  scene.add(floor);
}

function addWall(
  x,
  y,
  z,
  width,
  height,
  depth,
  color = 0x11151a
) {
  const wall =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        depth
      ),
      material(
        color,
        0.88,
        0.02
      )
    );

  wall.position.set(
    x,
    y,
    z
  );

  wall.castShadow = true;
  wall.receiveShadow = true;

  scene.add(wall);

  walls.push(wall);

  return wall;
}

function createOuterWalls() {
  const halfW =
    CONFIG.world.width / 2;

  const halfD =
    CONFIG.world.depth / 2;

  const h =
    CONFIG.world.wallHeight;

  const t = 1.4;

  addWall(
    0,
    h / 2,
    -halfD,
    CONFIG.world.width,
    h,
    t
  );

  addWall(
    0,
    h / 2,
    halfD,
    CONFIG.world.width,
    h,
    t
  );

  addWall(
    -halfW,
    h / 2,
    0,
    t,
    h,
    CONFIG.world.depth
  );

  addWall(
    halfW,
    h / 2,
    0,
    t,
    h,
    CONFIG.world.depth
  );
}

function createMazeWalls() {
  const h =
    CONFIG.world.wallHeight;

  const layout = [
    [-38, -52, 1.4, h, 42],
    [38, -52, 1.4, h, 42],

    [-38, 52, 1.4, h, 42],
    [38, 52, 1.4, h, 42],

    [-52, -22, 42, h, 1.4],
    [-52, 22, 42, h, 1.4],

    [52, -22, 42, h, 1.4],
    [52, 22, 42, h, 1.4],

    [-10, -28, 1.4, h, 34],
    [12, 30, 1.4, h, 32],

    [-24, 8, 26, h, 1.4],
    [24, -8, 26, h, 1.4],

    [0, 0, 20, h, 1.4],

    [-5, 48, 32, h, 1.4],
    [5, -48, 32, h, 1.4],

    [-48, -2, 1.4, h, 24],
    [48, 2, 1.4, h, 24],

    [-22, -42, 26, h, 1.4],
    [22, 42, 26, h, 1.4]
  ];

  for (
    const entry of layout
  ) {
    addWall(
      entry[0],
      h / 2,
      entry[1],
      entry[2],
      entry[3],
      entry[4]
    );
  }
}

function createRooms() {
  const roomPositions = [
    [-62, -62],
    [62, -62],
    [-62, 62],
    [62, 62],
    [-62, 0],
    [62, 0],
    [0, -62],
    [0, 62]
  ];

  for (
    const [x, z]
    of roomPositions
  ) {
    const platform =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          8,
          0.2,
          8
        ),
        material(
          0x11161c,
          0.95
        )
      );

    platform.position.set(
      x,
      0.1,
      z
    );

    platform.receiveShadow =
      true;

    scene.add(platform);

    decorations.push(
      platform
    );
  }
}


/* ============================================================
   ENVIRONMENT DECORATION
   ============================================================ */

function createDecorations() {
  for (
    let i = 0;
    i < 85;
    i++
  ) {
    const x =
      randomRange(
        -68,
        68
      );

    const z =
      randomRange(
        -68,
        68
      );

    if (
      Math.abs(x) < 7 &&
      Math.abs(z - 62) < 8
    ) {
      continue;
    }

    const type =
      i % 4;

    if (type === 0) {
      createCrate(
        x,
        z
      );
    } else if (type === 1) {
      createPipe(
        x,
        z
      );
    } else if (type === 2) {
      createPillar(
        x,
        z
      );
    } else {
      createSmallLight(
        x,
        z
      );
    }
  }
}

function createCrate(
  x,
  z
) {
  const size =
    randomRange(
      0.7,
      1.8
    );

  const crate =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        size,
        size,
        size
      ),
      material(
        0x20252b,
        0.95
      )
    );

  crate.position.set(
    x,
    size / 2,
    z
  );

  crate.rotation.y =
    randomRange(
      -0.4,
      0.4
    );

  crate.castShadow = true;
  crate.receiveShadow = true;

  scene.add(crate);

  decorations.push(
    crate
  );
}

function createPipe(
  x,
  z
) {
  const height =
    randomRange(
      1.5,
      4
    );

  const pipe =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.12,
        0.12,
        height,
        10
      ),
      material(
        0x2a3037,
        0.7,
        0.15
      )
    );

  pipe.position.set(
    x,
    height / 2,
    z
  );

  pipe.castShadow = true;

  scene.add(pipe);

  decorations.push(
    pipe
  );
}

function createPillar(
  x,
  z
) {
  const pillar =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.35,
        0.42,
        randomRange(
          2.5,
          6
        ),
        12
      ),
      material(
        0x181d23,
        0.9
      )
    );

  pillar.position.set(
    x,
    pillar.geometry.parameters.height / 2,
    z
  );

  pillar.castShadow = true;

  scene.add(pillar);

  decorations.push(
    pillar
  );
}

function createSmallLight(
  x,
  z
) {
  const light =
    new THREE.PointLight(
      0x32465d,
      0.28,
      9
    );

  light.position.set(
    x,
    randomRange(
      2,
      5
    ),
    z
  );

  scene.add(light);

  decorations.push(
    light
  );
}


/* ============================================================
   BUTTONS
   ============================================================ */

function createButton(
  x,
  y,
  z,
  index
) {
  const group =
    new THREE.Group();

  const base =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        2.3,
        1.1,
        2.3
      ),
      material(
        0x292f35,
        0.85
      )
    );

  base.castShadow = true;

  const button =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.62,
        0.62,
        0.4,
        24
      ),
      material(
        0x8e2525,
        0.65
      )
    );

  button.rotation.x =
    Math.PI / 2;

  button.position.y =
    0.65;

  button.castShadow = true;

  group.add(
    base,
    button
  );

  group.position.set(
    x,
    y,
    z
  );

  scene.add(group);

  interactables.push({
    type: "button",
    index,
    object: group,
    button,
    range:
      CONFIG.interaction.buttonDistance
  });
}


/* ============================================================
   KEY
   ============================================================ */

function createKey(
  x,
  y,
  z
) {
  const group =
    new THREE.Group();

  const gold =
    material(
      0xc9a227,
      0.38,
      0.5
    );

  const ring =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        0.55,
        0.15,
        12,
        28
      ),
      gold
    );

  const shaft =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.2,
        0.2,
        1.7
      ),
      gold
    );

  shaft.position.z =
    0.82;

  const tooth =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.4,
        0.2,
        0.38
      ),
      gold
    );

  tooth.position.set(
    0.18,
    0,
    1.45
  );

  group.add(
    ring,
    shaft,
    tooth
  );

  group.position.set(
    x,
    y,
    z
  );

  group.visible = false;

  scene.add(group);

  pickups.push({
    type: "key",
    object: group,
    range:
      CONFIG.interaction.keyDistance
  });
}


/* ============================================================
   GATE
   ============================================================ */

function createGate() {
  gate =
    new THREE.Group();

  const gateMaterial =
    material(
      0x262c33,
      0.78,
      0.25
    );

  const left =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.5,
        7,
        2
      ),
      gateMaterial
    );

  left.position.x =
    -5;

  const right =
    left.clone();

  right.position.x =
    5;

  const top =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        11,
        1.5,
        2
      ),
      gateMaterial
    );

  top.position.y =
    3.8;

  gateBars =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        9.5,
        6.2,
        1.1
      ),
      material(
        0x3b424a,
        0.72,
        0.35
      )
    );

  gateBars.position.y =
    0.4;

  gate.add(
    left,
    right,
    top,
    gateBars
  );

  gate.position.set(
    0,
    3.5,
    -68
  );

  scene.add(gate);

  interactables.push({
    type: "gate",
    object: gate,
    range:
      CONFIG.interaction.gateDistance
  });
}

function openGate() {
  if (state.gateOpen) {
    return;
  }

  state.gateOpen = true;

  if (gateBars) {
    gateBars.visible = false;
  }

  playGateSound();

  setObjective(
    "Escape. Get through the gate."
  );

  setMessage(
    "GATE UNLOCKED",
    1800
  );
}


/* ============================================================
   THE SEEKER
   ============================================================ */

function buildDemon() {
  demon =
    new THREE.Group();

  const bodyMaterial =
    material(
      0x111419,
      0.86,
      0.02
    );

  const body =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.9,
        2.5,
        8,
        16
      ),
      bodyMaterial
    );

  body.position.y =
    2;

  body.castShadow = true;

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        1.05,
        20,
        20
      ),
      material(
        0x1c2025,
        0.82
      )
    );

  head.position.y =
    4.2;

  head.castShadow = true;

  const eyeMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xb33030
    });

  const leftEye =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.12,
        12,
        12
      ),
      eyeMaterial
    );

  leftEye.position.set(
    -0.35,
    4.32,
    0.93
  );

  const rightEye =
    leftEye.clone();

  rightEye.position.x =
    0.35;

  demon.add(
    body,
    head,
    leftEye,
    rightEye
  );

  demon.position.copy(
    demonSpawn
  );

  scene.add(demon);
}

function updateDemon(dt) {
  if (!demon || !player) {
    return;
  }

  if (
    state.elapsed <
    CONFIG.demon.startDelay
  ) {
    return;
  }

  if (state.paused ||
      state.dead ||
      state.won) {
    return;
  }

  const distance =
    distance2D(
      demon.position,
      player.position
    );

  let speed =
    CONFIG.demon.walkSpeed;

  const playerIsLoud =
    state.noise > 48;

  const playerIsVisible =
    distance <
    CONFIG.demon.visualRadius;

  const canHear =
    distance <
    CONFIG.demon.hearingRadius &&
    playerIsLoud;

  if (
    playerIsVisible ||
    canHear ||
    state.demonAlert
  ) {
    state.demonAlert = true;

    state.demonLastKnown =
      player.position.clone();

    speed =
      CONFIG.demon.chaseSpeed;

    if (state.sprinting) {
      speed =
        CONFIG.demon.sprintChaseSpeed;
    }

    if (
      distance <
      CONFIG.demon.closeRadius
    ) {
      speed += 0.9;
    }
  }

  if (state.hiding) {
    speed *= 0.08;
  }

  const target =
    state.demonLastKnown ||
    player.position;

  const dx =
    target.x -
    demon.position.x;

  const dz =
    target.z -
    demon.position.z;

  const length =
    Math.hypot(dx, dz) ||
    1;

  demonVelocity.set(
    dx / length,
    0,
    dz / length
  );

  demon.position.x +=
    demonVelocity.x *
    speed *
    dt;

  demon.position.z +=
    demonVelocity.z *
    speed *
    dt;

  demon.lookAt(
    player.position.x,
    2,
    player.position.z
  );

  resolveDemonWalls();

  if (
    distance <
    CONFIG.demon.catchDistance &&
    !state.hiding
  ) {
    die(
      "The Seeker caught you."
    );
  }
}

function resolveDemonWalls() {
  if (!demon) {
    return;
  }

  const radius = 0.8;

  for (
    const wall of walls
  ) {
    const box =
      new THREE.Box3()
        .setFromObject(wall);

    const closestX =
      clamp(
        demon.position.x,
        box.min.x,
        box.max.x
      );

    const closestZ =
      clamp(
        demon.position.z,
        box.min.z,
        box.max.z
      );

    const dx =
      demon.position.x -
      closestX;

    const dz =
      demon.position.z -
      closestZ;

    const distance =
      Math.hypot(dx, dz);

    if (
      distance < radius &&
      distance > 0.001
    ) {
      demon.position.x +=
        dx / distance *
        (radius - distance);

      demon.position.z +=
        dz / distance *
        (radius - distance);
    }
  }
}


/* ============================================================
   PLAYER MOVEMENT
   ============================================================ */

function updatePlayer(dt) {
  if (!player) {
    return;
  }

  if (
    state.paused ||
    state.dead ||
    state.won
  ) {
    return;
  }

  let inputX = 0;
  let inputZ = 0;

  if (
    keys.KeyW ||
    keys.ArrowUp
  ) {
    inputZ -= 1;
  }

  if (
    keys.KeyS ||
    keys.ArrowDown
  ) {
    inputZ += 1;
  }

  if (
    keys.KeyA ||
    keys.ArrowLeft
  ) {
    inputX -= 1;
  }

  if (
    keys.KeyD ||
    keys.ArrowRight
  ) {
    inputX += 1;
  }

  if (
    state.device === "mobile"
  ) {
    inputX += joystick.x;
    inputZ += joystick.y;
  }

  const inputLength =
    Math.hypot(
      inputX,
      inputZ
    );

  state.moving =
    inputLength > 0.08;

  state.sprinting =
    state.moving &&
    (
      keys.ShiftLeft ||
      keys.ShiftRight ||
      mobileRunHeld
    );

  if (state.moving) {
    inputX /=
      inputLength;

    inputZ /=
      inputLength;

    const forward =
      new THREE.Vector3(
        -Math.sin(playerYaw),
        0,
        -Math.cos(playerYaw)
      );

    const right =
      new THREE.Vector3(
        Math.cos(playerYaw),
        0,
        -Math.sin(playerYaw)
      );

    const movement =
      forward
        .multiplyScalar(inputZ)
        .add(
          right.multiplyScalar(
            inputX
          )
        );

    const speed =
      state.sprinting
        ? CONFIG.player.sprintSpeed
        : CONFIG.player.walkSpeed;

    const desired =
      movement.multiplyScalar(
        speed
      );

    playerVelocity.x =
      lerp(
        playerVelocity.x,
        desired.x,
        clamp(
          CONFIG.player.acceleration *
          dt,
          0,
          1
        )
      );

    playerVelocity.z =
      lerp(
        playerVelocity.z,
        desired.z,
        clamp(
          CONFIG.player.acceleration *
          dt,
          0,
          1
        )
      );

    const noiseRate =
      state.sprinting
        ? 46
        : 23;

    state.noise =
      clamp(
        state.noise +
        noiseRate * dt,
        0,
        100
      );

    state.stepTimer -= dt;

    if (
      state.stepTimer <= 0
    ) {
      playFootstep();

      state.stepTimer =
        state.sprinting
          ? CONFIG.audio.stepRunInterval
          : CONFIG.audio.stepWalkInterval;
    }
  } else {
    playerVelocity.x =
      lerp(
        playerVelocity.x,
        0,
        clamp(
          CONFIG.player.friction *
          dt,
          0,
          1
        )
      );

    playerVelocity.z =
      lerp(
        playerVelocity.z,
        0,
        clamp(
          CONFIG.player.friction *
          dt,
          0,
          1
        )
      );

    state.noise =
      Math.max(
        0,
        state.noise -
        35 * dt
      );
  }

  player.position.x +=
    playerVelocity.x *
    dt;

  player.position.z +=
    playerVelocity.z *
    dt;

  const limitX =
    CONFIG.world.width / 2 -
    2;

  const limitZ =
    CONFIG.world.depth / 2 -
    2;

  player.position.x =
    clamp(
      player.position.x,
      -limitX,
      limitX
    );

  player.position.z =
    clamp(
      player.position.z,
      -limitZ,
      limitZ
    );

  resolvePlayerWalls();

  updatePlayerCameraBob(dt);
}

function resolvePlayerWalls() {
  if (!player) {
    return;
  }

  const radius =
    CONFIG.world.playerRadius;

  for (
    const wall of walls
  ) {
    const box =
      new THREE.Box3()
        .setFromObject(wall);

    const closestX =
      clamp(
        player.position.x,
        box.min.x,
        box.max.x
      );

    const closestZ =
      clamp(
        player.position.z,
        box.min.z,
        box.max.z
      );

    const dx =
      player.position.x -
      closestX;

    const dz =
      player.position.z -
      closestZ;

    const distance =
      Math.hypot(dx, dz);

    if (
      distance < radius &&
      distance > 0.001
    ) {
      player.position.x +=
        dx / distance *
        (radius - distance);

      player.position.z +=
        dz / distance *
        (radius - distance);
    }
  }
}

let cameraBobTime = 0;

function updatePlayerCameraBob(dt) {
  if (!camera) {
    return;
  }

  if (state.moving) {
    cameraBobTime +=
      dt *
      (
        state.sprinting
          ? 11
          : 7
      );

    camera.position.y =
      Math.sin(
        cameraBobTime
      ) *
      (
        state.sprinting
          ? 0.045
          : 0.025
      );

    camera.position.x =
      Math.cos(
        cameraBobTime * 0.5
      ) *
      0.012;
  } else {
    cameraBobTime += dt * 1.5;

    camera.position.y =
      Math.sin(
        cameraBobTime
      ) *
      0.004;

    camera.position.x =
      0;
  }
}


/* ============================================================
   INTERACTION
   ============================================================ */

function tryInteract() {
  if (
    !state.running ||
    state.paused ||
    state.dead ||
    state.won
  ) {
    return;
  }

  if (
    state.interactionCooldown > 0
  ) {
    return;
  }

  state.interactionCooldown =
    0.22;

  let nearest = null;
  let nearestDistance =
    Infinity;

  for (
    const object
    of interactables
  ) {
    const distance =
      distance2D(
        player.position,
        object.object.position
      );

    if (
      distance <
        object.range &&
      distance <
        nearestDistance
    ) {
      nearest =
        object;

      nearestDistance =
        distance;
    }
  }

  if (
    nearest &&
    nearest.type ===
      "button"
  ) {
    activateButton(
      nearest
    );

    return;
  }

  if (
    nearest &&
    nearest.type ===
      "gate"
  ) {
    interactGate();

    return;
  }

  tryPickupKey();
}

function activateButton(
  buttonObject
) {
  const index =
    buttonObject.index;

  if (
    state.buttons[index]
  ) {
    setMessage(
      `BUTTON ${index + 1} ALREADY ACTIVE`,
      1000
    );

    return;
  }

  state.buttons[index] =
    true;

  buttonObject.button
    .material.color
    .set(0x2a8a4a);

  buttonObject.button.scale.y =
    0.78;

  playButtonSound(
    index
  );

  setMessage(
    `BUTTON ${index + 1} ACTIVATED`,
    1400
  );

  updateButtonUI();
}

function tryPickupKey() {
  for (
    const pickup
    of pickups
  ) {
    if (
      pickup.type !== "key"
    ) {
      continue;
    }

    if (
      !pickup.object.visible
    ) {
      continue;
    }

    const distance =
      distance2D(
        player.position,
        pickup.object.position
      );

    if (
      distance <
      pickup.range
    ) {
      state.keyFound =
        true;

      pickup.object.visible =
        false;

      playKeySound();

      setMessage(
        "KEY FOUND",
        1500
      );

      updateObjective();

      return;
    }
  }
}

function interactGate() {
  if (
    !state.buttons.every(
      Boolean
    )
  ) {
    setMessage(
      "THE GATE NEEDS ALL THREE BUTTONS.",
      1800
    );

    return;
  }

  if (
    !state.keyFound
  ) {
    setMessage(
      "THE GATE IS LOCKED.",
      1500
    );

    return;
  }

  openGate();
}


/* ============================================================
   OBJECTIVES
   ============================================================ */

function updateObjective() {
  if (
    state.gateOpen
  ) {
    setObjective(
      "Escape. Get through the gate."
    );

    return;
  }

  if (
    state.keyFound
  ) {
    setObjective(
      "Take the key to the gate."
    );

    return;
  }

  if (
    state.buttons.every(
      Boolean
    )
  ) {
    if (
      state.elapsed <
      CONFIG.demon.startDelay
    ) {
      setObjective(
        "The key will appear when the timer ends."
      );
    } else {
      setObjective(
        "The key has been revealed. Find it."
      );
    }

    return;
  }

  setObjective(
    "Find the three buttons."
  );
}

function updateButtonUI() {
  for (
    let i = 0;
    i < 3;
    i++
  ) {
    const button =
      $(
        `button${i + 1}`
      );

    if (!button) {
      continue;
    }

    button.classList.toggle(
      "active",
      state.buttons[i]
    );
  }

  updateObjective();
}


/* ============================================================
   KEY AVAILABILITY
   ============================================================ */

function updateKeyVisibility() {
  if (
    state.keyFound
  ) {
    return;
  }

  if (
    state.elapsed <
    CONFIG.demon.startDelay
  ) {
    return;
  }

  if (
    !state.buttons.every(
      Boolean
    )
  ) {
    return;
  }

  for (
    const pickup
    of pickups
  ) {
    if (
      pickup.type === "key"
    ) {
      pickup.object.visible =
        true;
    }
  }

  updateObjective();
}


/* ============================================================
   HUD
   ============================================================ */

function updateHUD(dt) {
  if (
    !state.running ||
    state.paused
  ) {
    return;
  }

  state.elapsed += dt;

  const remaining =
    Math.max(
      0,
      CONFIG.demon.startDelay -
      state.elapsed
    );

  setText(
    "timer",
    formatTime(
      remaining
    )
  );

  state.interactionCooldown =
    Math.max(
      0,
      state.interactionCooldown -
      dt
    );

  updateKeyVisibility();

  const demonDistance =
    demon && player
      ? distance2D(
          demon.position,
          player.position
        )
      : Infinity;

  updateSanity(
    dt,
    demonDistance
  );

  updateNoise(
    dt
  );

  updateDanger(
    demonDistance
  );

  if (
    state.interactionUntil <
    performance.now()
  ) {
    hide("interaction");
  }

  if (
    state.elapsed <
    CONFIG.demon.startDelay
  ) {
    if (
      state.buttons.every(
        Boolean
      )
    ) {
      setObjective(
        "Wait for the key to appear."
      );
    } else {
      setObjective(
        "Find the three buttons."
      );
    }
  }

  if (
    state.keyFound &&
    !state.gateOpen
  ) {
    setObjective(
      "Take the key to the gate."
    );
  }

  checkEscape();
}

function updateSanity(
  dt,
  demonDistance
) {
  if (
    demonDistance <
    CONFIG.demon.closeRadius
  ) {
    const pressure =
      (
        CONFIG.demon.closeRadius -
        demonDistance
      ) * 1.3;

    state.sanity -=
      pressure * dt;
  } else if (
    demonDistance >
    CONFIG.demon.visualRadius
  ) {
    state.sanity +=
      3.5 * dt;
  }

  state.sanity =
    clamp(
      state.sanity,
      0,
      100
    );

  const fill =
    $("sanityFill");

  if (fill) {
    fill.style.width =
      `${state.sanity}%`;
  }

  if (
    state.sanity <= 0 &&
    demonDistance <
      CONFIG.demon.visualRadius
  ) {
    die(
      "Your fear became overwhelming."
    );
  }
}

function updateNoise(dt) {
  if (
    !state.moving
  ) {
    state.noise -=
      35 * dt;
  }

  state.noise =
    clamp(
      state.noise,
      0,
      100
    );

  const fill =
    $("noiseFill");

  if (fill) {
    fill.style.width =
      `${state.noise}%`;
  }
}

let lastDangerSound = 0;

function updateDanger(
  demonDistance
) {
  const dangerous =
    demonDistance <
    CONFIG.demon.closeRadius;

  if (
    dangerous !==
    state.danger
  ) {
    state.danger =
      dangerous;

    if (dangerous) {
      show(
        "dangerWarning"
      );
    } else {
      hide(
        "dangerWarning"
      );
    }
  }

  if (
    dangerous &&
    performance.now() -
      lastDangerSound >
      1500
  ) {
    lastDangerSound =
      performance.now();

    playDangerSound();
  }
}

function updateNotesHUD() {
  setText(
    "notesCount",
    String(
      state.notesFound
    )
  );
}


/* ============================================================
   MESSAGE SYSTEM
   ============================================================ */

function setMessage(
  text,
  duration = 1800
) {
  state.interactionText =
    text;

  state.interactionUntil =
    performance.now() +
    duration;

  setText(
    "interactionText",
    text
  );

  show(
    "interaction"
  );
}


/* ============================================================
   ESCAPE CHECK
   ============================================================ */

function checkEscape() {
  if (
    !state.gateOpen ||
    state.won ||
    state.dead
  ) {
    return;
  }

  if (
    player.position.z <
    -69
  ) {
    winGame();
  }
}


/* ============================================================
   WIN / DEATH
   ============================================================ */

function winGame() {
  if (
    state.won
  ) {
    return;
  }

  state.won =
    true;

  state.running =
    false;

  state.paused =
    false;

  setText(
    "winTitle",
    "YOU ESCAPED"
  );

  setText(
    "winText",
    "You found the buttons, recovered the key, and escaped The Seeker."
  );

  show(
    "winScreen"
  );

  stopAmbientAudio();
}

function die(
  reason
) {
  if (
    state.dead ||
    state.won
  ) {
    return;
  }

  state.dead =
    true;

  state.running =
    false;

  state.paused =
    false;

  setText(
    "deathReason",
    reason
  );

  show(
    "deathScreen"
  );

  playDeathSound();

  stopAmbientAudio();
}


/* ============================================================
   PAUSE
   ============================================================ */

function pauseGame() {
  if (
    !state.running ||
    state.dead ||
    state.won
  ) {
    return;
  }

  state.paused =
    true;

  show(
    "pauseScreen"
  );
}

function resumeGame() {
  state.paused =
    false;

  hide(
    "pauseScreen"
  );

  state.lastTime =
    performance.now();
}


/* ============================================================
   MINIMAP
   ============================================================ */

let minimap = null;
let mapPlayer = null;
let mapDemon = null;
let mapGate = null;

function buildMinimap() {
  minimap =
    document.createElement(
      "div"
    );

  minimap.id =
    "minimap";

  minimap.className =
    "minimap";

  minimap.innerHTML = `
    <div class="minimap-title">
      MAP
    </div>

    <div class="minimap-frame">
      <div class="minimap-grid"></div>

      <div class="map-player">
        <span></span>
      </div>

      <div class="map-demon">
        <span></span>
      </div>

      <div class="map-gate"></div>
    </div>
  `;

  const gameScreen =
    $("gameScreen");

  if (
    gameScreen
  ) {
    gameScreen.appendChild(
      minimap
    );
  }

  mapPlayer =
    qs(
      ".map-player",
      minimap
    );

  mapDemon =
    qs(
      ".map-demon",
      minimap
    );

  mapGate =
    qs(
      ".map-gate",
      minimap
    );
}

function worldToMapX(x) {
  const normalized =
    (
      x +
      CONFIG.world.width / 2
    ) /
    CONFIG.world.width;

  return clamp(
    normalized * 100,
    3,
    97
  );
}

function worldToMapY(z) {
  const normalized =
    (
      z +
      CONFIG.world.depth / 2
    ) /
    CONFIG.world.depth;

  return clamp(
    normalized * 100,
    3,
    97
  );
}

function updateMinimap() {
  if (
    !minimap ||
    !player ||
    !demon
  ) {
    return;
  }

  if (
    mapPlayer
  ) {
    mapPlayer.style.left =
      `${worldToMapX(
        player.position.x
      )}%`;

    mapPlayer.style.top =
      `${worldToMapY(
        player.position.z
      )}%`;

    mapPlayer.style.transform =
      `translate(-50%, -50%) rotate(${-playerYaw}rad)`;
  }

  if (
    mapDemon
  ) {
    mapDemon.style.left =
      `${worldToMapX(
        demon.position.x
      )}%`;

    mapDemon.style.top =
      `${worldToMapY(
        demon.position.z
      )}%`;
  }

  if (
    mapGate
  ) {
    mapGate.style.left =
      `${worldToMapX(0)}%`;

    mapGate.style.top =
      `${worldToMapY(-68)}%`;

    mapGate.classList.toggle(
      "open",
      state.gateOpen
    );
  }
}


/* ============================================================
   DEVICE SELECTOR
   ============================================================ */

let deviceScreen = null;

function openDeviceSelector() {
  if (
    deviceScreen
  ) {
    return;
  }

  deviceScreen =
    document.createElement(
      "div"
    );

  deviceScreen.className =
    "device-screen";

  deviceScreen.innerHTML = `
    <div class="device-panel">

      <div class="device-kicker">
        THE SEEKER
      </div>

      <h2>
        CHOOSE YOUR DEVICE
      </h2>

      <p>
        Select your control method before entering the game.
      </p>

      <div class="device-options">

        <button
          class="device-choice"
          data-device="pc"
        >
          <strong>PC</strong>
          <span>
            Keyboard + mouse
          </span>
        </button>

        <button
          class="device-choice"
          data-device="mobile"
        >
          <strong>MOBILE</strong>
          <span>
            Touch controls
          </span>
        </button>

      </div>

      <button
        class="device-back"
      >
        BACK
      </button>

    </div>
  `;

  document.body.appendChild(
    deviceScreen
  );

  qsa(
    "[data-device]",
    deviceScreen
  ).forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          state.device =
            button.dataset.device;

          document.body.classList.toggle(
            "device-pc",
            state.device === "pc"
          );

          document.body.classList.toggle(
            "device-mobile",
            state.device === "mobile"
          );

          deviceScreen.remove();

          deviceScreen =
            null;

          startGame();
        }
      );
    }
  );

  const back =
    qs(
      ".device-back",
      deviceScreen
    );

  back?.addEventListener(
    "click",
    () => {
      deviceScreen.remove();

      deviceScreen =
        null;
    }
  );
}


/* ============================================================
   GAME START / RESET
   ============================================================ */

function resetGameState() {
  state.running =
    true;

  state.paused =
    false;

  state.dead =
    false;

  state.won =
    false;

  state.elapsed =
    0;

  state.setupTime =
    CONFIG.objective.setupTime;

  state.buttons = [
    false,
    false,
    false
  ];

  state.keyFound =
    false;

  state.gateOpen =
    false;

  state.sanity =
    100;

  state.noise =
    0;

  state.sprinting =
    false;

  state.moving =
    false;

  state.hiding =
    false;

  state.hideTime =
    0;

  state.demonAlert =
    false;

  state.demonLastKnown =
    null;

  state.danger =
    false;

  state.interactionCooldown =
    0;

  state.lastTime =
    performance.now();

  playerVelocity.set(
    0,
    0,
    0
  );

  if (player) {
    player.position.copy(
      playerSpawn
    );
  }

  playerYaw =
    0;

  playerPitch =
    0;

  if (camera) {
    camera.rotation.set(
      0,
      0,
      0
    );
  }

  if (player) {
    player.rotation.set(
      0,
      0,
      0
    );
  }

  if (demon) {
    demon.position.copy(
      demonSpawn
    );

    demonVelocity.set(
      0,
      0,
      0
    );
  }

  for (
    const item
    of pickups
  ) {
    if (
      item.type === "key"
    ) {
      item.object.visible =
        false;
    }
  }

  for (
    const item
    of interactables
  ) {
    if (
      item.type === "button"
    ) {
      item.button.material.color
        .set(0x8e2525);

      item.button.scale.y =
        1;
    }
  }

  if (
    gateBars
  ) {
    gateBars.visible =
      true;
  }

  state.notes = [];
  state.notesFound = 0;

  updateButtonUI();
  updateNotesHUD();

  setText(
    "timer",
    "03:00"
  );

  const sanity =
    $("sanityFill");

  if (sanity) {
    sanity.style.width =
      "100%";
  }

  const noise =
    $("noiseFill");

  if (noise) {
    noise.style.width =
      "0%";
  }

  hide(
    "dangerWarning"
  );

  hide(
    "pauseScreen"
  );

  hide(
    "deathScreen"
  );

  hide(
    "winScreen"
  );
}

function startGame() {
  initializeAudio();

  if (
    audioContext &&
    audioContext.state ===
      "suspended"
  ) {
    audioContext.resume();
  }

  initializeThree();

  resetGameState();

  hide(
    "menuScreen"
  );

  hide(
    "instructionsScreen"
  );

  hide(
    "settingsScreen"
  );

  show(
    "gameScreen"
  );

  if (
    state.device ===
    "mobile"
  ) {
    show(
      "mobileControls"
    );
  } else {
    hide(
      "mobileControls"
    );
  }

  setObjective(
    "Find the three buttons."
  );

  startAmbientAudio();

  requestAnimationFrame(
    gameLoop
  );
}


/* ============================================================
   MOUSE LOOK
   ============================================================ */

function handleMouseMove(
  event
) {
  if (
    state.device !== "pc"
  ) {
    return;
  }

  if (
    !state.running ||
    state.paused ||
    state.dead ||
    state.won
  ) {
    return;
  }

  if (
    !pointerLocked
  ) {
    return;
  }

  playerYaw -=
    event.movementX *
    CONFIG.player.mouseSensitivity;

  playerPitch -=
    event.movementY *
    CONFIG.player.mouseSensitivity;

  playerPitch =
    clamp(
      playerPitch,
      -CONFIG.player.maxPitch,
      CONFIG.player.maxPitch
    );

  player.rotation.y =
    playerYaw;

  camera.rotation.order =
    "YXZ";

  camera.rotation.x =
    playerPitch;

  camera.rotation.y =
    0;
}


/* ============================================================
   MOBILE CONTROLS
   ============================================================ */

function initializeMobileControls() {
  const zone =
    $("joystickZone");

  const knob =
    $("joystickKnob");

  if (zone) {
    zone.addEventListener(
      "pointerdown",
      (event) => {
        if (
          state.device !==
          "mobile"
        ) {
          return;
        }

        joystick.active =
          true;

        joystick.pointerId =
          event.pointerId;

        zone.setPointerCapture(
          event.pointerId
        );

        updateJoystick(
          event,
          zone,
          knob
        );
      }
    );

    zone.addEventListener(
      "pointermove",
      (event) => {
        if (
          !joystick.active
        ) {
          return;
        }

        updateJoystick(
          event,
          zone,
          knob
        );
      }
    );

    zone.addEventListener(
      "pointerup",
      resetJoystick
    );

    zone.addEventListener(
      "pointercancel",
      resetJoystick
    );
  }

  const run =
    $("mobileRun");

  if (run) {
    run.addEventListener(
      "pointerdown",
      () => {
        mobileRunHeld =
          true;
      }
    );

    run.addEventListener(
      "pointerup",
      () => {
        mobileRunHeld =
          false;
      }
    );

    run.addEventListener(
      "pointercancel",
      () => {
        mobileRunHeld =
          false;
      }
    );

    run.addEventListener(
      "pointerleave",
      () => {
        mobileRunHeld =
          false;
      }
    );
  }

  const interact =
    $("mobileInteract");

  interact?.addEventListener(
    "pointerdown",
    () => {
      tryInteract();
    }
  );

  const flashlightButton =
    $("mobileFlashlight");

  flashlightButton?.addEventListener(
    "pointerdown",
    () => {
      toggleFlashlight();
    }
  );

  const lookZone =
    $("lookZone");

  if (lookZone) {
    lookZone.addEventListener(
      "pointerdown",
      (event) => {
        if (
          state.device !==
          "mobile"
        ) {
          return;
        }

        mobileLookActive =
          true;

        mobileLookX =
          event.clientX;

        mobileLookY =
          event.clientY;

        lookZone.setPointerCapture(
          event.pointerId
        );
      }
    );

    lookZone.addEventListener(
      "pointermove",
      (event) => {
        if (
          !mobileLookActive
        ) {
          return;
        }

        const dx =
          event.clientX -
          mobileLookX;

        const dy =
          event.clientY -
          mobileLookY;

        mobileLookX =
          event.clientX;

        mobileLookY =
          event.clientY;

        playerYaw -=
          dx *
          CONFIG.player.touchSensitivity;

        playerPitch -=
          dy *
          CONFIG.player.touchSensitivity;

        playerPitch =
          clamp(
            playerPitch,
            -CONFIG.player.maxPitch,
            CONFIG.player.maxPitch
          );

        player.rotation.y =
          playerYaw;

        camera.rotation.order =
          "YXZ";

        camera.rotation.x =
          playerPitch;
      }
    );

    lookZone.addEventListener(
      "pointerup",
      () => {
        mobileLookActive =
          false;
      }
    );

    lookZone.addEventListener(
      "pointercancel",
      () => {
        mobileLookActive =
          false;
      }
    );
  }
}

function updateJoystick(
  event,
  zone,
  knob
) {
  const rect =
    zone.getBoundingClientRect();

  const centerX =
    rect.left +
    rect.width / 2;

  const centerY =
    rect.top +
    rect.height / 2;

  let dx =
    event.clientX -
    centerX;

  let dy =
    event.clientY -
    centerY;

  const max =
    Math.min(
      rect.width,
      rect.height
    ) *
    0.32;

  const distance =
    Math.hypot(
      dx,
      dy
    );

  if (
    distance >
    max
  ) {
    dx =
      dx /
      distance *
      max;

    dy =
      dy /
      distance *
      max;
  }

  joystick.x =
    dx / max;

  joystick.y =
    dy / max;

  if (knob) {
    knob.style.transform =
      `translate(${dx}px, ${dy}px)`;
  }
}

function resetJoystick() {
  joystick.active =
    false;

  joystick.pointerId =
    null;

  joystick.x =
    0;

  joystick.y =
    0;

  const knob =
    $("joystickKnob");

  if (knob) {
    knob.style.transform =
      "translate(0, 0)";
  }
}


/* ============================================================
   FLASHLIGHT
   ============================================================ */

function toggleFlashlight() {
  state.flashlight =
    !state.flashlight;

  if (flashlight) {
    flashlight.visible =
      state.flashlight;
  }

  createTone(
    state.flashlight
      ? 460
      : 180,
    0.07,
    "square",
    0.025
  );
}


/* ============================================================
   SETTINGS
   ============================================================ */

function saveSettings() {
  try {
    localStorage.setItem(
      "the_seeker_settings",
      JSON.stringify({
        volume:
          state.volume,

        flashlight:
          state.flashlight,

        footsteps:
          state.footsteps
      })
    );
  } catch {}
}

function loadSettings() {
  try {
    const raw =
      localStorage.getItem(
        "the_seeker_settings"
      );

    if (!raw) {
      return;
    }

    const saved =
      JSON.parse(raw);

    if (
      typeof saved.volume ===
      "number"
    ) {
      state.volume =
        clamp(
          saved.volume,
          0,
          1
        );
    }

    if (
      typeof saved.flashlight ===
      "boolean"
    ) {
      state.flashlight =
        saved.flashlight;
    }

    if (
      typeof saved.footsteps ===
      "boolean"
    ) {
      state.footsteps =
        saved.footsteps;
    }

    state.settingsLoaded =
      true;
  } catch {}
}

function syncSettingsUI() {
  const volume =
    $("volumeSetting");

  if (volume) {
    volume.value =
      String(
        Math.round(
          state.volume * 100
        )
      );
  }

  const flashlightSetting =
    $("flashlightSetting");

  if (flashlightSetting) {
    flashlightSetting.checked =
      state.flashlight;
  }

  const footstepSetting =
    $("footstepSetting");

  if (footstepSetting) {
    footstepSetting.checked =
      state.footsteps;
  }
}


/* ============================================================
   NOTES SYSTEM
   ============================================================ */

function addNote(
  text
) {
  state.notes.push({
    id:
      `note_${Date.now()}_${Math.random()}`,
    text
  });

  state.notesFound =
    state.notes.length;

  updateNotesHUD();
}

function openNotesLog() {
  const list =
    $("notesLogList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (
    state.notes.length ===
    0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "notes-log-empty";

    empty.textContent =
      "No notes found.";

    list.appendChild(
      empty
    );
  } else {
    for (
      const note
      of state.notes
    ) {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "note-entry";

      item.textContent =
        note.text;

      list.appendChild(
        item
      );
    }
  }

  show(
    "notesLogScreen"
  );
}


/* ============================================================
   KEYBOARD EVENTS
   ============================================================ */

function initializeKeyboard() {
  window.addEventListener(
    "keydown",
    (event) => {
      keys[event.code] =
        true;

      if (
        event.code ===
        "Escape"
      ) {
        if (
          state.running &&
          !state.paused
        ) {
          pauseGame();
        } else if (
          state.paused
        ) {
          resumeGame();
        }

        return;
      }

      if (
        event.code ===
        "KeyE"
      ) {
        tryInteract();

        return;
      }

      if (
        event.code ===
        "KeyF"
      ) {
        toggleFlashlight();

        return;
      }

      if (
        event.code ===
        "KeyN"
      ) {
        openNotesLog();

        return;
      }

      if (
        event.code ===
        "KeyH"
      ) {
        toggleHide();

        return;
      }

      if (
        [
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight"
        ].includes(
          event.code
        )
      ) {
        event.preventDefault();
      }
    }
  );

  window.addEventListener(
    "keyup",
    (event) => {
      keys[event.code] =
        false;
    }
  );
}


/* ============================================================
   HIDING SYSTEM
   ============================================================ */

function toggleHide() {
  if (
    !state.running ||
    state.paused ||
    state.dead ||
    state.won
  ) {
    return;
  }

  state.hiding =
    !state.hiding;

  if (
    state.hiding
  ) {
    state.hideTime =
      0;

    state.noise =
      Math.max(
        0,
        state.noise -
        35
      );

    setMessage(
      "YOU ARE HIDING",
      1200
    );
  } else {
    setMessage(
      "YOU LEFT HIDING",
      1000
    );
  }
}

function updateHiding(dt) {
  if (
    !state.hiding
  ) {
    return;
  }

  state.hideTime +=
    dt;

  state.noise =
    Math.max(
      0,
      state.noise -
      18 * dt
    );

  if (
    demon &&
    player
  ) {
    const distance =
      distance2D(
        demon.position,
        player.position
      );

    if (
      distance >
      28
    ) {
      state.demonAlert =
        false;

      state.demonLastKnown =
        null;
    }
  }
}


/* ============================================================
   INTERACTION PROMPT
   ============================================================ */

function updateInteractionPrompt() {
  if (
    !state.running ||
    state.paused
  ) {
    return;
  }

  let closest = null;
  let closestDistance =
    Infinity;

  for (
    const item
    of interactables
  ) {
    const distance =
      distance2D(
        player.position,
        item.object.position
      );

    if (
      distance <
      item.range &&
      distance <
      closestDistance
    ) {
      closest =
        item;

      closestDistance =
        distance;
    }
  }

  for (
    const pickup
    of pickups
  ) {
    if (
      !pickup.object.visible
    ) {
      continue;
    }

    const distance =
      distance2D(
        player.position,
        pickup.object.position
      );

    if (
      distance <
      pickup.range &&
      distance <
      closestDistance
    ) {
      closest = pickup;

      closestDistance =
        distance;
    }
  }

  if (!closest) {
    return;
  }

  if (
    closest.type ===
    "button"
  ) {
    if (
      state.buttons[
        closest.index
      ]
    ) {
      setMessage(
        "BUTTON ACTIVE",
        150
      );
    } else {
      setMessage(
        "PRESS E TO ACTIVATE",
        150
      );
    }
  }

  if (
    closest.type ===
    "key"
  ) {
    setMessage(
      "PRESS E TO TAKE KEY",
      150
    );
  }

  if (
    closest.type ===
    "gate"
  ) {
    if (
      state.gateOpen
    ) {
      setMessage(
        "EXIT THROUGH THE GATE",
        150
      );
    } else {
      setMessage(
        "PRESS E TO OPEN",
        150
      );
    }
  }
}


/* ============================================================
   INSTRUCTIONS / MENU
   ============================================================ */

function initializeMenu() {
  $("playButton")?.addEventListener(
    "click",
    () => {
      initializeAudio();
      openDeviceSelector();
    }
  );

  $("instructionsButton")
    ?.addEventListener(
      "click",
      () => {
        hide("menuScreen");
        show("instructionsScreen");
      }
    );

  $("settingsButton")
    ?.addEventListener(
      "click",
      () => {
        syncSettingsUI();
        hide("menuScreen");
        show("settingsScreen");
      }
    );

  $("instructionsBack")
    ?.addEventListener(
      "click",
      () => {
        hide("instructionsScreen");
        show("menuScreen");
      }
    );

  $("settingsBack")
    ?.addEventListener(
      "click",
      () => {
        saveSettings();
        hide("settingsScreen");
        show("menuScreen");
      }
    );
}


/* ============================================================
   GAME UI BUTTONS
   ============================================================ */

function initializeGameUI() {
  $("resumeButton")
    ?.addEventListener(
      "click",
      resumeGame
    );

  $("quitButton")
    ?.addEventListener(
      "click",
      () => {
        location.reload();
      }
    );

  $("retryButton")
    ?.addEventListener(
      "click",
      () => {
        startGame();
      }
    );

  $("deathMenuButton")
    ?.addEventListener(
      "click",
      () => {
        location.reload();
      }
    );

  $("winAgainButton")
    ?.addEventListener(
      "click",
      () => {
        startGame();
      }
    );

  $("winMenuButton")
    ?.addEventListener(
      "click",
      () => {
        location.reload();
      }
    );

  $("notesLogButton")
    ?.addEventListener(
      "click",
      openNotesLog
    );

  $("notesLogBack")
    ?.addEventListener(
      "click",
      () => {
        hide(
          "notesLogScreen"
        );
      }
    );
}


/* ============================================================
   SETTINGS UI
   ============================================================ */

function initializeSettings() {
  const volume =
    $("volumeSetting");

  volume?.addEventListener(
    "input",
    (event) => {
      state.volume =
        clamp(
          Number(
            event.target.value
          ) / 100,
          0,
          1
        );

      updateMasterVolume();
      saveSettings();
    }
  );

  const flashlightSetting =
    $("flashlightSetting");

  flashlightSetting?.addEventListener(
    "change",
    (event) => {
      state.flashlight =
        event.target.checked;

      if (
        flashlight
      ) {
        flashlight.visible =
          state.flashlight;
      }

      saveSettings();
    }
  );

  const footstepSetting =
    $("footstepSetting");

  footstepSetting?.addEventListener(
    "change",
    (event) => {
      state.footsteps =
        event.target.checked;

      saveSettings();
    }
  );
}


/* ============================================================
   POINTER LOCK
   ============================================================ */

function initializePointerLock() {
  document.addEventListener(
    "pointerlockchange",
    () => {
      pointerLocked =
        document.pointerLockElement ===
        renderer?.domElement;
    }
  );

  document.addEventListener(
    "mousemove",
    handleMouseMove
  );

  document.addEventListener(
    "mousedown",
    (event) => {
      if (
        event.button !== 0
      ) {
        return;
      }

      if (
        state.device !==
        "pc"
      ) {
        return;
      }

      if (
        !state.running ||
        state.paused
      ) {
        return;
      }

      if (
        renderer &&
        !pointerLocked
      ) {
        renderer.domElement
          .requestPointerLock?.();
      }
    }
  );
}


/* ============================================================
   RESIZE
   ============================================================ */

function resizeRenderer() {
  if (
    !renderer ||
    !camera
  ) {
    return;
  }

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}


/* ============================================================
   GAME LOOP
   ============================================================ */

function gameLoop(
  timestamp
) {
  if (
    !state.running &&
    !state.paused
  ) {
    return;
  }

  requestAnimationFrame(
    gameLoop
  );

  const delta =
    Math.min(
      0.05,
      (
        timestamp -
        state.lastTime
      ) / 1000
    );

  state.lastTime =
    timestamp;

  if (
    state.paused
  ) {
    if (
      renderer &&
      scene &&
      camera
    ) {
      renderer.render(
        scene,
        camera
      );
    }

    return;
  }

  updatePlayer(
    delta
  );

  updateDemon(
    delta
  );

  updateHiding(
    delta
  );

  updateHUD(
    delta
  );

  updateInteractionPrompt();

  updateMinimap();

  updateFlashlight();

  if (
    renderer &&
    scene &&
    camera
  ) {
    renderer.render(
      scene,
      camera
    );
  }
}


/* ============================================================
   FLASHLIGHT UPDATE
   ============================================================ */

function updateFlashlight() {
  if (
    !flashlight ||
    !camera
  ) {
    return;
  }

  flashlight.visible =
    state.flashlight;

  flashlight.intensity =
    state.flashlight
      ? 3.2
      : 0;

  if (
    state.sprinting
  ) {
    flashlight.intensity =
      state.flashlight
        ? 2.85
        : 0;
  }
}


/* ============================================================
   LOAD ERROR WATCHDOG
   ============================================================ */

function showLoadError(
  message
) {
  const box =
    $("loadError");

  if (!box) {
    return;
  }

  const text =
    qs(
      ".box",
      box
    );

  if (text) {
    text.textContent =
      message;
  }

  show(
    box
  );
}

window.addEventListener(
  "error",
  (event) => {
    if (
      event.error
    ) {
      console.error(
        "[THE SEEKER]",
        event.error
      );
    }
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "[THE SEEKER]",
      event.reason
    );
  }
);


/* ============================================================
   INITIALIZATION
   ============================================================ */

function initializeGame() {
  try {
    loadSettings();

    initializeMenu();

    initializeGameUI();

    initializeSettings();

    initializeKeyboard();

    initializeMobileControls();

    initializePointerLock();

    syncSettingsUI();

    setText(
      "timer",
      "03:00"
    );

    setText(
      "notesCount",
      "0"
    );

    setObjective(
      "Find the three buttons."
    );
  } catch (error) {
    console.error(
      "[THE SEEKER] Initialization error:",
      error
    );

    showLoadError(
      "The game could not initialize. Check the browser console for details."
    );
  }
}


/* ============================================================
   START
   ============================================================ */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initializeGame,
    {
      once: true
    }
  );
} else {
  initializeGame();
}


/* ============================================================
   EXTENDED GAME DATA
   These definitions provide a clean foundation for expanding
   the game without changing the main gameplay architecture.
   ============================================================ */

const SEEKER_WORLD_DATA = {
  name: "The Seeker",

  developer:
    "BlackHollow Games",

  creator:
    "Stive Pierre",

  version:
    "1.0.0",

  world: {
    sizeX: 150,
    sizeZ: 150,

    playerSpawn: {
      x: 0,
      y: 1.65,
      z: 62
    },

    seekerSpawn: {
      x: -48,
      y: 0,
      z: 48
    },

    gatePosition: {
      x: 0,
      y: 3.5,
      z: -68
    }
  },

  objectives: [
    {
      id: "button_1",
      name: "Button One",
      type: "button"
    },

    {
      id: "button_2",
      name: "Button Two",
      type: "button"
    },

    {
      id: "button_3",
      name: "Button Three",
      type: "button"
    },

    {
      id: "key",
      name: "Gate Key",
      type: "key"
    },

    {
      id: "gate",
      name: "Escape Gate",
      type: "gate"
    }
  ],

  controls: {
    pc: {
      forward: "W",
      backward: "S",
      left: "A",
      right: "D",
      sprint: "SHIFT",
      interact: "E",
      flashlight: "F",
      hide: "H",
      notes: "N",
      pause: "ESC"
    },

    mobile: {
      movement:
        "virtual joystick",

      look:
        "right-side drag",

      sprint:
        "run button",

      interact:
        "interaction button",

      flashlight:
        "flashlight button"
    }
  }
};


/* ============================================================
   DEBUG API
   ============================================================ */

window.TheSeeker =
  {
    state,

    config:
      CONFIG,

    world:
      SEEKER_WORLD_DATA,

    start:
      startGame,

    pause:
      pauseGame,

    resume:
      resumeGame,

    interact:
      tryInteract,

    flashlight:
      toggleFlashlight,

    addNote,

    getPlayer() {
      return player;
    },

    getSeeker() {
      return demon;
    },

    getScene() {
      return scene;
    }
  };


/* ============================================================
   FINAL SAFETY INITIALIZATION
   ============================================================ */

window.addEventListener(
  "beforeunload",
  () => {
    saveSettings();

    try {
      stopAmbientAudio();
    } catch {}
  }
);