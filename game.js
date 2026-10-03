/* ============================================================
   THE SEEKER
   Complete game.js
   BlackHollow Games
   Created by Stive Pierre
   ============================================================ */

import * as THREE from "three";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const GAME_CONFIG = {
    title: "THE SEEKER",

    world: {
        width: 180,
        depth: 180,
        wallHeight: 8,
        wallThickness: 1,
        roomSize: 18,
        floorSize: 220
    },

    player: {
        height: 2.05,
        radius: 0.42,
        speed: 4.2,
        runSpeed: 7.2,
        acceleration: 20,
        friction: 14,
        gravity: 24,
        jumpHeight: 0,
        eyeHeight: 1.75,
        start: {
            x: 0,
            y: 1.05,
            z: 72
        }
    },

    seeker: {
        height: 2.8,
        radius: 0.65,
        walkSpeed: 1.65,
        chaseSpeed: 3.75,
        searchSpeed: 2.5,
        hearingRadius: 18,
        visionDistance: 30,
        visionAngle: Math.PI * 0.7,
        searchTime: 7,
        attackDistance: 1.6
    },

    game: {
        preparationTime: 180,
        startingSanity: 100,
        maximumNoise: 100,
        buttonCount: 3,
        notesRequired: 3,
        interactionDistance: 3.2
    },

    graphics: {
        shadows: true,
        pixelRatioLimit: 1.8,
        fogNear: 18,
        fogFar: 150
    },

    colors: {
        black: 0x030303,
        floor: 0x111111,
        wall: 0x191919,
        wallDark: 0x0d0d0d,
        ceiling: 0x080808,
        metal: 0x303030,
        wood: 0x30251c,
        red: 0xb33030,
        yellow: 0xc9a227,
        green: 0x2a8a4a,
        white: 0xe8e8e8
    }
};

/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ = (id) => document.getElementById(id);

const menuScreen = $("menuScreen");
const instructionsScreen = $("instructionsScreen");
const settingsScreen = $("settingsScreen");
const gameScreen = $("gameScreen");

const playButton = $("playButton");
const instructionsButton = $("instructionsButton");
const settingsButton = $("settingsButton");

const instructionsBack = $("instructionsBack");
const settingsBack = $("settingsBack");

const gameCanvas = $("gameCanvas");

const objectiveElement = $("objective");
const notesCountElement = $("notesCount");
const timerElement = $("timer");

const button1 = $("button1");
const button2 = $("button2");
const button3 = $("button3");

const sanityFill = $("sanityFill");
const interactionElement = $("interaction");
const interactionText = $("interactionText");

const noiseContainer = $("noiseFill");
const hideTimer = $("hideTimer");
const hideTimerValue = $("hideTimerValue");
const dangerWarning = $("dangerWarning");

const noteToast = $("noteToast");
const noteToastText = $("noteToastText");

const screamOverlay = $("screamOverlay");

const mobileControls = $("mobileControls");
const joystickZone = $("joystickZone");
const joystickBase = $("joystickBase");
const joystickKnob = $("joystickKnob");
const mobileRun = $("mobileRun");
const mobileInteract = $("mobileInteract");
const mobileFlashlight = $("mobileFlashlight");
const lookZone = $("lookZone");

const pauseScreen = $("pauseScreen");
const resumeButton = $("resumeButton");
const notesLogButton = $("notesLogButton");
const quitButton = $("quitButton");

const notesLogScreen = $("notesLogScreen");
const notesLogList = $("notesLogList");
const notesLogEmpty = $("notesLogEmpty");
const notesLogBack = $("notesLogBack");

const deathScreen = $("deathScreen");
const deathReason = $("deathReason");
const retryButton = $("retryButton");
const deathMenuButton = $("deathMenuButton");

const winScreen = $("winScreen");
const winTitle = $("winTitle");
const winText = $("winText");
const winAgainButton = $("winAgainButton");
const winMenuButton = $("winMenuButton");

/* ============================================================
   GLOBAL STATE
   ============================================================ */

const state = {
    initialized: false,
    running: false,
    paused: false,
    dead: false,
    won: false,

    device: "pc",

    elapsed: 0,
    preparationRemaining: GAME_CONFIG.game.preparationTime,

    sanity: GAME_CONFIG.game.startingSanity,
    noise: 0,

    keyCollected: false,
    gateOpen: false,

    buttons: [
        {
            id: 1,
            pressed: false,
            position: new THREE.Vector3(-52, 1.2, -40)
        },
        {
            id: 2,
            pressed: false,
            position: new THREE.Vector3(48, 1.2, -20)
        },
        {
            id: 3,
            pressed: false,
            position: new THREE.Vector3(4, 1.2, -72)
        }
    ],

    notes: [],

    flashlightEnabled: true,
    footstepsEnabled: true,
    volume: 0.7,

    flashlightOn: true,

    hideMode: false,
    hideRemaining: 0,

    interactionTarget: null,

    seekerActive: false,
    seekerState: "waiting",
    seekerLastKnownPosition: new THREE.Vector3(),

    footstepTimer: 0,
    footstepIndex: 0,

    lastFrame: performance.now(),
    fps: 60,

    deviceScreenShown: false,

    messageQueue: []
};

/* ============================================================
   THREE.JS VARIABLES
   ============================================================ */

let renderer = null;
let scene = null;
let camera = null;

let clock = null;

let worldGroup = null;
let environmentGroup = null;
let collisionGroup = null;
let interactableGroup = null;
let seekerGroup = null;
let effectGroup = null;

let player = null;
let playerVelocity = new THREE.Vector3();

let seeker = null;
let seekerVelocity = new THREE.Vector3();

let flashlight = null;
let flashlightTarget = null;

let gate = null;
let gateLight = null;

let raycaster = new THREE.Raycaster();

let audioContext = null;
let masterGain = null;

let pointerLocked = false;

let yaw = 0;
let pitch = 0;

const keys = new Set();

const mouse = {
    sensitivity: 0.0021,
    movementX: 0,
    movementY: 0
};

const joystick = {
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    maxDistance: 48
};

const lookTouch = {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0
};

const collisionBoxes = [];

const interactables = [];

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}

function distanceXZ(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function directionTo(from, to) {
    const result = new THREE.Vector3(
        to.x - from.x,
        0,
        to.z - from.z
    );

    if (result.lengthSq() > 0.00001) {
        result.normalize();
    }

    return result;
}

function hideElement(element) {
    if (element) {
        element.classList.add("hidden");
    }
}

function showElement(element) {
    if (element) {
        element.classList.remove("hidden");
    }
}

function setText(element, text) {
    if (element) {
        element.textContent = text;
    }
}

/* ============================================================
   OBJECTIVE SYSTEM
   ============================================================ */

function setObjective(text) {
    if (!objectiveElement) {
        return;
    }

    objectiveElement.textContent = String(text ?? "");

    objectiveElement.classList.remove("objective-update");

    void objectiveElement.offsetWidth;

    objectiveElement.classList.add("objective-update");

    window.setTimeout(() => {
        objectiveElement.classList.remove("objective-update");
    }, 600);
}

function updateObjective() {
    if (!state.running) {
        return;
    }

    const pressed = state.buttons.filter((button) => button.pressed).length;

    if (!state.seekerActive) {
        setObjective(
            `Explore the house. The Seeker will begin searching in ${formatTime(
                state.preparationRemaining
            )}.`
        );
        return;
    }

    if (pressed < GAME_CONFIG.game.buttonCount) {
        setObjective(
            `Find the remaining buttons. ${pressed}/${GAME_CONFIG.game.buttonCount} activated.`
        );
        return;
    }

    if (!state.keyCollected) {
        setObjective("All buttons are active. Find the key.");
        return;
    }

    if (!state.gateOpen) {
        setObjective("You have the key. Find the exit gate.");
        return;
    }

    setObjective("The gate is open. Escape the house.");
}

/* ============================================================
   TIME
   ============================================================ */

function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safe / 60);
    const remainingSeconds = safe % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
}

function updateTimerUI() {
    if (timerElement) {
        timerElement.textContent = formatTime(
            state.seekerActive
                ? Math.max(0, state.elapsed)
                : state.preparationRemaining
        );
    }
}

/* ============================================================
   DEVICE SELECTION
   ============================================================ */

function createDeviceSelection() {
    if (state.deviceScreenShown) {
        return;
    }

    state.deviceScreenShown = true;

    const existing = document.getElementById("deviceSelection");

    if (existing) {
        existing.remove();
    }

    const screen = document.createElement("div");

    screen.id = "deviceSelection";

    screen.innerHTML = `
        <div class="device-selection-backdrop"></div>

        <div class="device-selection-panel">
            <div class="device-selection-kicker">THE SEEKER</div>

            <h2>SELECT CONTROLS</h2>

            <p class="device-selection-subtitle">
                Choose how you want to play.
            </p>

            <div class="device-selection-options">

                <button class="device-option" data-device="pc">
                    <span class="device-option-icon">⌨</span>
                    <span class="device-option-title">PC</span>
                    <span class="device-option-description">
                        Keyboard + mouse
                    </span>
                </button>

                <button class="device-option" data-device="mobile">
                    <span class="device-option-icon">▣</span>
                    <span class="device-option-title">MOBILE</span>
                    <span class="device-option-description">
                        Touch controls
                    </span>
                </button>

            </div>

            <button class="device-selection-cancel">
                BACK
            </button>
        </div>
    `;

    document.body.appendChild(screen);

    const options = screen.querySelectorAll(".device-option");

    options.forEach((option) => {
        option.addEventListener("click", () => {
            const selectedDevice = option.dataset.device || "pc";

            state.device = selectedDevice;

            screen.remove();

            startGame();
        });
    });

    const cancel = screen.querySelector(".device-selection-cancel");

    cancel?.addEventListener("click", () => {
        screen.remove();
        state.deviceScreenShown = false;
    });
}

/* ============================================================
   RENDERER
   ============================================================ */

function createRenderer() {
    renderer = new THREE.WebGLRenderer({
        canvas: gameCanvas || undefined,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            GAME_CONFIG.graphics.pixelRatioLimit
        )
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    renderer.shadowMap.enabled = GAME_CONFIG.graphics.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;

    return renderer;
}

/* ============================================================
   SCENE
   ============================================================ */

function createScene() {
    scene = new THREE.Scene();

    scene.background = new THREE.Color(GAME_CONFIG.colors.black);

    scene.fog = new THREE.Fog(
        GAME_CONFIG.colors.black,
        GAME_CONFIG.graphics.fogNear,
        GAME_CONFIG.graphics.fogFar
    );

    clock = new THREE.Clock();

    worldGroup = new THREE.Group();
    environmentGroup = new THREE.Group();
    collisionGroup = new THREE.Group();
    interactableGroup = new THREE.Group();
    seekerGroup = new THREE.Group();
    effectGroup = new THREE.Group();

    worldGroup.name = "World";

    scene.add(worldGroup);

    worldGroup.add(environmentGroup);
    worldGroup.add(collisionGroup);
    worldGroup.add(interactableGroup);
    worldGroup.add(seekerGroup);
    worldGroup.add(effectGroup);
}

/* ============================================================
   CAMERA
   ============================================================ */

function createCamera() {
    camera = new THREE.PerspectiveCamera(
        74,
        window.innerWidth / window.innerHeight,
        0.05,
        500
    );

    camera.position.set(
        GAME_CONFIG.player.start.x,
        GAME_CONFIG.player.start.y,
        GAME_CONFIG.player.start.z
    );

    camera.rotation.order = "YXZ";

    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

/* ============================================================
   LIGHTING
   ============================================================ */

function createLighting() {
    const ambient = new THREE.AmbientLight(
        0x8890a0,
        0.22
    );

    scene.add(ambient);

    const moon = new THREE.DirectionalLight(
        0x9ca8c4,
        0.18
    );

    moon.position.set(
        -40,
        70,
        30
    );

    moon.castShadow = true;

    moon.shadow.mapSize.width = 1024;
    moon.shadow.mapSize.height = 1024;

    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 180;

    moon.shadow.camera.left = -100;
    moon.shadow.camera.right = 100;
    moon.shadow.camera.top = 100;
    moon.shadow.camera.bottom = -100;

    scene.add(moon);

    flashlight = new THREE.SpotLight(
        0xf2f2e8,
        9,
        34,
        Math.PI / 7,
        0.65,
        1.25
    );

    flashlight.castShadow = true;

    flashlight.shadow.mapSize.width = 512;
    flashlight.shadow.mapSize.height = 512;

    flashlight.shadow.camera.near = 0.1;
    flashlight.shadow.camera.far = 40;

    flashlightTarget = new THREE.Object3D();

    scene.add(flashlight);
    scene.add(flashlightTarget);

    flashlight.target = flashlightTarget;
}

/* ============================================================
   MATERIAL HELPERS
   ============================================================ */

function material(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.82,
        metalness: options.metalness ?? 0,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0
    });
}

function createBox(
    width,
    height,
    depth,
    color,
    position,
    options = {}
) {
    const geometry = new THREE.BoxGeometry(
        width,
        height,
        depth
    );

    const mesh = new THREE.Mesh(
        geometry,
        material(color, options)
    );

    mesh.position.copy(position);

    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;

    environmentGroup.add(mesh);

    return mesh;
}

/* ============================================================
   COLLISION SYSTEM
   ============================================================ */

function addCollisionBox(
    x,
    y,
    z,
    width,
    height,
    depth,
    options = {}
) {
    const box = new THREE.Box3();

    box.min.set(
        x - width / 2,
        y - height / 2,
        z - depth / 2
    );

    box.max.set(
        x + width / 2,
        y + height / 2,
        z + depth / 2
    );

    collisionBoxes.push({
        box,
        solid: options.solid !== false,
        name: options.name || "wall"
    });

    return box;
}

function addWall(
    x,
    y,
    z,
    width,
    height,
    depth,
    color = GAME_CONFIG.colors.wall,
    options = {}
) {
    createBox(
        width,
        height,
        depth,
        color,
        new THREE.Vector3(x, y, z),
        options
    );

    addCollisionBox(
        x,
        y,
        z,
        width,
        height,
        depth,
        {
            name: options.name || "wall"
        }
    );
}

/* ============================================================
   FLOOR
   ============================================================ */

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(
        GAME_CONFIG.world.floorSize,
        GAME_CONFIG.world.floorSize,
        20,
        20
    );

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: GAME_CONFIG.colors.floor,
        roughness: 0.95,
        metalness: 0.02
    });

    const floor = new THREE.Mesh(
        floorGeometry,
        floorMaterial
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;

    floor.receiveShadow = true;

    environmentGroup.add(floor);

    const ceilingGeometry = new THREE.PlaneGeometry(
        GAME_CONFIG.world.floorSize,
        GAME_CONFIG.world.floorSize
    );

    const ceiling = new THREE.Mesh(
        ceilingGeometry,
        new THREE.MeshStandardMaterial({
            color: GAME_CONFIG.colors.ceiling,
            roughness: 1
        })
    );

    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = GAME_CONFIG.world.wallHeight;

    ceiling.receiveShadow = true;

    environmentGroup.add(ceiling);
}

/* ============================================================
   HOUSE STRUCTURE
   ============================================================ */

function buildOuterWalls() {
    const half = GAME_CONFIG.world.floorSize / 2;
    const h = GAME_CONFIG.world.wallHeight;
    const t = GAME_CONFIG.world.wallThickness;

    addWall(
        0,
        h / 2,
        -half,
        GAME_CONFIG.world.floorSize,
        h,
        t
    );

    addWall(
        0,
        h / 2,
        half,
        GAME_CONFIG.world.floorSize,
        h,
        t
    );

    addWall(
        -half,
        h / 2,
        0,
        t,
        h,
        GAME_CONFIG.world.floorSize
    );

    addWall(
        half,
        h / 2,
        0,
        t,
        h,
        GAME_CONFIG.world.floorSize
    );
}

function buildMainRooms() {
    const h = GAME_CONFIG.world.wallHeight;
    const t = GAME_CONFIG.world.wallThickness;

    /*
       Large interior layout.

       The map is intentionally much larger than a tiny
       single-room horror map.

       Approximate areas:

       NORTH
       ------------------------------------------------
       | Bedroom | Hall | Storage | Office            |
       ------------------------------------------------
       | Hall            | Central Hall | Workshop    |
       ------------------------------------------------
       | Kitchen         | Living       | Basement    |
       ------------------------------------------------
       | Side Hall       | Entrance     | Exit        |
       ------------------------------------------------
       SOUTH
    */

    addWall(
        -50,
        h / 2,
        -32,
        45,
        h,
        t
    );

    addWall(
        50,
        h / 2,
        -32,
        45,
        h,
        t
    );

    addWall(
        -50,
        h / 2,
        32,
        45,
        h,
        t
    );

    addWall(
        50,
        h / 2,
        32,
        45,
        h,
        t
    );

    addWall(
        -30,
        h / 2,
        -58,
        t,
        h,
        44
    );

    addWall(
        30,
        h / 2,
        -58,
        t,
        h,
        44
    );

    addWall(
        -30,
        h / 2,
        58,
        t,
        h,
        44
    );

    addWall(
        30,
        h / 2,
        58,
        t,
        h,
        44
    );

    addWall(
        -70,
        h / 2,
        0,
        30,
        h,
        t
    );

    addWall(
        70,
        h / 2,
        0,
        30,
        h,
        t
    );

    addWall(
        0,
        h / 2,
        18,
        44,
        h,
        t
    );

    addWall(
        0,
        h / 2,
        -18,
        44,
        h,
        t
    );

    /*
       Smaller divider walls.
    */

    addWall(
        -58,
        h / 2,
        -62,
        t,
        h,
        30
    );

    addWall(
        -58,
        h / 2,
        -12,
        t,
        h,
        28
    );

    addWall(
        58,
        h / 2,
        -62,
        t,
        h,
        30
    );

    addWall(
        58,
        h / 2,
        -12,
        t,
        h,
        28
    );

    addWall(
        -58,
        h / 2,
        62,
        t,
        h,
        30
    );

    addWall(
        58,
        h / 2,
        62,
        t,
        h,
        30
    );

    addWall(
        -76,
        h / 2,
        -45,
        18,
        h,
        t
    );

    addWall(
        76,
        h / 2,
        -45,
        18,
        h,
        t
    );

    addWall(
        -76,
        h / 2,
        45,
        18,
        h,
        t
    );

    addWall(
        76,
        h / 2,
        45,
        18,
        h,
        t
    );
}

/* ============================================================
   DECORATION
   ============================================================ */

function createTable(x, y, z, width = 3.5, depth = 2) {
    const group = new THREE.Group();

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.22, depth),
        material(GAME_CONFIG.colors.wood)
    );

    top.position.y = 1.25;

    group.add(top);

    const legPositions = [
        [-width / 2 + 0.2, 0.6, -depth / 2 + 0.2],
        [width / 2 - 0.2, 0.6, -depth / 2 + 0.2],
        [-width / 2 + 0.2, 0.6, depth / 2 - 0.2],
        [width / 2 - 0.2, 0.6, depth / 2 - 0.2]
    ];

    for (const [lx, ly, lz] of legPositions) {
        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 1.2, 0.18),
            material(GAME_CONFIG.colors.wood)
        );

        leg.position.set(lx, ly, lz);

        group.add(leg);
    }

    group.position.set(x, y, z);

    group.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    environmentGroup.add(group);

    return group;
}

function createCrate(x, y, z, size = 2) {
    const crate = createBox(
        size,
        size,
        size,
        0x3a2b20,
        new THREE.Vector3(x, y + size / 2, z),
        {
            roughness: 0.95
        }
    );

    crate.userData.crate = true;

    addCollisionBox(
        x,
        y + size / 2,
        z,
        size,
        size,
        size,
        {
            name: "crate"
        }
    );

    return crate;
}

function createFurniture() {
    createTable(-54, 0, -54, 4, 2);
    createTable(53, 0, -54, 4, 2);
    createTable(-54, 0, 52, 3, 2);
    createTable(53, 0, 53, 5, 2);

    createCrate(-68, 0, -65, 2.5);
    createCrate(-64, 0, -67, 2);
    createCrate(67, 0, -66, 2.5);
    createCrate(70, 0, -63, 2);

    createCrate(-67, 0, 66, 2);
    createCrate(66, 0, 65, 2.5);

    createBench(-10, 0, 9);
    createBench(12, 0, 9);
    createBench(-12, 0, -9);
    createBench(12, 0, -9);
}

function createBench(x, y, z) {
    const group = new THREE.Group();

    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.3, 1),
        material(GAME_CONFIG.colors.wood)
    );

    seat.position.y = 1;

    group.add(seat);

    for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 1, 0.25),
            material(GAME_CONFIG.colors.wood)
        );

        leg.position.set(
            side * 1.4,
            0.5,
            0
        );

        group.add(leg);
    }

    group.position.set(x, y, z);

    group.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    environmentGroup.add(group);
}

/* ============================================================
   WINDOWS
   ============================================================ */

function createWindow(x, y, z, rotationY = 0) {
    const frameMaterial = material(0x252525, {
        roughness: 0.55
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x263a48,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0x071016,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.72
    });

    const group = new THREE.Group();

    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 3, 0.12),
        glassMaterial
    );

    group.add(glass);

    const vertical = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 3.3, 0.2),
        frameMaterial
    );

    group.add(vertical);

    const horizontal = new THREE.Mesh(
        new THREE.BoxGeometry(3.7, 0.14, 0.2),
        frameMaterial
    );

    group.add(horizontal);

    group.position.set(x, y, z);
    group.rotation.y = rotationY;

    environmentGroup.add(group);
}

function createWindows() {
    createWindow(-89, 4.1, -35, Math.PI / 2);
    createWindow(-89, 4.1, 35, Math.PI / 2);

    createWindow(89, 4.1, -35, -Math.PI / 2);
    createWindow(89, 4.1, 35, -Math.PI / 2);

    createWindow(-42, 4.1, -89, 0);
    createWindow(42, 4.1, -89, 0);

    createWindow(-42, 4.1, 89, Math.PI);
    createWindow(42, 4.1, 89, Math.PI);
}

/* ============================================================
   LIGHTS
   ============================================================ */

function createRoomLight(
    x,
    y,
    z,
    color = 0xffd8a0,
    intensity = 0.35
) {
    const light = new THREE.PointLight(
        color,
        intensity,
        18
    );

    light.position.set(x, y, z);

    light.castShadow = false;

    environmentGroup.add(light);

    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshStandardMaterial({
            color: 0xffd8a0,
            emissive: color,
            emissiveIntensity: 1.5
        })
    );

    bulb.position.copy(light.position);

    environmentGroup.add(bulb);

    return light;
}

function createHouseLights() {
    const positions = [
        [-65, 6, -65],
        [-25, 6, -65],
        [25, 6, -65],
        [65, 6, -65],

        [-65, 6, -25],
        [-25, 6, -25],
        [25, 6, -25],
        [65, 6, -25],

        [-65, 6, 25],
        [-25, 6, 25],
        [25, 6, 25],
        [65, 6, 25],

        [-65, 6, 65],
        [-25, 6, 65],
        [25, 6, 65],
        [65, 6, 65]
    ];

    positions.forEach((position, index) => {
        const intensity =
            index % 5 === 0
                ? 0.08
                : 0.22;

        createRoomLight(
            position[0],
            position[1],
            position[2],
            0xffd6a0,
            intensity
        );
    });
}

/* ============================================================
   EXIT GATE
   ============================================================ */

function createGate() {
    gate = new THREE.Group();

    const gateMaterial = material(
        GAME_CONFIG.colors.metal,
        {
            roughness: 0.5,
            metalness: 0.75
        }
    );

    const left = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.4,
            5.5,
            5
        ),
        gateMaterial
    );

    left.position.set(-2.5, 2.75, 0);

    const right = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.4,
            5.5,
            5
        ),
        gateMaterial
    );

    right.position.set(2.5, 2.75, 0);

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(
            5.4,
            0.4,
            5
        ),
        gateMaterial
    );

    top.position.set(0, 5.35, 0);

    gate.add(left);
    gate.add(right);
    gate.add(top);

    gate.position.set(0, 0, -87);

    environmentGroup.add(gate);

    addCollisionBox(
        0,
        2.75,
        -87,
        5.5,
        5.5,
        1,
        {
            name: "exit-gate"
        }
    );

    gateLight = new THREE.PointLight(
        GAME_CONFIG.colors.red,
        1.2,
        12
    );

    gateLight.position.set(
        0,
        4.4,
        -84
    );

    environmentGroup.add(gateLight);

    const exitSign = new THREE.Mesh(
        new THREE.BoxGeometry(
            3.2,
            0.8,
            0.15
        ),
        new THREE.MeshStandardMaterial({
            color: 0x250707,
            emissive: GAME_CONFIG.colors.red,
            emissiveIntensity: 0.45
        })
    );

    exitSign.position.set(
        0,
        6.4,
        -84.2
    );

    environmentGroup.add(exitSign);
}

function openGate() {
    if (!gate || state.gateOpen) {
        return;
    }

    state.gateOpen = true;

    const duration = 1.8;
    const start = performance.now();

    const left = gate.children[0];
    const right = gate.children[1];

    const startLeft = left.position.x;
    const startRight = right.position.x;

    const animateGate = (now) => {
        const progress = clamp(
            (now - start) / (duration * 1000),
            0,
            1
        );

        const eased = smoothstep(progress);

        left.position.x = lerp(
            startLeft,
            startLeft - 3.5,
            eased
        );

        right.position.x = lerp(
            startRight,
            startRight + 3.5,
            eased
        );

        if (progress < 1) {
            requestAnimationFrame(animateGate);
        } else {
            removeCollisionByName("exit-gate");
        }
    };

    requestAnimationFrame(animateGate);

    gateLight.color.setHex(
        GAME_CONFIG.colors.green
    );

    gateLight.intensity = 1.7;

    playTone(440, 0.18, "sine");
    setTimeout(() => {
        playTone(660, 0.25, "sine");
    }, 130);

    setObjective("The gate is open. Escape the house.");
}

function removeCollisionByName(name) {
    for (let i = collisionBoxes.length - 1; i >= 0; i--) {
        if (collisionBoxes[i].name === name) {
            collisionBoxes.splice(i, 1);
        }
    }
}

/* ============================================================
   BUTTONS
   ============================================================ */

function createButton(id, position) {
    const group = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.3, 0.9),
        material(0x181818, {
            roughness: 0.6,
            metalness: 0.3
        })
    );

    base.position.y = 0.15;

    group.add(base);

    const buttonMaterial = new THREE.MeshStandardMaterial({
        color: GAME_CONFIG.colors.red,
        emissive: GAME_CONFIG.colors.red,
        emissiveIntensity: 0.8,
        roughness: 0.35
    });

    const buttonMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.27,
            0.27,
            0.2,
            24
        ),
        buttonMaterial
    );

    buttonMesh.rotation.x = Math.PI / 2;
    buttonMesh.position.set(
        0,
        0.42,
        0
    );

    group.add(buttonMesh);

    const glow = new THREE.PointLight(
        GAME_CONFIG.colors.red,
        0.7,
        5
    );

    glow.position.set(
        0,
        0.5,
        0
    );

    group.add(glow);

    group.position.copy(position);

    group.userData.buttonId = id;
    group.userData.buttonMesh = buttonMesh;
    group.userData.glow = glow;

    interactableGroup.add(group);

    interactables.push({
        type: "button",
        id,
        object: group,
        position: group.position,
        label: `Button ${id}`,
        used: false
    });

    return group;
}

function createButtons() {
    state.buttons[0].position.set(
        -52,
        0,
        -40
    );

    state.buttons[1].position.set(
        50,
        0,
        -18
    );

    state.buttons[2].position.set(
        4,
        0,
        -68
    );

    state.buttons.forEach((button) => {
        createButton(
            button.id,
            button.position
        );
    });
}

function activateButton(id) {
    const data = state.buttons.find(
        (button) => button.id === id
    );

    if (!data || data.pressed) {
        return;
    }

    data.pressed = true;

    const interactable = interactables.find(
        (item) =>
            item.type === "button" &&
            item.id === id
    );

    if (interactable) {
        interactable.used = true;

        const mesh = interactable.object.userData.buttonMesh;
        const glow = interactable.object.userData.glow;

        if (mesh) {
            mesh.material.color.setHex(
                GAME_CONFIG.colors.green
            );

            mesh.material.emissive.setHex(
                GAME_CONFIG.colors.green
            );

            mesh.material.emissiveIntensity = 1.4;

            mesh.position.z = 0.09;
        }

        if (glow) {
            glow.color.setHex(
                GAME_CONFIG.colors.green
            );

            glow.intensity = 1.3;
        }
    }

    updateButtonUI();

    playTone(540, 0.1, "square");

    setTimeout(() => {
        playTone(780, 0.16, "sine");
    }, 100);

    showToast(`Button ${id} activated.`);

    createNoisePulse(
        data.position,
        9
    );

    const pressedCount = state.buttons.filter(
        (button) => button.pressed
    ).length;

    if (
        pressedCount >=
        GAME_CONFIG.game.buttonCount
    ) {
        createKey();
        setObjective("All buttons are active. Find the key.");
        showToast("Something unlocked somewhere in the house.");
    } else {
        updateObjective();
    }
}

/* ============================================================
   BUTTON UI
   ============================================================ */

function updateButtonUI() {
    const elements = [
        button1,
        button2,
        button3
    ];

    elements.forEach((element, index) => {
        if (!element) {
            return;
        }

        const pressed =
            state.buttons[index]?.pressed === true;

        element.classList.toggle(
            "active",
            pressed
        );

        element.classList.toggle(
            "complete",
            pressed
        );

        element.textContent = pressed
            ? "ACTIVE"
            : "OFF";
    });
}

/* ============================================================
   KEY
   ============================================================ */

let keyObject = null;

function createKey() {
    if (keyObject) {
        return;
    }

    const keyGroup = new THREE.Group();

    const metal = new THREE.MeshStandardMaterial({
        color: GAME_CONFIG.colors.yellow,
        metalness: 0.85,
        roughness: 0.22,
        emissive: GAME_CONFIG.colors.yellow,
        emissiveIntensity: 0.25
    });

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
            0.32,
            0.09,
            12,
            24
        ),
        metal
    );

    ring.rotation.x = Math.PI / 2;

    keyGroup.add(ring);

    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.75,
            0.12,
            0.12
        ),
        metal
    );

    shaft.position.x = 0.48;

    keyGroup.add(shaft);

    const tooth1 = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.12,
            0.2,
            0.12
        ),
        metal
    );

    tooth1.position.set(
        0.67,
        -0.05,
        0
    );

    keyGroup.add(tooth1);

    const tooth2 = tooth1.clone();

    tooth2.position.x = 0.88;

    keyGroup.add(tooth2);

    keyGroup.position.set(
        55,
        1.4,
        60
    );

    interactableGroup.add(keyGroup);

    keyObject = keyGroup;

    interactables.push({
        type: "key",
        object: keyGroup,
        position: keyGroup.position,
        label: "Key",
        used: false
    });

    addFloatingGlow(
        keyGroup.position,
        GAME_CONFIG.colors.yellow
    );
}

function collectKey() {
    if (!keyObject || state.keyCollected) {
        return;
    }

    state.keyCollected = true;

    const keyItem = interactables.find(
        (item) => item.type === "key"
    );

    if (keyItem) {
        keyItem.used = true;
    }

    keyObject.visible = false;

    playTone(660, 0.12, "sine");

    setTimeout(() => {
        playTone(880, 0.18, "sine");
    }, 110);

    showToast("Key collected.");

    setObjective("You have the key. Find the exit gate.");

    createNoisePulse(
        keyObject.position,
        7
    );
}

/* ============================================================
   FLOATING GLOW
   ============================================================ */

function addFloatingGlow(position, color) {
    const light = new THREE.PointLight(
        color,
        0.9,
        5
    );

    light.position.copy(position);

    effectGroup.add(light);

    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.15,
            16,
            16
        ),
        new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.75
        })
    );

    halo.position.copy(position);

    effectGroup.add(halo);

    light.userData.base = position.clone();
    halo.userData.base = position.clone();

    light.userData.phase = Math.random() * 10;
    halo.userData.phase = light.userData.phase;
}

/* ============================================================
   NOTES
   ============================================================ */

function createNotes() {
    const notePositions = [
        new THREE.Vector3(-65, 1.2, 42),
        new THREE.Vector3(36, 1.2, 54),
        new THREE.Vector3(-42, 1.2, -63)
    ];

    notePositions.forEach((position, index) => {
        createNote(
            index + 1,
            position,
            [
                "The house is much larger than it looks from outside.",
                "The lights are not always reliable. Stay aware of your surroundings.",
                "The gate is the only way out."
            ][index]
        );
    });
}

function createNote(id, position, text) {
    const group = new THREE.Group();

    const paper = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.8,
            0.03,
            0.65
        ),
        new THREE.MeshStandardMaterial({
            color: 0xc9c3aa,
            roughness: 0.9
        })
    );

    paper.rotation.x = -0.2;

    group.add(paper);

    group.position.copy(position);

    interactableGroup.add(group);

    interactables.push({
        type: "note",
        id,
        object: group,
        position: group.position,
        label: `Note ${id}`,
        text,
        used: false
    });
}

function collectNote(note) {
    if (!note || note.used) {
        return;
    }

    note.used = true;

    state.notes.push({
        id: note.id,
        text: note.text
    });

    note.object.visible = false;

    if (notesCountElement) {
        notesCountElement.textContent =
            `${state.notes.length}/${GAME_CONFIG.game.notesRequired}`;
    }

    showToast(`Note ${note.id} collected.`);

    renderNotesLog();

    playTone(330, 0.12, "sine");
}

/* ============================================================
   NOTES LOG
   ============================================================ */

function renderNotesLog() {
    if (!notesLogList) {
        return;
    }

    notesLogList.innerHTML = "";

    if (state.notes.length === 0) {
        showElement(notesLogEmpty);
        return;
    }

    hideElement(notesLogEmpty);

    state.notes.forEach((note) => {
        const entry = document.createElement("div");

        entry.className = "note-log-entry";

        entry.innerHTML = `
            <div class="note-log-title">
                NOTE ${note.id}
            </div>
            <div class="note-log-text">
                ${escapeHTML(note.text)}
            </div>
        `;

        notesLogList.appendChild(entry);
    });
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ============================================================
   SEAKER / ENEMY
   ============================================================ */

function createSeeker() {
    seeker = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x090909,
        roughness: 0.72,
        metalness: 0.05
    });

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(
            0.5,
            1.55,
            6,
            12
        ),
        bodyMaterial
    );

    body.position.y = 1.55;

    seeker.add(body);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.48,
            18,
            14
        ),
        bodyMaterial
    );

    head.position.y = 2.75;

    seeker.add(head);

    const eyeMaterial = new THREE.MeshStandardMaterial({
        color: GAME_CONFIG.colors.red,
        emissive: GAME_CONFIG.colors.red,
        emissiveIntensity: 4
    });

    const leftEye = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.055,
            10,
            10
        ),
        eyeMaterial
    );

    leftEye.position.set(
        -0.16,
        2.78,
        -0.43
    );

    seeker.add(leftEye);

    const rightEye = leftEye.clone();

    rightEye.position.x = 0.16;

    seeker.add(rightEye);

    const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(
            1.3,
            32
        ),
        new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        })
    );

    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;

    seeker.add(shadow);

    seeker.position.set(
        0,
        0,
        -75
    );

    seekerGroup.add(seeker);

    seeker.visible = false;

    state.seekerState = "waiting";
}

function activateSeeker() {
    if (!seeker || state.seekerActive) {
        return;
    }

    state.seekerActive = true;
    state.seekerState = "patrol";

    seeker.visible = true;

    seeker.position.set(
        -70,
        0,
        -70
    );

    showToast("The Seeker is awake.");

    createDangerPulse();

    updateObjective();
}

/* ============================================================
   SEEKER AI
   ============================================================ */

const seekerAI = {
    target: new THREE.Vector3(),
    pathTimer: 0,
    pathIndex: 0,
    searchTimer: 0,
    investigateTimer: 0,
    lastPlayerPosition: new THREE.Vector3(),
    lastSeenTime: 0,
    hearingCooldown: 0
};

function updateSeeker(delta) {
    if (!seeker || !state.seekerActive || state.dead || state.won) {
        return;
    }

    seekerAI.pathTimer -= delta;
    seekerAI.hearingCooldown -= delta;

    const distance = distanceXZ(
        seeker.position,
        camera.position
    );

    const seesPlayer =
        distance <= GAME_CONFIG.seeker.visionDistance &&
        canSeePlayer();

    if (seesPlayer) {
        seekerAI.lastPlayerPosition.copy(
            camera.position
        );

        seekerAI.lastSeenTime = state.elapsed;

        state.seekerState = "chase";
    }

    if (
        state.noise > 20 &&
        seekerAI.hearingCooldown <= 0
    ) {
        const noiseDistance = distanceXZ(
            seeker.position,
            camera.position
        );

        if (
            noiseDistance <=
            GAME_CONFIG.seeker.hearingRadius +
            state.noise * 0.06
        ) {
            seekerAI.lastPlayerPosition.copy(
                camera.position
            );

            seekerAI.investigateTimer = 5;
            seekerAI.hearingCooldown = 1.5;

            if (!seesPlayer) {
                state.seekerState = "investigate";
            }
        }
    }

    if (
        state.seekerState === "chase"
    ) {
        seekerAI.target.copy(
            camera.position
        );

        moveSeekerToward(
            seekerAI.target,
            GAME_CONFIG.seeker.chaseSpeed,
            delta
        );
    } else if (
        state.seekerState === "investigate"
    ) {
        seekerAI.target.copy(
            seekerAI.lastPlayerPosition
        );

        moveSeekerToward(
            seekerAI.target,
            GAME_CONFIG.seeker.searchSpeed,
            delta
        );

        if (
            distanceXZ(
                seeker.position,
                seekerAI.target
            ) < 2
        ) {
            seekerAI.investigateTimer -= delta;

            if (seekerAI.investigateTimer <= 0) {
                state.seekerState = "search";
                seekerAI.searchTimer =
                    GAME_CONFIG.seeker.searchTime;
            }
        }
    } else if (
        state.seekerState === "search"
    ) {
        updateSeekerSearch(delta);
    } else {
        updateSeekerPatrol(delta);
    }

    updateSeekerAnimation(delta);

    if (
        distanceXZ(
            seeker.position,
            camera.position
        ) <= GAME_CONFIG.seeker.attackDistance
    ) {
        triggerDeath("The Seeker caught you.");
    }
}

function moveSeekerToward(target, speed, delta) {
    const direction = directionTo(
        seeker.position,
        target
    );

    if (direction.lengthSq() < 0.0001) {
        return;
    }

    seeker.rotation.y = Math.atan2(
        direction.x,
        direction.z
    );

    const movement = direction
        .clone()
        .multiplyScalar(speed * delta);

    const next = seeker.position.clone().add(
        movement
    );

    if (
        !checkWorldCollision(
            next,
            GAME_CONFIG.seeker.radius
        )
    ) {
        seeker.position.copy(next);
    } else {
        const alternate1 = seeker.position.clone();

        alternate1.x += movement.x;

        if (
            !checkWorldCollision(
                alternate1,
                GAME_CONFIG.seeker.radius
            )
        ) {
            seeker.position.copy(alternate1);
        }

        const alternate2 = seeker.position.clone();

        alternate2.z += movement.z;

        if (
            !checkWorldCollision(
                alternate2,
                GAME_CONFIG.seeker.radius
            )
        ) {
            seeker.position.copy(alternate2);
        }
    }
}

function updateSeekerPatrol(delta) {
    seekerAI.pathTimer -= delta;

    if (seekerAI.pathTimer <= 0) {
        seekerAI.pathTimer = random(4, 8);

        seekerAI.target.set(
            random(-70, 70),
            0,
            random(-70, 70)
        );
    }

    moveSeekerToward(
        seekerAI.target,
        GAME_CONFIG.seeker.walkSpeed,
        delta
    );
}

function updateSeekerSearch(delta) {
    seekerAI.searchTimer -= delta;

    seeker.rotation.y += delta * 0.6;

    if (seekerAI.searchTimer <= 0) {
        state.seekerState = "patrol";
        seekerAI.pathTimer = 0;
    }
}

function updateSeekerAnimation(delta) {
    if (!seeker) {
        return;
    }

    const body = seeker.children[0];

    if (!body) {
        return;
    }

    const walking =
        state.seekerState !== "search";

    if (walking) {
        body.position.y =
            1.55 +
            Math.sin(
                performance.now() * 0.006
            ) * 0.04;
    }
}

/* ============================================================
   SEEKER VISION
   ============================================================ */

function canSeePlayer() {
    if (!camera || !seeker) {
        return false;
    }

    const from = seeker.position.clone();

    from.y += 1.7;

    const to = camera.position.clone();

    const direction = to.clone().sub(from);

    const distance = direction.length();

    if (
        distance >
        GAME_CONFIG.seeker.visionDistance
    ) {
        return false;
    }

    direction.normalize();

    const forward = new THREE.Vector3(
        Math.sin(seeker.rotation.y),
        0,
        Math.cos(seeker.rotation.y)
    );

    const dot = forward.dot(
        new THREE.Vector3(
            direction.x,
            0,
            direction.z
        ).normalize()
    );

    if (
        dot <
        Math.cos(
            GAME_CONFIG.seeker.visionAngle / 2
        )
    ) {
        return false;
    }

    raycaster.set(
        from,
        direction
    );

    const intersections =
        raycaster.intersectObjects(
            environmentGroup.children,
            true
        );

    for (const hit of intersections) {
        if (
            hit.distance <
            distance - 0.3
        ) {
            return false;
        }
    }

    return true;
}

/* ============================================================
   PLAYER
   ============================================================ */

function resetPlayer() {
    camera.position.set(
        GAME_CONFIG.player.start.x,
        GAME_CONFIG.player.start.y,
        GAME_CONFIG.player.start.z
    );

    playerVelocity.set(
        0,
        0,
        0
    );

    yaw = 0;
    pitch = 0;

    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

function updatePlayer(delta) {
    if (
        !state.running ||
        state.paused ||
        state.dead ||
        state.won
    ) {
        return;
    }

    const input = getMovementInput();

    const moving =
        Math.abs(input.x) > 0.01 ||
        Math.abs(input.y) > 0.01;

    const running =
        keys.has("ShiftLeft") ||
        keys.has("ShiftRight") ||
        state.mobileRunning === true;

    const speed =
        running
            ? GAME_CONFIG.player.runSpeed
            : GAME_CONFIG.player.speed;

    const desired = new THREE.Vector3(
        input.x,
        0,
        input.y
    );

    if (desired.lengthSq() > 1) {
        desired.normalize();
    }

    const forward = new THREE.Vector3(
        -Math.sin(yaw),
        0,
        -Math.cos(yaw)
    );

    const right = new THREE.Vector3(
        Math.cos(yaw),
        0,
        -Math.sin(yaw)
    );

    const movement = new THREE.Vector3();

    movement.addScaledVector(
        right,
        desired.x
    );

    movement.addScaledVector(
        forward,
        desired.z
    );

    if (movement.lengthSq() > 0.0001) {
        movement.normalize();
    }

    const targetVelocity = movement.multiplyScalar(
        speed
    );

    playerVelocity.x = moveToward(
        playerVelocity.x,
        targetVelocity.x,
        GAME_CONFIG.player.acceleration * delta
    );

    playerVelocity.z = moveToward(
        playerVelocity.z,
        targetVelocity.z,
        GAME_CONFIG.player.acceleration * delta
    );

    if (!moving) {
        playerVelocity.x = moveToward(
            playerVelocity.x,
            0,
            GAME_CONFIG.player.friction * delta
        );

        playerVelocity.z = moveToward(
            playerVelocity.z,
            0,
            GAME_CONFIG.player.friction * delta
        );
    }

    const next = camera.position.clone();

    next.x += playerVelocity.x * delta;
    next.z += playerVelocity.z * delta;

    const canMove =
        !checkWorldCollision(
            next,
            GAME_CONFIG.player.radius
        );

    if (canMove) {
        camera.position.x = next.x;
        camera.position.z = next.z;
    } else {
        const slideX = camera.position.clone();

        slideX.x += playerVelocity.x * delta;

        if (
            !checkWorldCollision(
                slideX,
                GAME_CONFIG.player.radius
            )
        ) {
            camera.position.x = slideX.x;
        } else {
            playerVelocity.x = 0;
        }

        const slideZ = camera.position.clone();

        slideZ.z += playerVelocity.z * delta;

        if (
            !checkWorldCollision(
                slideZ,
                GAME_CONFIG.player.radius
            )
        ) {
            camera.position.z = slideZ.z;
        } else {
            playerVelocity.z = 0;
        }
    }

    camera.position.x = clamp(
        camera.position.x,
        -GAME_CONFIG.world.floorSize / 2 + 2,
        GAME_CONFIG.world.floorSize / 2 - 2
    );

    camera.position.z = clamp(
        camera.position.z,
        -GAME_CONFIG.world.floorSize / 2 + 2,
        GAME_CONFIG.world.floorSize / 2 - 2
    );

    updateFootsteps(
        delta,
        moving,
        running
    );

    state.noise = Math.max(
        0,
        state.noise -
        delta * 18
    );

    updateNoiseUI();
}

function moveToward(current, target, amount) {
    if (current < target) {
        return Math.min(
            current + amount,
            target
        );
    }

    return Math.max(
        current - amount,
        target
    );
}

function getMovementInput() {
    let x = 0;
    let y = 0;

    if (
        keys.has("KeyA") ||
        keys.has("ArrowLeft")
    ) {
        x -= 1;
    }

    if (
        keys.has("KeyD") ||
        keys.has("ArrowRight")
    ) {
        x += 1;
    }

    if (
        keys.has("KeyW") ||
        keys.has("ArrowUp")
    ) {
        y += 1;
    }

    if (
        keys.has("KeyS") ||
        keys.has("ArrowDown")
    ) {
        y -= 1;
    }

    if (state.device === "mobile") {
        x += joystick.x;
        y += joystick.y;
    }

    return {
        x,
        y
    };
}

/* ============================================================
   COLLISION
   ============================================================ */

function checkWorldCollision(position, radius) {
    for (const collision of collisionBoxes) {
        if (!collision.solid) {
            continue;
        }

        const box = collision.box;

        const closestX = clamp(
            position.x,
            box.min.x,
            box.max.x
        );

        const closestZ = clamp(
            position.z,
            box.min.z,
            box.max.z
        );

        const dx = position.x - closestX;
        const dz = position.z - closestZ;

        if (
            dx * dx +
            dz * dz <
            radius * radius
        ) {
            return true;
        }
    }

    return false;
}

/* ============================================================
   FLASHLIGHT
   ============================================================ */

function updateFlashlight() {
    if (!flashlight || !camera) {
        return;
    }

    flashlight.position.copy(
        camera.position
    );

    flashlightTarget.position.copy(
        camera.position
    );

    const forward = new THREE.Vector3(
        0,
        0,
        -1
    );

    forward.applyEuler(
        camera.rotation
    );

    flashlightTarget.position.add(
        forward.multiplyScalar(10)
    );

    flashlight.visible =
        state.flashlightEnabled &&
        state.flashlightOn;
}

function toggleFlashlight() {
    if (!state.flashlightEnabled) {
        return;
    }

    state.flashlightOn =
        !state.flashlightOn;

    updateFlashlight();

    playTone(
        state.flashlightOn ? 700 : 260,
        0.05,
        "square"
    );
}

/* ============================================================
   FOOTSTEPS
   ============================================================ */

function updateFootsteps(delta, moving, running) {
    if (!moving || !state.footstepsEnabled) {
        return;
    }

    state.footstepTimer -= delta;

    if (state.footstepTimer > 0) {
        return;
    }

    state.footstepTimer =
        running ? 0.3 : 0.46;

    state.footstepIndex++;

    const volume =
        running ? 0.16 : 0.09;

    playFootstep(volume);

    state.noise = clamp(
        state.noise +
        (running ? 22 : 9),
        0,
        GAME_CONFIG.game.maximumNoise
    );
}

function playFootstep(volume) {
    if (!state.footstepsEnabled) {
        return;
    }

    if (!audioContext) {
        return;
    }

    const now =
        audioContext.currentTime;

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type = "triangle";

    oscillator.frequency.setValueAtTime(
        state.footstepIndex % 2 === 0
            ? 72
            : 58,
        now
    );

    gain.gain.setValueAtTime(
        volume * state.volume,
        now
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.09
    );

    oscillator.connect(gain);
    gain.connect(masterGain);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
}

/* ============================================================
   AUDIO
   ============================================================ */

function initializeAudio() {
    try {
        audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

        masterGain =
            audioContext.createGain();

        masterGain.gain.value =
            state.volume;

        masterGain.connect(
            audioContext.destination
        );
    } catch (error) {
        console.warn(
            "[THE SEEKER] Audio unavailable.",
            error
        );
    }
}

function resumeAudio() {
    if (
        audioContext &&
        audioContext.state === "suspended"
    ) {
        audioContext.resume();
    }
}

function playTone(
    frequency,
    duration,
    type = "sine"
) {
    if (
        !audioContext ||
        !masterGain
    ) {
        return;
    }

    const now =
        audioContext.currentTime;

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
        frequency,
        now
    );

    gain.gain.setValueAtTime(
        0.001,
        now
    );

    gain.gain.exponentialRampToValueAtTime(
        0.08 * state.volume,
        now + 0.01
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + duration
    );

    oscillator.connect(gain);
    gain.connect(masterGain);

    oscillator.start(now);
    oscillator.stop(
        now + duration + 0.02
    );
}

/* ============================================================
   INTERACTION
   ============================================================ */

function findInteractionTarget() {
    if (!camera) {
        return null;
    }

    let closest = null;
    let closestDistance =
        GAME_CONFIG.game.interactionDistance;

    for (const item of interactables) {
        if (
            item.used ||
            !item.object.visible
        ) {
            continue;
        }

        const distance =
            distanceXZ(
                camera.position,
                item.position
            );

        if (
            distance >
            GAME_CONFIG.game.interactionDistance
        ) {
            continue;
        }

        if (
            distance <
            closestDistance
        ) {
            closestDistance = distance;
            closest = item;
        }
    }

    return closest;
}

function updateInteraction() {
    const target =
        findInteractionTarget();

    state.interactionTarget = target;

    if (!interactionElement) {
        return;
    }

    if (!target) {
        hideElement(interactionElement);
        return;
    }

    showElement(interactionElement);

    let text = "INTERACT";

    if (target.type === "button") {
        text = `PRESS BUTTON ${target.id}`;
    } else if (target.type === "key") {
        text = "PICK UP KEY";
    } else if (target.type === "note") {
        text = "READ NOTE";
    } else if (target.type === "gate") {
        text = "OPEN GATE";
    }

    setText(
        interactionText,
        text
    );
}

function interact() {
    if (
        !state.running ||
        state.paused ||
        state.dead ||
        state.won
    ) {
        return;
    }

    const target =
        state.interactionTarget ||
        findInteractionTarget();

    if (!target) {
        return;
    }

    if (target.type === "button") {
        activateButton(target.id);
        return;
    }

    if (target.type === "key") {
        collectKey();
        return;
    }

    if (target.type === "note") {
        collectNote(target);
        return;
    }

    if (target.type === "gate") {
        if (
            state.keyCollected &&
            !state.gateOpen
        ) {
            openGate();
        }
    }
}

/* ============================================================
   NOISE
   ============================================================ */

function createNoisePulse(position, strength) {
    state.noise = clamp(
        state.noise + strength,
        0,
        GAME_CONFIG.game.maximumNoise
    );

    if (
        seeker &&
        state.seekerActive
    ) {
        const distance =
            distanceXZ(
                seeker.position,
                position
            );

        if (
            distance <
            GAME_CONFIG.seeker.hearingRadius +
            strength
        ) {
            seekerAI.lastPlayerPosition.copy(
                position
            );

            seekerAI.investigateTimer = 6;

            state.seekerState =
                "investigate";
        }
    }
}

function updateNoiseUI() {
    if (!noiseContainer) {
        return;
    }

    const percentage =
        clamp(
            state.noise /
            GAME_CONFIG.game.maximumNoise,
            0,
            1
        ) * 100;

    noiseContainer.style.width =
        `${percentage}%`;
}

/* ============================================================
   SANITY
   ============================================================ */

function updateSanity(delta) {
    if (
        !state.running ||
        state.dead ||
        state.won
    ) {
        return;
    }

    let drain = 0;

    if (
        state.seekerActive &&
        seeker
    ) {
        const distance =
            distanceXZ(
                seeker.position,
                camera.position
            );

        if (distance < 18) {
            drain +=
                (18 - distance) *
                0.45;
        }
    }

    if (
        state.flashlightEnabled &&
        !state.flashlightOn
    ) {
        drain += 0.18;
    }

    state.sanity = clamp(
        state.sanity -
        drain * delta,
        0,
        100
    );

    if (sanityFill) {
        sanityFill.style.width =
            `${state.sanity}%`;
    }

    if (
        state.sanity <= 0
    ) {
        state.sanity = 25;
    }
}

/* ============================================================
   HIDE MODE
   ============================================================ */

function startHideMode() {
    if (state.hideMode) {
        return;
    }

    state.hideMode = true;
    state.hideRemaining = 8;

    showElement(hideTimer);

    setObjective("Stay hidden.");

    createNoisePulse(
        camera.position,
        2
    );
}

function updateHideMode(delta) {
    if (!state.hideMode) {
        return;
    }

    state.hideRemaining -= delta;

    if (hideTimerValue) {
        hideTimerValue.textContent =
            Math.ceil(
                Math.max(
                    0,
                    state.hideRemaining
                )
            );
    }

    if (
        state.hideRemaining <= 0
    ) {
        state.hideMode = false;

        hideElement(hideTimer);

        updateObjective();
    }
}

/* ============================================================
   DANGER EFFECTS
   ============================================================ */

function createDangerPulse() {
    if (!dangerWarning) {
        return;
    }

    showElement(dangerWarning);

    dangerWarning.classList.add(
        "danger-pulse"
    );

    setTimeout(() => {
        dangerWarning.classList.remove(
            "danger-pulse"
        );
    }, 1200);
}

function updateDangerUI() {
    if (
        !dangerWarning ||
        !seeker ||
        !state.seekerActive
    ) {
        return;
    }

    const distance =
        distanceXZ(
            seeker.position,
            camera.position
        );

    if (distance < 20) {
        showElement(dangerWarning);

        const intensity =
            clamp(
                (20 - distance) / 20,
                0,
                1
            );

        dangerWarning.style.opacity =
            String(
                0.25 +
                intensity * 0.75
            );
    } else {
        hideElement(dangerWarning);
    }
}

/* ============================================================
   TOASTS
   ============================================================ */

let toastTimer = null;

function showToast(message) {
    if (!noteToast) {
        return;
    }

    setText(
        noteToastText,
        message
    );

    showElement(noteToast);

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        hideElement(noteToast);
    }, 2400);
}

/* ============================================================
   DEATH
   ============================================================ */

function triggerDeath(reason = "You were caught.") {
    if (
        state.dead ||
        state.won
    ) {
        return;
    }

    state.dead = true;
    state.running = false;

    if (deathReason) {
        deathReason.textContent =
            reason;
    }

    hideElement(gameScreen);

    showElement(deathScreen);

    if (screamOverlay) {
        showElement(screamOverlay);

        screamOverlay.classList.add(
            "scream-active"
        );

        setTimeout(() => {
            screamOverlay.classList.remove(
                "scream-active"
            );

            hideElement(screamOverlay);
        }, 900);
    }

    playTone(
        90,
        0.55,
        "sawtooth"
    );
}

function triggerWin() {
    if (
        state.won ||
        state.dead
    ) {
        return;
    }

    state.won = true;
    state.running = false;

    hideElement(gameScreen);

    showElement(winScreen);

    if (winTitle) {
        winTitle.textContent =
            "YOU ESCAPED";
    }

    if (winText) {
        winText.textContent =
            "You made it out of the house.";
    }

    playTone(
        523,
        0.15,
        "sine"
    );

    setTimeout(() => {
        playTone(
            659,
            0.15,
            "sine"
        );
    }, 160);

    setTimeout(() => {
        playTone(
            784,
            0.3,
            "sine"
        );
    }, 320);
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

    state.paused = true;

    showElement(pauseScreen);

    releasePointerLock();
}

function resumeGame() {
    if (
        state.dead ||
        state.won
    ) {
        return;
    }

    state.paused = false;

    hideElement(pauseScreen);

    if (state.device === "pc") {
        requestPointerLock();
    }
}

function openNotesLog() {
    showElement(notesLogScreen);
    renderNotesLog();
}

function closeNotesLog() {
    hideElement(notesLogScreen);
}

/* ============================================================
   POINTER LOCK
   ============================================================ */

function requestPointerLock() {
    if (
        state.device !== "pc" ||
        !renderer ||
        !renderer.domElement
    ) {
        return;
    }

    if (
        document.pointerLockElement !==
        renderer.domElement
    ) {
        renderer.domElement.requestPointerLock?.();
    }
}

function releasePointerLock() {
    if (
        document.pointerLockElement
    ) {
        document.exitPointerLock?.();
    }
}

/* ============================================================
   MOUSE LOOK
   ============================================================ */

function handleMouseMove(event) {
    if (
        !state.running ||
        state.paused ||
        state.device !== "pc" ||
        !pointerLocked
    ) {
        return;
    }

    yaw -=
        event.movementX *
        mouse.sensitivity;

    pitch -=
        event.movementY *
        mouse.sensitivity;

    pitch = clamp(
        pitch,
        -Math.PI / 2 + 0.08,
        Math.PI / 2 - 0.08
    );

    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

/* ============================================================
   MOBILE LOOK
   ============================================================ */

function setupMobileLook() {
    if (!lookZone) {
        return;
    }

    lookZone.addEventListener(
        "pointerdown",
        (event) => {
            if (state.device !== "mobile") {
                return;
            }

            lookTouch.active = true;
            lookTouch.pointerId =
                event.pointerId;

            lookTouch.lastX =
                event.clientX;

            lookTouch.lastY =
                event.clientY;

            lookZone.setPointerCapture?.(
                event.pointerId
            );
        }
    );

    lookZone.addEventListener(
        "pointermove",
        (event) => {
            if (
                !lookTouch.active ||
                lookTouch.pointerId !==
                    event.pointerId
            ) {
                return;
            }

            const dx =
                event.clientX -
                lookTouch.lastX;

            const dy =
                event.clientY -
                lookTouch.lastY;

            lookTouch.lastX =
                event.clientX;

            lookTouch.lastY =
                event.clientY;

            yaw -= dx * 0.006;
            pitch -= dy * 0.006;

            pitch = clamp(
                pitch,
                -Math.PI / 2 + 0.08,
                Math.PI / 2 - 0.08
            );

            camera.rotation.y = yaw;
            camera.rotation.x = pitch;
        }
    );

    const endLook = () => {
        lookTouch.active = false;
        lookTouch.pointerId = null;
    };

    lookZone.addEventListener(
        "pointerup",
        endLook
    );

    lookZone.addEventListener(
        "pointercancel",
        endLook
    );
}

/* ============================================================
   MOBILE JOYSTICK
   ============================================================ */

function setupJoystick() {
    if (!joystickZone) {
        return;
    }

    joystickZone.addEventListener(
        "pointerdown",
        (event) => {
            if (state.device !== "mobile") {
                return;
            }

            joystick.active = true;
            joystick.pointerId =
                event.pointerId;

            const rect =
                joystickZone.getBoundingClientRect();

            joystick.startX =
                rect.left +
                rect.width / 2;

            joystick.startY =
                rect.top +
                rect.height / 2;

            updateJoystick(
                event.clientX,
                event.clientY
            );

            joystickZone.setPointerCapture?.(
                event.pointerId
            );
        }
    );

    joystickZone.addEventListener(
        "pointermove",
        (event) => {
            if (
                !joystick.active ||
                joystick.pointerId !==
                    event.pointerId
            ) {
                return;
            }

            updateJoystick(
                event.clientX,
                event.clientY
            );
        }
    );

    const endJoystick = () => {
        joystick.active = false;
        joystick.pointerId = null;
        joystick.x = 0;
        joystick.y = 0;

        if (joystickKnob) {
            joystickKnob.style.transform =
                "translate(-50%, -50%)";
        }
    };

    joystickZone.addEventListener(
        "pointerup",
        endJoystick
    );

    joystickZone.addEventListener(
        "pointercancel",
        endJoystick
    );
}

function updateJoystick(clientX, clientY) {
    let dx =
        clientX -
        joystick.startX;

    let dy =
        clientY -
        joystick.startY;

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    if (
        distance >
        joystick.maxDistance
    ) {
        const scale =
            joystick.maxDistance /
            distance;

        dx *= scale;
        dy *= scale;
    }

    joystick.x =
        clamp(
            dx /
                joystick.maxDistance,
            -1,
            1
        );

    joystick.y =
        clamp(
            -dy /
                joystick.maxDistance,
            -1,
            1
        );

    if (joystickKnob) {
        joystickKnob.style.transform =
            `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
}

/* ============================================================
   INPUT
   ============================================================ */

function setupKeyboard() {
    window.addEventListener(
        "keydown",
        (event) => {
            keys.add(event.code);

            if (
                event.code === "KeyE" ||
                event.code === "Enter"
            ) {
                interact();
            }

            if (
                event.code === "KeyF"
            ) {
                toggleFlashlight();
            }

            if (
                event.code === "KeyH"
            ) {
                startHideMode();
            }

            if (
                event.code === "Escape"
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
            }

            if (
                event.code === "KeyN"
            ) {
                if (state.running) {
                    openNotesLog();
                }
            }
        }
    );

    window.addEventListener(
        "keyup",
        (event) => {
            keys.delete(
                event.code
            );
        }
    );

    document.addEventListener(
        "mousemove",
        handleMouseMove
    );

    document.addEventListener(
        "pointerlockchange",
        () => {
            pointerLocked =
                document.pointerLockElement ===
                renderer?.domElement;
        }
    );
}

/* ============================================================
   MOBILE BUTTONS
   ============================================================ */

function setupMobileButtons() {
    mobileRun?.addEventListener(
        "pointerdown",
        () => {
            state.mobileRunning = true;
        }
    );

    mobileRun?.addEventListener(
        "pointerup",
        () => {
            state.mobileRunning = false;
        }
    );

    mobileRun?.addEventListener(
        "pointercancel",
        () => {
            state.mobileRunning = false;
        }
    );

    mobileInteract?.addEventListener(
        "click",
        () => {
            interact();
        }
    );

    mobileFlashlight?.addEventListener(
        "click",
        () => {
            toggleFlashlight();
        }
    );
}

/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */

function showMenu() {
    state.running = false;
    state.paused = false;
    state.dead = false;
    state.won = false;

    showElement(menuScreen);

    hideElement(instructionsScreen);
    hideElement(settingsScreen);
    hideElement(gameScreen);
    hideElement(pauseScreen);
    hideElement(notesLogScreen);
    hideElement(deathScreen);
    hideElement(winScreen);

    releasePointerLock();
}

function showInstructions() {
    hideElement(menuScreen);
    showElement(instructionsScreen);
}

function showSettings() {
    hideElement(menuScreen);
    showElement(settingsScreen);
}

function prepareGameScreen() {
    hideElement(menuScreen);
    hideElement(instructionsScreen);
    hideElement(settingsScreen);

    showElement(gameScreen);

    if (state.device === "mobile") {
        showElement(mobileControls);
    } else {
        hideElement(mobileControls);
    }
}

/* ============================================================
   GAME RESET
   ============================================================ */

function resetGameState() {
    state.running = false;
    state.paused = false;
    state.dead = false;
    state.won = false;

    state.elapsed = 0;

    state.preparationRemaining =
        GAME_CONFIG.game.preparationTime;

    state.sanity =
        GAME_CONFIG.game.startingSanity;

    state.noise = 0;

    state.keyCollected = false;
    state.gateOpen = false;

    state.notes = [];

    state.hideMode = false;
    state.hideRemaining = 0;

    state.seekerActive = false;
    state.seekerState = "waiting";

    state.footstepTimer = 0;

    state.buttons.forEach(
        (button) => {
            button.pressed = false;
        }
    );

    state.interactionTarget = null;

    seekerAI.pathTimer = 0;
    seekerAI.searchTimer = 0;
    seekerAI.investigateTimer = 0;
    seekerAI.hearingCooldown = 0;

    if (keyObject) {
        keyObject.visible = false;
    }

    if (seeker) {
        seeker.visible = false;
    }

    if (gate) {
        gate.children[0].position.x = -2.5;
        gate.children[1].position.x = 2.5;
    }

    if (gateLight) {
        gateLight.color.setHex(
            GAME_CONFIG.colors.red
        );

        gateLight.intensity = 1.2;
    }

    removeCollisionByName(
        "exit-gate"
    );

    addCollisionBox(
        0,
        2.75,
        -87,
        5.5,
        5.5,
        1,
        {
            name: "exit-gate"
        }
    );

    interactables.forEach(
        (item) => {
            item.used = false;
            item.object.visible = true;
        }
    );

    updateButtonUI();

    if (notesCountElement) {
        notesCountElement.textContent =
            "0/3";
    }

    if (sanityFill) {
        sanityFill.style.width =
            "100%";
    }

    if (noiseContainer) {
        noiseContainer.style.width =
            "0%";
    }

    hideElement(interactionElement);
    hideElement(hideTimer);
    hideElement(dangerWarning);
    hideElement(noteToast);
    hideElement(screamOverlay);

    resetPlayer();

    renderNotesLog();
}

/* ============================================================
   START GAME
   ============================================================ */

function startGame() {
    if (!renderer) {
        initializeGame();
    }

    resumeAudio();

    resetGameState();

    prepareGameScreen();

    state.running = true;

    updateObjective();

    updateTimerUI();

    if (state.device === "pc") {
        setTimeout(() => {
            requestPointerLock();
        }, 100);
    }

    if (state.device === "mobile") {
        showToast(
            "Touch controls enabled."
        );
    }

    playTone(
        180,
        0.2,
        "sine"
    );
}

/* ============================================================
   QUIT
   ============================================================ */

function quitToMenu() {
    state.running = false;

    releasePointerLock();

    showMenu();
}

/* ============================================================
   WIN CHECK
   ============================================================ */

function updateWinCheck() {
    if (
        !state.gateOpen ||
        !state.keyCollected
    ) {
        return;
    }

    const distance =
        distanceXZ(
            camera.position,
            new THREE.Vector3(
                0,
                0,
                -96
            )
        );

    if (distance < 5) {
        triggerWin();
    }
}

/* ============================================================
   PREPARATION TIMER
   ============================================================ */

function updatePreparationTimer(delta) {
    if (
        !state.running ||
        state.seekerActive
    ) {
        return;
    }

    state.preparationRemaining -=
        delta;

    if (
        state.preparationRemaining <= 0
    ) {
        state.preparationRemaining = 0;

        activateSeeker();
    }
}

/* ============================================================
   GAME TIMER
   ============================================================ */

function updateGameTimer(delta) {
    if (
        !state.running ||
        state.paused ||
        state.dead ||
        state.won
    ) {
        return;
    }

    if (state.seekerActive) {
        state.elapsed += delta;
    }

    updatePreparationTimer(delta);
    updateTimerUI();
}

/* ============================================================
   WORLD ANIMATION
   ============================================================ */

function animateWorld(delta) {
    const time =
        performance.now() * 0.001;

    for (const child of effectGroup.children) {
        if (
            child.userData &&
            child.userData.base
        ) {
            child.position.y =
                child.userData.base.y +
                Math.sin(
                    time * 2 +
                    child.userData.phase
                ) *
                0.12;
        }
    }

    if (keyObject?.visible) {
        keyObject.rotation.y +=
            delta * 1.7;

        keyObject.rotation.z =
            Math.sin(time * 2) *
            0.08;
    }
}

/* ============================================================
   MINIMAP
   ============================================================ */

let minimapCanvas = null;
let minimapContext = null;

function createMinimap() {
    const existing =
        document.getElementById(
            "seekerMinimap"
        );

    if (existing) {
        minimapCanvas = existing.querySelector(
            "canvas"
        );

        minimapContext =
            minimapCanvas?.getContext(
                "2d"
            );

        return;
    }

    const container =
        document.createElement("div");

    container.id =
        "seekerMinimap";

    container.innerHTML = `
        <div class="minimap-title">
            MAP
        </div>

        <canvas
            width="220"
            height="220"
            aria-label="Game minimap">
        </canvas>

        <div class="minimap-legend">
            <span>
                <i class="player-dot"></i>
                YOU
            </span>
            <span>
                <i class="seeker-dot"></i>
                SEEKER
            </span>
        </div>
    `;

    document.body.appendChild(
        container
    );

    minimapCanvas =
        container.querySelector(
            "canvas"
        );

    minimapContext =
        minimapCanvas.getContext(
            "2d"
        );
}

function worldToMap(x, z) {
    const size =
        GAME_CONFIG.world.floorSize;

    const width =
        minimapCanvas.width;

    const height =
        minimapCanvas.height;

    return {
        x:
            ((x + size / 2) / size) *
            width,

        y:
            ((z + size / 2) / size) *
            height
    };
}

function drawArrow(
    context,
    x,
    y,
    angle,
    color,
    size
) {
    context.save();

    context.translate(
        x,
        y
    );

    context.rotate(
        angle
    );

    context.beginPath();

    context.moveTo(
        0,
        -size
    );

    context.lineTo(
        size * 0.7,
        size
    );

    context.lineTo(
        0,
        size * 0.45
    );

    context.lineTo(
        -size * 0.7,
        size
    );

    context.closePath();

    context.fillStyle =
        color;

    context.fill();

    context.restore();
}

function drawMinimap() {
    if (
        !minimapContext ||
        !minimapCanvas ||
        !camera
    ) {
        return;
    }

    const context =
        minimapContext;

    const width =
        minimapCanvas.width;

    const height =
        minimapCanvas.height;

    context.clearRect(
        0,
        0,
        width,
        height
    );

    context.fillStyle =
        "#050505";

    context.fillRect(
        0,
        0,
        width,
        height
    );

    /*
       House outline.
    */

    context.strokeStyle =
        "#383838";

    context.lineWidth = 2;

    context.strokeRect(
        4,
        4,
        width - 8,
        height - 8
    );

    /*
       Interior wall representation.
    */

    const drawWallLine = (
        x1,
        z1,
        x2,
        z2
    ) => {
        const a =
            worldToMap(
                x1,
                z1
            );

        const b =
            worldToMap(
                x2,
                z2
            );

        context.beginPath();

        context.moveTo(
            a.x,
            a.y
        );

        context.lineTo(
            b.x,
            b.y
        );

        context.stroke();
    };

    context.strokeStyle =
        "#242424";

    context.lineWidth = 2;

    drawWallLine(
        -30,
        -80,
        -30,
        -32
    );

    drawWallLine(
        30,
        -80,
        30,
        -32
    );

    drawWallLine(
        -30,
        32,
        -30,
        80
    );

    drawWallLine(
        30,
        32,
        30,
        80
    );

    drawWallLine(
        -80,
        -18,
        -30,
        -18
    );

    drawWallLine(
        30,
        -18,
        80,
        -18
    );

    drawWallLine(
        -80,
        18,
        -30,
        18
    );

    drawWallLine(
        30,
        18,
        80,
        18
    );

    /*
       Buttons.
    */

    state.buttons.forEach(
        (button) => {
            const p =
                worldToMap(
                    button.position.x,
                    button.position.z
                );

            context.beginPath();

            context.arc(
                p.x,
                p.y,
                4,
                0,
                Math.PI * 2
            );

            context.fillStyle =
                button.pressed
                    ? "#2a8a4a"
                    : "#b33030";

            context.fill();
        }
    );

    /*
       Key.
    */

    if (
        keyObject &&
        keyObject.visible
    ) {
        const p =
            worldToMap(
                keyObject.position.x,
                keyObject.position.z
            );

        context.beginPath();

        context.arc(
            p.x,
            p.y,
            4,
            0,
            Math.PI * 2
        );

        context.fillStyle =
            "#c9a227";

        context.fill();
    }

    /*
       Exit.
    */

    const exit =
        worldToMap(
            0,
            -87
        );

    context.fillStyle =
        state.gateOpen
            ? "#2a8a4a"
            : "#b33030";

    context.fillRect(
        exit.x - 7,
        exit.y - 3,
        14,
        6
    );

    /*
       Seeker.
    */

    if (
        seeker &&
        state.seekerActive
    ) {
        const p =
            worldToMap(
                seeker.position.x,
                seeker.position.z
            );

        drawArrow(
            context,
            p.x,
            p.y,
            seeker.rotation.y,
            "#d52f2f",
            7
        );
    }

    /*
       Player.
    */

    const playerMap =
        worldToMap(
            camera.position.x,
            camera.position.z
        );

    drawArrow(
        context,
        playerMap.x,
        playerMap.y,
        yaw,
        "#ffffff",
        7
    );
}

/* ============================================================
   RESIZE
   ============================================================ */

function handleResize() {
    if (!camera || !renderer) {
        return;
    }

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            GAME_CONFIG.graphics.pixelRatioLimit
        )
    );
}

/* ============================================================
   SETTINGS
   ============================================================ */

function setupSettings() {
    $("flashlightSetting")?.addEventListener(
        "click",
        () => {
            state.flashlightEnabled =
                !state.flashlightEnabled;

            updateFlashlight();
        }
    );

    $("footstepSetting")?.addEventListener(
        "click",
        () => {
            state.footstepsEnabled =
                !state.footstepsEnabled;
        }
    );

    $("volumeSetting")?.addEventListener(
        "input",
        (event) => {
            state.volume =
                clamp(
                    Number(
                        event.target.value
                    ) || 0,
                    0,
                    1
                );

            if (masterGain) {
                masterGain.gain.value =
                    state.volume;
            }
        }
    );
}

/* ============================================================
   MENU EVENTS
   ============================================================ */

function setupMenuEvents() {
    playButton?.addEventListener(
        "click",
        () => {
            resumeAudio();
            createDeviceSelection();
        }
    );

    instructionsButton?.addEventListener(
        "click",
        () => {
            showInstructions();
        }
    );

    settingsButton?.addEventListener(
        "click",
        () => {
            showSettings();
        }
    );

    instructionsBack?.addEventListener(
        "click",
        () => {
            showMenu();
        }
    );

    settingsBack?.addEventListener(
        "click",
        () => {
            showMenu();
        }
    );

    resumeButton?.addEventListener(
        "click",
        () => {
            resumeGame();
        }
    );

    notesLogButton?.addEventListener(
        "click",
        () => {
            openNotesLog();
        }
    );

    quitButton?.addEventListener(
        "click",
        () => {
            quitToMenu();
        }
    );

    notesLogBack?.addEventListener(
        "click",
        () => {
            closeNotesLog();
        }
    );

    retryButton?.addEventListener(
        "click",
        () => {
            hideElement(deathScreen);
            startGame();
        }
    );

    deathMenuButton?.addEventListener(
        "click",
        () => {
            showMenu();
        }
    );

    winAgainButton?.addEventListener(
        "click",
        () => {
            hideElement(winScreen);
            startGame();
        }
    );

    winMenuButton?.addEventListener(
        "click",
        () => {
            showMenu();
        }
    );
}

/* ============================================================
   WORLD BUILD
   ============================================================ */

function buildWorld() {
    createFloor();

    buildOuterWalls();

    buildMainRooms();

    createFurniture();

    createWindows();

    createHouseLights();

    createGate();

    createButtons();

    createNotes();

    createSeeker();

    createKey();

    createMinimap();
}

/* ============================================================
   INITIALIZE
   ============================================================ */

function initializeGame() {
    if (state.initialized) {
        return;
    }

    try {
        createRenderer();
        createScene();
        createCamera();
        createLighting();

        buildWorld();

        setupKeyboard();
        setupJoystick();
        setupMobileLook();
        setupMobileButtons();

        setupMenuEvents();
        setupSettings();

        window.addEventListener(
            "resize",
            handleResize
        );

        resetGameState();

        state.initialized = true;

        console.log(
            "[THE SEEKER] Game initialized successfully."
        );

        console.log(
            "[THE SEEKER] Device:",
            state.device
        );

        requestAnimationFrame(
            gameLoop
        );
    } catch (error) {
        console.error(
            "[THE SEEKER] Initialization error:",
            error
        );

        showInitializationError(
            error
        );
    }
}

/* ============================================================
   INITIALIZATION ERROR
   ============================================================ */

function showInitializationError(error) {
    const loadError =
        $("loadError");

    if (!loadError) {
        return;
    }

    const box =
        loadError.querySelector(
            ".box"
        );

    if (box) {
        box.innerHTML = `
            <strong>
                The game could not initialize.
            </strong>
            <br>
            <span>
                ${escapeHTML(
                    error?.message ||
                    "Unknown error."
                )}
            </span>
            <br><br>
            <small>
                Check the browser console for details.
            </small>
        `;
    }

    hideElement(menuScreen);
    showElement(loadError);
}

/* ============================================================
   MAIN LOOP
   ============================================================ */

function gameLoop(now) {
    requestAnimationFrame(
        gameLoop
    );

    const rawDelta =
        (now - state.lastFrame) /
        1000;

    state.lastFrame = now;

    const delta =
        clamp(
            rawDelta,
            0,
            0.05
        );

    state.fps =
        lerp(
            state.fps,
            1 / Math.max(delta, 0.001),
            0.08
        );

    if (
        renderer &&
        scene &&
        camera
    ) {
        if (
            state.running &&
            !state.paused &&
            !state.dead &&
            !state.won
        ) {
            updateGameTimer(delta);
            updatePlayer(delta);
            updateSeeker(delta);
            updateSanity(delta);
            updateHideMode(delta);
            updateInteraction();
            updateDangerUI();
            updateWinCheck();
        }

        updateFlashlight();
        animateWorld(delta);
        drawMinimap();

        renderer.render(
            scene,
            camera
        );
    }
}

/* ============================================================
   EXTRA ENVIRONMENT DETAILS
   ============================================================ */

function addWallDecorations() {
    const signs = [
        {
            x: -88.4,
            y: 3.3,
            z: -60,
            rotation: Math.PI / 2,
            text: "WEST"
        },
        {
            x: 88.4,
            y: 3.3,
            z: 60,
            rotation: -Math.PI / 2,
            text: "EAST"
        }
    ];

    signs.forEach((sign) => {
        const panel =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    2.5,
                    0.8,
                    0.1
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x151515,
                    roughness: 0.9
                })
            );

        panel.position.set(
            sign.x,
            sign.y,
            sign.z
        );

        panel.rotation.y =
            sign.rotation;

        environmentGroup.add(panel);
    });
}

/* ============================================================
   DYNAMIC ATMOSPHERE
   ============================================================ */

let atmosphereTimer = 0;

function updateAtmosphere(delta) {
    atmosphereTimer += delta;

    if (
        atmosphereTimer <
        4
    ) {
        return;
    }

    atmosphereTimer = 0;

    if (
        !state.running ||
        state.paused ||
        state.dead ||
        state.won
    ) {
        return;
    }

    const chance =
        Math.random();

    if (
        chance < 0.25
    ) {
        flickerLights();
    }

    if (
        chance < 0.08 &&
        state.seekerActive
    ) {
        createDangerPulse();
    }
}

function flickerLights() {
    environmentGroup.traverse(
        (object) => {
            if (
                object.isPointLight &&
                Math.random() < 0.25
            ) {
                const original =
                    object.intensity;

                object.intensity *=
                    random(
                        0.2,
                        0.75
                    );

                setTimeout(() => {
                    object.intensity =
                        original;
                }, randomInt(50, 180));
            }
        }
    );
}

/* ============================================================
   HIDDEN SECONDARY SYSTEM
   ============================================================ */

const worldSystems = {
    footprints: [],
    particles: [],
    doors: [],
    lights: [],
    ambientEvents: [],
    triggers: []
};

function registerWorldTrigger(
    name,
    position,
    radius,
    callback
) {
    worldSystems.triggers.push({
        name,
        position:
            position.clone(),
        radius,
        callback,
        fired: false
    });
}

function updateWorldTriggers() {
    for (
        const trigger
        of worldSystems.triggers
    ) {
        if (
            trigger.fired ||
            !camera
        ) {
            continue;
        }

        const distance =
            distanceXZ(
                camera.position,
                trigger.position
            );

        if (
            distance <=
            trigger.radius
        ) {
            trigger.fired = true;

            try {
                trigger.callback();
            } catch (error) {
                console.warn(
                    "[THE SEEKER] Trigger error:",
                    error
                );
            }
        }
    }
}

/* ============================================================
   EXTRA INTERACTION: EXIT
   ============================================================ */

function registerExitInteraction() {
    interactables.push({
        type: "gate",
        object: gate,
        position: new THREE.Vector3(
            0,
            0,
            -87
        ),
        label: "Exit Gate",
        used: false
    });
}

/* ============================================================
   OVERRIDE INTERACTION TARGET FOR GATE
   ============================================================ */

function findGateTarget() {
    if (
        !gate ||
        state.gateOpen
    ) {
        return null;
    }

    const gatePosition =
        new THREE.Vector3(
            0,
            0,
            -87
        );

    const distance =
        distanceXZ(
            camera.position,
            gatePosition
        );

    if (
        distance >
        GAME_CONFIG.game.interactionDistance
    ) {
        return null;
    }

    return {
        type: "gate",
        object: gate,
        position: gatePosition,
        label: "Exit Gate",
        used: false
    };
}

/* ============================================================
   INTERACTION PATCH
   ============================================================ */

const originalFindInteractionTarget =
    findInteractionTarget;

function findInteractionTargetExtended() {
    const normalTarget =
        originalFindInteractionTarget();

    if (normalTarget) {
        return normalTarget;
    }

    return findGateTarget();
}

/* ============================================================
   GAME STATE API
   ============================================================ */

window.TheSeeker = {
    state,

    start() {
        startGame();
    },

    pause() {
        pauseGame();
    },

    resume() {
        resumeGame();
    },

    quit() {
        quitToMenu();
    },

    interact() {
        interact();
    },

    toggleFlashlight() {
        toggleFlashlight();
    },

    activateButton(id) {
        activateButton(
            Number(id)
        );
    },

    collectKey() {
        collectKey();
    },

    openGate() {
        if (
            state.keyCollected
        ) {
            openGate();
        }
    },

    getPlayerPosition() {
        return camera
            ? camera.position.clone()
            : null;
    },

    getSeekerPosition() {
        return seeker
            ? seeker.position.clone()
            : null;
    }
};

/* ============================================================
   SAFE INITIALIZATION
   ============================================================ */

window.addEventListener(
    "error",
    (event) => {
        if (
            event?.error &&
            String(
                event.error.message || ""
            ).includes(
                "setObjective"
            )
        ) {
            console.error(
                "[THE SEEKER] Objective system recovered."
            );
        }
    }
);

/* ============================================================
   PATCH GLOBAL INTERACTION FUNCTION
   ============================================================ */

function refreshInteractionTarget() {
    const target =
        findInteractionTargetExtended();

    state.interactionTarget =
        target;

    if (!interactionElement) {
        return;
    }

    if (!target) {
        hideElement(
            interactionElement
        );

        return;
    }

    showElement(
        interactionElement
    );

    let text =
        "INTERACT";

    if (
        target.type ===
        "button"
    ) {
        text =
            `PRESS BUTTON ${target.id}`;
    }

    if (
        target.type ===
        "key"
    ) {
        text =
            "PICK UP KEY";
    }

    if (
        target.type ===
        "note"
    ) {
        text =
            "READ NOTE";
    }

    if (
        target.type ===
        "gate"
    ) {
        text =
            state.keyCollected
                ? "OPEN GATE"
                : "GATE LOCKED";
    }

    setText(
        interactionText,
        text
    );
}

/* ============================================================
   REPLACE INTERACTION UPDATE BEHAVIOR
   ============================================================ */

const originalUpdateInteraction =
    updateInteraction;

function updateInteractionExtended() {
    refreshInteractionTarget();
}

/* ============================================================
   FINAL LOOP SYSTEM HOOKS
   ============================================================ */

const originalGameLoopSystems =
    {
        atmosphere: updateAtmosphere,
        triggers: updateWorldTriggers,
        interaction: updateInteractionExtended
    };

/* ============================================================
   DEBUG UTILITIES
   ============================================================ */

window.TheSeekerDebug = {
    getState() {
        return {
            ...state,
            playerPosition:
                camera
                    ? camera.position.toArray()
                    : null,
            seekerPosition:
                seeker
                    ? seeker.position.toArray()
                    : null
        };
    },

    activateSeeker() {
        activateSeeker();
    },

    setSanity(value) {
        state.sanity =
            clamp(
                Number(value),
                0,
                100
            );
    },

    setNoise(value) {
        state.noise =
            clamp(
                Number(value),
                0,
                100
            );
    },

    setObjective(text) {
        setObjective(text);
    }
};

/* ============================================================
   STARTUP
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        initializeGame();
    }
);

if (
    document.readyState ===
    "interactive" ||
    document.readyState ===
    "complete"
) {
    initializeGame();
}

/* ============================================================
   FINAL SAFETY FALLBACK
   ============================================================ */

if (
    typeof window.setObjective !==
    "function"
) {
    window.setObjective =
        setObjective;
}

/* ============================================================
   END OF THE SEEKER GAME ENGINE
   ============================================================ */