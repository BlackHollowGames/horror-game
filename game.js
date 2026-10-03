/* ============================================================
   THE SEEKER
   BlackHollow Games
   Created by Stive Pierre

   Complete browser game runtime.
   ============================================================ */

import * as THREE from "three";

/* ============================================================
   GLOBAL STATE
   ============================================================ */

const Game = {
    running: false,
    paused: false,
    dead: false,
    won: false,

    renderer: null,
    scene: null,
    camera: null,

    clock: new THREE.Clock(),

    player: null,
    seeker: null,

    world: null,
    walls: [],
    doors: [],
    buttons: [],
    notes: [],
    decorations: [],
    lights: [],

    keys: new Set(),

    device: "pc",

    playerSpeed: 4.6,
    runSpeed: 7.2,

    playerHeight: 1.7,
    playerRadius: 0.35,

    playerHealth: 100,
    sanity: 100,
    noise: 0,

    seekerSpeed: 2.4,
    seekerChaseSpeed: 3.65,
    seekerAlertSpeed: 4.4,

    seekerAwake: false,
    seekerAlerted: false,
    seekerTargetVisible: false,

    elapsed: 0,
    remaining: 180,

    hideTime: 0,

    buttonsPressed: 0,
    keyCollected: false,
    gateUnlocked: false,

    notesCollected: 0,

    objective: "",

    flashlight: true,
    flashlightBattery: 100,

    footstepsEnabled: true,
    masterVolume: 0.7,

    interactionTarget: null,

    lastFootstep: 0,
    lastSeekerSound: 0,
    lastAmbient: 0,

    audioContext: null,

    playerVelocity: new THREE.Vector3(),
    seekerVelocity: new THREE.Vector3(),

    playerDirection: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),

    raycaster: new THREE.Raycaster(),

    minimapCanvas: null,
    minimapContext: null,

    cameraYaw: 0,
    cameraPitch: -0.18,

    mouseLocked: false,
    mouseX: 0,
    mouseY: 0,

    joystickX: 0,
    joystickY: 0,

    touchLookX: 0,
    touchLookY: 0,

    spawn: new THREE.Vector3(0, 0, 8),
    exitPosition: new THREE.Vector3(0, 0, -78),

    houseSize: 150,

    textures: {},

    tmp: {
        a: new THREE.Vector3(),
        b: new THREE.Vector3(),
        c: new THREE.Vector3(),
        d: new THREE.Vector3(),
        e: new THREE.Vector3(),
        f: new THREE.Vector3()
    }
};

/* ============================================================
   DOM HELPERS
   ============================================================ */

const $ = id => document.getElementById(id);

function show(element) {
    if (element) {
        element.classList.remove("hidden");
    }
}

function hide(element) {
    if (element) {
        element.classList.add("hidden");
    }
}

function setText(id, value) {
    const element = $(id);
    if (element) {
        element.textContent = String(value);
    }
}

function setObjective(text) {
    Game.objective = text || "";

    const element = $("objective");

    if (element) {
        element.textContent = Game.objective;
    }
}

function setNotesCount(value) {
    Game.notesCollected = Math.max(0, value);

    const element = $("notesCount");

    if (element) {
        element.textContent = String(Game.notesCollected);
    }
}

function setTimer(value) {
    const seconds = Math.max(0, Math.ceil(value));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;

    setText(
        "timer",
        `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    );
}

function setButtonState(index, state) {
    const element = $(`button${index}`);

    if (!element) {
        return;
    }

    element.textContent = state;

    element.classList.remove(
        "active",
        "complete",
        "pressed",
        "found"
    );

    if (
        state === "ACTIVE" ||
        state === "FOUND"
    ) {
        element.classList.add("active");
    }

    if (
        state === "PRESSED" ||
        state === "COMPLETE"
    ) {
        element.classList.add("complete");
    }
}

function setSanity(value) {
    Game.sanity = THREE.MathUtils.clamp(value, 0, 100);

    const fill = $("sanityFill");

    if (fill) {
        fill.style.width = `${Game.sanity}%`;
    }
}

function setNoise(value) {
    Game.noise = THREE.MathUtils.clamp(value, 0, 100);

    const fill = $("noiseFill");

    if (fill) {
        fill.style.width = `${Game.noise}%`;
    }
}

function setInteraction(text) {
    const interaction = $("interaction");
    const interactionText = $("interactionText");

    if (!interaction || !interactionText) {
        return;
    }

    if (text) {
        interactionText.textContent = text;
        show(interaction);
    } else {
        hide(interaction);
    }
}

/* ============================================================
   SAFE SCREEN MANAGEMENT
   ============================================================ */

function showMenu() {
    Game.running = false;
    Game.paused = false;

    hide($("gameScreen"));
    hide($("pauseScreen"));
    hide($("deathScreen"));
    hide($("winScreen"));
    hide($("notesLogScreen"));

    show($("menuScreen"));
}

function showGame() {
    hide($("menuScreen"));
    hide($("instructionsScreen"));
    hide($("settingsScreen"));

    show($("gameScreen"));
}

function showDeath(reason) {
    Game.running = false;
    Game.dead = true;

    setText(
        "deathReason",
        reason || "The Seeker found you."
    );

    hide($("gameScreen"));
    hide($("pauseScreen"));
    show($("deathScreen"));
}

function showWin() {
    Game.running = false;
    Game.won = true;

    setText(
        "winTitle",
        "YOU ESCAPED"
    );

    setText(
        "winText",
        "You unlocked the gate and escaped the house."
    );

    hide($("gameScreen"));
    hide($("pauseScreen"));
    show($("winScreen"));
}

/* ============================================================
   AUDIO
   ============================================================ */

function initializeAudio() {
    try {
        if (!Game.audioContext) {
            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            if (AudioContext) {
                Game.audioContext = new AudioContext();
            }
        }

        if (
            Game.audioContext &&
            Game.audioContext.state === "suspended"
        ) {
            Game.audioContext.resume().catch(() => {});
        }
    } catch {
        Game.audioContext = null;
    }
}

function tone(
    frequency = 440,
    duration = 0.08,
    type = "sine",
    volume = 0.04
) {
    if (!Game.audioContext) {
        return;
    }

    try {
        const oscillator =
            Game.audioContext.createOscillator();

        const gain =
            Game.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(
            0.0001,
            Game.audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, volume * Game.masterVolume),
            Game.audioContext.currentTime + 0.01
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            Game.audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(Game.audioContext.destination);

        oscillator.start();

        oscillator.stop(
            Game.audioContext.currentTime + duration + 0.02
        );
    } catch {
        /* Audio is optional. */
    }
}

function playButtonSound() {
    tone(330, 0.07, "square", 0.035);
    setTimeout(() => {
        tone(495, 0.1, "square", 0.025);
    }, 65);
}

function playPickupSound() {
    tone(520, 0.07, "sine", 0.035);

    setTimeout(() => {
        tone(780, 0.12, "sine", 0.035);
    }, 70);
}

function playGateSound() {
    tone(120, 0.25, "sawtooth", 0.025);

    setTimeout(() => {
        tone(180, 0.35, "sine", 0.025);
    }, 220);
}

function playFootstep() {
    if (!Game.footstepsEnabled) {
        return;
    }

    if (!Game.audioContext) {
        return;
    }

    const now = performance.now();

    if (now - Game.lastFootstep < 300) {
        return;
    }

    Game.lastFootstep = now;

    tone(
        65 + Math.random() * 20,
        0.045,
        "triangle",
        0.025
    );
}

function playSeekerPulse() {
    const now = performance.now();

    if (now - Game.lastSeekerSound < 1800) {
        return;
    }

    Game.lastSeekerSound = now;

    tone(52, 0.25, "sine", 0.025);

    setTimeout(() => {
        tone(38, 0.4, "sine", 0.02);
    }, 100);
}

/* ============================================================
   BUTTON EVENTS
   ============================================================ */

function bindButton(id, handler) {
    const element = $(id);

    if (!element) {
        return;
    }

    element.addEventListener("click", event => {
        event.preventDefault();

        initializeAudio();

        try {
            handler(event);
        } catch (error) {
            console.error(error);
        }
    });
}

function bindInterface() {
    bindButton("playButton", () => {
        startGame();
    });

    bindButton("instructionsButton", () => {
        hide($("menuScreen"));
        show($("instructionsScreen"));
    });

    bindButton("settingsButton", () => {
        hide($("menuScreen"));
        show($("settingsScreen"));
    });

    bindButton("instructionsBack", () => {
        hide($("instructionsScreen"));
        show($("menuScreen"));
    });

    bindButton("settingsBack", () => {
        hide($("settingsScreen"));
        show($("menuScreen"));
    });

    bindButton("resumeButton", () => {
        resumeGame();
    });

    bindButton("notesLogButton", () => {
        showNotesLog();
    });

    bindButton("quitButton", () => {
        showMenu();
    });

    bindButton("notesLogBack", () => {
        hide($("notesLogScreen"));
        show($("pauseScreen"));
    });

    bindButton("retryButton", () => {
        startGame();
    });

    bindButton("deathMenuButton", () => {
        showMenu();
    });

    bindButton("winAgainButton", () => {
        startGame();
    });

    bindButton("winMenuButton", () => {
        showMenu();
    });

    bindButton("mobileRun", () => {
        Game.keys.add("Shift");
    });

    bindButton("mobileInteract", () => {
        interact();
    });

    bindButton("mobileFlashlight", () => {
        toggleFlashlight();
    });

    const flashlightSetting = $("flashlightSetting");

    if (flashlightSetting) {
        flashlightSetting.addEventListener("change", () => {
            Game.flashlight =
                flashlightSetting.value !== "off";
        });
    }

    const footstepSetting = $("footstepSetting");

    if (footstepSetting) {
        footstepSetting.addEventListener("change", () => {
            Game.footstepsEnabled =
                footstepSetting.value !== "off";
        });
    }

    const volumeSetting = $("volumeSetting");

    if (volumeSetting) {
        volumeSetting.addEventListener("input", () => {
            const value = Number(volumeSetting.value);

            if (Number.isFinite(value)) {
                Game.masterVolume =
                    THREE.MathUtils.clamp(value, 0, 1);
            }
        });
    }
}

/* ============================================================
   KEYBOARD
   ============================================================ */

function bindKeyboard() {
    window.addEventListener("keydown", event => {
        Game.keys.add(event.code);

        if (
            event.code === "Space" ||
            event.code === "ArrowUp" ||
            event.code === "ArrowDown" ||
            event.code === "ArrowLeft" ||
            event.code === "ArrowRight"
        ) {
            event.preventDefault();
        }

        if (event.code === "Escape") {
            togglePause();
        }

        if (event.code === "KeyE") {
            interact();
        }

        if (event.code === "KeyF") {
            toggleFlashlight();
        }

        if (event.code === "KeyN") {
            if (Game.running) {
                showNotesLog();
            }
        }
    });

    window.addEventListener("keyup", event => {
        Game.keys.delete(event.code);
    });

    window.addEventListener("blur", () => {
        Game.keys.clear();
    });
}

/* ============================================================
   MOUSE LOOK
   ============================================================ */

function bindMouse() {
    const canvas = $("gameCanvas");

    if (!canvas) {
        return;
    }

    canvas.addEventListener("click", () => {
        if (!Game.running || Game.paused) {
            return;
        }

        if (Game.device === "pc") {
            if (canvas.requestPointerLock) {
                canvas.requestPointerLock().catch?.(() => {});
            }
        }
    });

    document.addEventListener("pointerlockchange", () => {
        Game.mouseLocked =
            document.pointerLockElement === canvas;
    });

    document.addEventListener("mousemove", event => {
        if (!Game.mouseLocked || !Game.running) {
            return;
        }

        Game.cameraYaw -= event.movementX * 0.0022;
        Game.cameraPitch -= event.movementY * 0.0018;

        Game.cameraPitch =
            THREE.MathUtils.clamp(
                Game.cameraPitch,
                -1.15,
                1.15
            );
    });
}

/* ============================================================
   TOUCH
   ============================================================ */

function bindTouch() {
    const lookZone = $("lookZone");

    if (!lookZone) {
        return;
    }

    let lastX = 0;
    let lastY = 0;
    let active = false;

    lookZone.addEventListener(
        "pointerdown",
        event => {
            active = true;
            lastX = event.clientX;
            lastY = event.clientY;

            try {
                lookZone.setPointerCapture(event.pointerId);
            } catch {}
        }
    );

    lookZone.addEventListener(
        "pointermove",
        event => {
            if (!active || !Game.running) {
                return;
            }

            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;

            lastX = event.clientX;
            lastY = event.clientY;

            Game.cameraYaw -= dx * 0.006;
            Game.cameraPitch -= dy * 0.004;

            Game.cameraPitch =
                THREE.MathUtils.clamp(
                    Game.cameraPitch,
                    -1.15,
                    1.15
                );
        }
    );

    lookZone.addEventListener(
        "pointerup",
        () => {
            active = false;
        }
    );

    lookZone.addEventListener(
        "pointercancel",
        () => {
            active = false;
        }
    );

    const joystick =
        $("joystickZone");

    const knob =
        $("joystickKnob");

    if (!joystick || !knob) {
        return;
    }

    let joystickActive = false;

    joystick.addEventListener(
        "pointerdown",
        event => {
            joystickActive = true;

            try {
                joystick.setPointerCapture(
                    event.pointerId
                );
            } catch {}

            updateJoystick(
                event.clientX,
                event.clientY,
                joystick,
                knob
            );
        }
    );

    joystick.addEventListener(
        "pointermove",
        event => {
            if (!joystickActive) {
                return;
            }

            updateJoystick(
                event.clientX,
                event.clientY,
                joystick,
                knob
            );
        }
    );

    const stopJoystick = () => {
        joystickActive = false;

        Game.joystickX = 0;
        Game.joystickY = 0;

        knob.style.transform =
            "translate(-50%, -50%)";
    };

    joystick.addEventListener(
        "pointerup",
        stopJoystick
    );

    joystick.addEventListener(
        "pointercancel",
        stopJoystick
    );
}

function updateJoystick(
    x,
    y,
    zone,
    knob
) {
    const rect =
        zone.getBoundingClientRect();

    const centerX =
        rect.left + rect.width / 2;

    const centerY =
        rect.top + rect.height / 2;

    let dx = x - centerX;
    let dy = y - centerY;

    const radius =
        Math.min(rect.width, rect.height) * 0.34;

    const distance =
        Math.sqrt(dx * dx + dy * dy);

    if (distance > radius) {
        dx =
            dx / Math.max(distance, 1) *
            radius;

        dy =
            dy / Math.max(distance, 1) *
            radius;
    }

    Game.joystickX =
        THREE.MathUtils.clamp(
            dx / radius,
            -1,
            1
        );

    Game.joystickY =
        THREE.MathUtils.clamp(
            dy / radius,
            -1,
            1
        );

    knob.style.transform =
        `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

/* ============================================================
   RENDERER
   ============================================================ */

function createRenderer() {
    let canvas = $("gameCanvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
        canvas =
            document.createElement("canvas");

        canvas.id = "gameCanvas";

        const gameScreen =
            $("gameScreen");

        if (gameScreen) {
            gameScreen.prepend(canvas);
        } else {
            document.body.appendChild(canvas);
        }
    }

    try {
        Game.renderer =
            new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: false,
                powerPreference: "high-performance"
            });
    } catch (error) {
        console.error(
            "Three.js renderer could not start.",
            error
        );

        return false;
    }

    Game.renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );

    Game.renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    Game.renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    Game.renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    Game.renderer.toneMappingExposure = 0.72;

    return true;
}

/* ============================================================
   SCENE
   ============================================================ */

function createScene() {
    Game.scene =
        new THREE.Scene();

    Game.scene.background =
        new THREE.Color(0x020202);

    Game.scene.fog =
        new THREE.FogExp2(
            0x050505,
            0.018
        );
}

function createCamera() {
    Game.camera =
        new THREE.PerspectiveCamera(
            72,
            window.innerWidth /
            Math.max(1, window.innerHeight),
            0.05,
            500
        );

    Game.camera.position.set(
        Game.spawn.x,
        Game.spawn.y + Game.playerHeight,
        Game.spawn.z
    );

    Game.camera.rotation.order =
        "YXZ";
}

/* ============================================================
   LIGHTING
   ============================================================ */

function createLighting() {
    const ambient =
        new THREE.HemisphereLight(
            0x667080,
            0x080808,
            0.36
        );

    Game.scene.add(ambient);

    const moon =
        new THREE.DirectionalLight(
            0x8794aa,
            0.18
        );

    moon.position.set(
        -40,
        70,
        20
    );

    Game.scene.add(moon);

    const emergency =
        new THREE.PointLight(
            0x552222,
            0.5,
            35
        );

    emergency.position.set(
        20,
        3,
        -20
    );

    Game.scene.add(emergency);

    Game.lights.push(
        ambient,
        moon,
        emergency
    );
}

/* ============================================================
   MATERIALS
   ============================================================ */

function material(
    color,
    roughness = 0.8,
    metalness = 0
) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness
    });
}

const Materials = {
    floor: material(
        0x181818,
        0.95
    ),

    wall: material(
        0x242424,
        0.92
    ),

    wallDark: material(
        0x111111,
        0.95
    ),

    wood: material(
        0x2a211b,
        0.9
    ),

    metal: material(
        0x3c3c3c,
        0.58,
        0.5
    ),

    red: material(
        0x701818,
        0.7
    ),

    button: material(
        0x8b1e1e,
        0.55
    ),

    buttonPressed: material(
        0x287e43,
        0.5
    ),

    paper: material(
        0xd7d1bb,
        0.9
    ),

    gate: material(
        0x161616,
        0.5,
        0.8
    )
};

/* ============================================================
   GEOMETRY HELPERS
   ============================================================ */

function addBox(
    x,
    y,
    z,
    width,
    height,
    depth,
    mat,
    options = {}
) {
    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );

    const mesh =
        new THREE.Mesh(
            geometry,
            mat
        );

    mesh.position.set(
        x,
        y,
        z
    );

    if (options.rotationY) {
        mesh.rotation.y =
            options.rotationY;
    }

    mesh.castShadow = false;
    mesh.receiveShadow = true;

    Game.scene.add(mesh);

    if (options.wall) {
        Game.walls.push({
            mesh,
            minX: x - width / 2,
            maxX: x + width / 2,
            minZ: z - depth / 2,
            maxZ: z + depth / 2
        });
    }

    return mesh;
}

function addCylinder(
    x,
    y,
    z,
    radius,
    height,
    mat
) {
    const geometry =
        new THREE.CylinderGeometry(
            radius,
            radius,
            height,
            12
        );

    const mesh =
        new THREE.Mesh(
            geometry,
            mat
        );

    mesh.position.set(
        x,
        y,
        z
    );

    mesh.receiveShadow = true;
    mesh.castShadow = false;

    Game.scene.add(mesh);

    return mesh;
}

/* ============================================================
   FLOOR
   ============================================================ */

function createFloor() {
    const size =
        Game.houseSize;

    const floor =
        addBox(
            0,
            -0.12,
            -20,
            size,
            0.25,
            size,
            Materials.floor
        );

    floor.receiveShadow = true;

    const basementFloor =
        addBox(
            0,
            -0.16,
            75,
            42,
            0.22,
            28,
            Materials.floor
        );

    basementFloor.receiveShadow = true;
}

/* ============================================================
   OUTER HOUSE
   ============================================================ */

function createOuterHouse() {
    const half = 75;

    addBox(
        0,
        2.5,
        -half,
        150,
        5,
        1,
        Materials.wallDark,
        { wall: true }
    );

    addBox(
        0,
        2.5,
        half,
        150,
        5,
        1,
        Materials.wallDark,
        { wall: true }
    );

    addBox(
        -half,
        2.5,
        0,
        1,
        5,
        150,
        Materials.wallDark,
        { wall: true }
    );

    addBox(
        half,
        2.5,
        0,
        1,
        5,
        150,
        Materials.wallDark,
        { wall: true }
    );
}

/* ============================================================
   INTERIOR ROOMS
   ============================================================ */

function createInterior() {
    const walls = [
        [0, 2.5, 35, 1, 5, 40],
        [-25, 2.5, 10, 30, 5, 1],
        [25, 2.5, 10, 30, 5, 1],

        [-45, 2.5, -25, 1, 5, 45],
        [45, 2.5, -25, 1, 5, 45],

        [-22, 2.5, -55, 40, 5, 1],
        [22, 2.5, -55, 40, 5, 1],

        [-55, 2.5, 35, 20, 5, 1],
        [55, 2.5, 35, 20, 5, 1],

        [-20, 2.5, -5, 1, 5, 30],
        [20, 2.5, -5, 1, 5, 30],

        [-20, 2.5, -42, 1, 5, 26],
        [20, 2.5, -42, 1, 5, 26],

        [-55, 2.5, 60, 1, 5, 30],
        [55, 2.5, 60, 1, 5, 30]
    ];

    for (const wall of walls) {
        addBox(
            wall[0],
            wall[1],
            wall[2],
            wall[3],
            wall[4],
            wall[5],
            Materials.wall,
            { wall: true }
        );
    }

    createDoorway(
        0,
        0,
        34.4,
        0
    );

    createDoorway(
        -25,
        0,
        10,
        Math.PI / 2
    );

    createDoorway(
        25,
        0,
        10,
        Math.PI / 2
    );
}

/* ============================================================
   DOORS
   ============================================================ */

function createDoorway(
    x,
    y,
    z,
    rotation
) {
    const door =
        addBox(
            x,
            2,
            z,
            3.2,
            4,
            0.35,
            Materials.wood,
            {
                rotationY: rotation
            }
        );

    const data = {
        mesh: door,
        open: false,
        x,
        z,
        rotation
    };

    Game.doors.push(data);

    return data;
}

/* ============================================================
   FURNITURE
   ============================================================ */

function createFurniture() {
    const furniture = [
        [-32, 0.8, 18, 7, 1.6, 2],
        [32, 0.8, 18, 7, 1.6, 2],
        [-35, 1.1, -10, 4, 2.2, 2],
        [35, 1.1, -10, 4, 2.2, 2],
        [-32, 0.9, -40, 5, 1.8, 2],
        [32, 0.9, -40, 5, 1.8, 2],
        [-8, 0.8, 25, 4, 1.6, 2],
        [8, 0.8, 25, 4, 1.6, 2]
    ];

    for (const item of furniture) {
        addBox(
            item[0],
            item[1],
            item[2],
            item[3],
            item[4],
            item[5],
            Materials.wood
        );
    }

    const tables = [
        [-55, 0.9, 48],
        [55, 0.9, 48],
        [-55, 0.9, -45],
        [55, 0.9, -45]
    ];

    for (const position of tables) {
        addBox(
            position[0],
            position[1],
            position[2],
            5,
            1.8,
            3,
            Materials.wood
        );

        addCylinder(
            position[0] - 1.8,
            0.45,
            position[2] - 0.9,
            0.18,
            0.9,
            Materials.wood
        );

        addCylinder(
            position[0] + 1.8,
            0.45,
            position[2] - 0.9,
            0.18,
            0.9,
            Materials.wood
        );
    }
}

/* ============================================================
   DECORATIONS
   ============================================================ */

function createDecorations() {
    for (let i = 0; i < 80; i++) {
        const x =
            THREE.MathUtils.randFloat(
                -68,
                68
            );

        const z =
            THREE.MathUtils.randFloat(
                -68,
                68
            );

        if (
            Math.abs(x) < 7 &&
            Math.abs(z) < 12
        ) {
            continue;
        }

        const height =
            THREE.MathUtils.randFloat(
                0.2,
                0.9
            );

        const width =
            THREE.MathUtils.randFloat(
                0.15,
                0.45
            );

        const object =
            addBox(
                x,
                height / 2,
                z,
                width,
                height,
                width,
                Math.random() > 0.5
                    ? Materials.metal
                    : Materials.wood
            );

        Game.decorations.push(object);
    }
}

/* ============================================================
   EXIT GATE
   ============================================================ */

function createGate() {
    const group =
        new THREE.Group();

    group.position.set(
        Game.exitPosition.x,
        0,
        Game.exitPosition.z
    );

    const frameMaterial =
        Materials.metal;

    const left =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.7,
                5.5,
                1
            ),
            frameMaterial
        );

    left.position.x = -4;

    const right =
        left.clone();

    right.position.x = 4;

    const top =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                8.7,
                0.7,
                1
            ),
            frameMaterial
        );

    top.position.y = 5.1;

    group.add(
        left,
        right,
        top
    );

    const gate =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                7.8,
                4.7,
                0.45
            ),
            Materials.gate
        );

    gate.position.y = 2.35;

    group.add(gate);

    Game.scene.add(group);

    Game.gate = {
        group,
        gate,
        open: false
    };
}

/* ============================================================
   BUTTONS
   ============================================================ */

function createGameButtons() {
    const positions = [
        [-52, 1.3, -58],
        [53, 1.3, -12],
        [-52, 1.3, 55]
    ];

    positions.forEach(
        (position, index) => {
            const base =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        1.6,
                        1.2,
                        0.5
                    ),
                    Materials.metal
                );

            base.position.set(
                position[0],
                position[1],
                position[2]
            );

            const button =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.75,
                        0.6,
                        0.7
                    ),
                    Materials.button
                );

            button.position.set(
                position[0],
                position[1] + 0.25,
                position[2] - 0.35
            );

            Game.scene.add(
                base,
                button
            );

            Game.buttons.push({
                id: index + 1,
                base,
                mesh: button,
                position:
                    new THREE.Vector3(
                        position[0],
                        0,
                        position[2]
                    ),
                pressed: false
            });
        }
    );

    setButtonState(1, "READY");
    setButtonState(2, "READY");
    setButtonState(3, "READY");
}

/* ============================================================
   KEY
   ============================================================ */

function createKey() {
    const group =
        new THREE.Group();

    const shaft =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.18,
                0.18,
                1.25
            ),
            Materials.metal
        );

    const ring =
        new THREE.Mesh(
            new THREE.TorusGeometry(
                0.28,
                0.08,
                8,
                18
            ),
            Materials.metal
        );

    ring.rotation.x =
        Math.PI / 2;

    ring.position.z =
        0.72;

    const tooth =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.4,
                0.18,
                0.22
            ),
            Materials.metal
        );

    tooth.position.z =
        -0.65;

    group.add(
        shaft,
        ring,
        tooth
    );

    group.position.set(
        0,
        1.4,
        -18
    );

    Game.scene.add(group);

    Game.keyObject = {
        group,
        collected: false
    };
}

/* ============================================================
   NOTES
   ============================================================ */

function createNotes() {
    const locations = [
        [-15, 1.3, 20],
        [15, 1.3, 2],
        [-32, 1.3, -27],
        [32, 1.3, -52],
        [-58, 1.3, 20],
        [58, 1.3, 20]
    ];

    locations.forEach(
        (position, index) => {
            const paper =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.8,
                        0.04,
                        0.55
                    ),
                    Materials.paper
                );

            paper.position.set(
                position[0],
                position[1],
                position[2]
            );

            paper.rotation.y =
                Math.random() * Math.PI;

            Game.scene.add(paper);

            Game.notes.push({
                id: index + 1,
                mesh: paper,
                collected: false,
                text:
                    `Note ${index + 1}: The house is larger than it looks.`
            });
        }
    );
}

/* ============================================================
   PLAYER
   ============================================================ */

function createPlayer() {
    Game.player = {
        position:
            Game.spawn.clone(),

        radius:
            Game.playerRadius,

        height:
            Game.playerHeight
    };

    Game.camera.position.set(
        Game.spawn.x,
        Game.playerHeight,
        Game.spawn.z
    );

    Game.cameraYaw = 0;
    Game.cameraPitch = -0.18;
}

/* ============================================================
   SEEKER
   ============================================================ */

function createSeeker() {
    const group =
        new THREE.Group();

    const body =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.55,
                0.75,
                2.4,
                16
            ),
            material(
                0x111111,
                0.92
            )
        );

    body.position.y = 1.2;

    const head =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.62,
                18,
                14
            ),
            material(
                0x070707,
                0.95
            )
        );

    head.position.y = 2.65;

    const eyeMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xaa2222
        });

    const eyeLeft =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.055,
                8,
                8
            ),
            eyeMaterial
        );

    const eyeRight =
        eyeLeft.clone();

    eyeLeft.position.set(
        -0.2,
        2.68,
        -0.53
    );

    eyeRight.position.set(
        0.2,
        2.68,
        -0.53
    );

    group.add(
        body,
        head,
        eyeLeft,
        eyeRight
    );

    group.position.set(
        0,
        0,
        -40
    );

    Game.scene.add(group);

    Game.seeker = {
        group,
        position: group.position,
        radius: 0.65
    };
}

/* ============================================================
   FLASHLIGHT
   ============================================================ */

function createFlashlight() {
    Game.flashlightObject =
        new THREE.SpotLight(
            0xffffff,
            4.2,
            28,
            Math.PI / 7,
            0.7,
            1.2
        );

    Game.flashlightObject.position.set(
        0,
        0,
        0
    );

    Game.scene.add(
        Game.flashlightObject
    );

    Game.flashlightTarget =
        new THREE.Object3D();

    Game.scene.add(
        Game.flashlightTarget
    );

    Game.flashlightObject.target =
        Game.flashlightTarget;
}

function updateFlashlight() {
    if (!Game.flashlightObject) {
        return;
    }

    Game.flashlightObject.visible =
        Game.flashlight &&
        Game.flashlightBattery > 0;

    Game.flashlightObject.position.copy(
        Game.camera.position
    );

    const direction =
        Game.tmp.a.set(
            0,
            0,
            -1
        );

    direction.applyQuaternion(
        Game.camera.quaternion
    );

    Game.flashlightTarget.position.copy(
        Game.camera.position
    );

    Game.flashlightTarget.position.add(
        direction.multiplyScalar(15)
    );

    if (Game.flashlight) {
        Game.flashlightBattery =
            Math.max(
                0,
                Game.flashlightBattery -
                Game.clock.getDelta() * 0.35
            );
    }
}

/* ============================================================
   COLLISION
   ============================================================ */

function isInsideWall(
    x,
    z,
    radius
) {
    for (const wall of Game.walls) {
        if (
            x + radius > wall.minX &&
            x - radius < wall.maxX &&
            z + radius > wall.minZ &&
            z - radius < wall.maxZ
        ) {
            return true;
        }
    }

    return false;
}

function moveWithCollision(
    object,
    dx,
    dz
) {
    const oldX =
        object.position.x;

    const oldZ =
        object.position.z;

    const nextX =
        oldX + dx;

    const nextZ =
        oldZ + dz;

    if (
        !isInsideWall(
            nextX,
            oldZ,
            object.radius || 0.3
        )
    ) {
        object.position.x =
            nextX;
    }

    if (
        !isInsideWall(
            object.position.x,
            nextZ,
            object.radius || 0.3
        )
    ) {
        object.position.z =
            nextZ;
    }
}

/* ============================================================
   PLAYER MOVEMENT
   ============================================================ */

function updatePlayer(delta) {
    if (!Game.player) {
        return;
    }

    let forward = 0;
    let strafe = 0;

    if (Game.keys.has("KeyW")) {
        forward += 1;
    }

    if (Game.keys.has("KeyS")) {
        forward -= 1;
    }

    if (Game.keys.has("KeyA")) {
        strafe -= 1;
    }

    if (Game.keys.has("KeyD")) {
        strafe += 1;
    }

    if (Game.device === "mobile") {
        strafe += Game.joystickX;
        forward -= Game.joystickY;
    }

    if (Game.keys.has("ArrowUp")) {
        forward += 1;
    }

    if (Game.keys.has("ArrowDown")) {
        forward -= 1;
    }

    if (Game.keys.has("ArrowLeft")) {
        strafe -= 1;
    }

    if (Game.keys.has("ArrowRight")) {
        strafe += 1;
    }

    const length =
        Math.sqrt(
            forward * forward +
            strafe * strafe
        );

    if (length > 1) {
        forward /= length;
        strafe /= length;
    }

    let speed =
        Game.playerSpeed;

    if (
        Game.keys.has("Shift") ||
        Game.keys.has("Space")
    ) {
        speed =
            Game.runSpeed;
    }

    const yaw =
        Game.cameraYaw;

    const moveX =
        (
            Math.sin(yaw) * forward +
            Math.cos(yaw) * strafe
        ) * speed * delta;

    const moveZ =
        (
            Math.cos(yaw) * forward -
            Math.sin(yaw) * strafe
        ) * speed * delta;

    moveWithCollision(
        Game.player,
        moveX,
        moveZ
    );

    Game.camera.position.set(
        Game.player.position.x,
        Game.playerHeight,
        Game.player.position.z
    );

    if (length > 0.05) {
        setNoise(
            Game.keys.has("Shift") ||
            Game.keys.has("Space")
                ? 75
                : 35
        );

        if (
            Game.elapsed -
            Game.lastFootstep >
            (
                Game.keys.has("Shift") ||
                Game.keys.has("Space")
                    ? 0.32
                    : 0.52
            )
        ) {
            playFootstep();
        }
    } else {
        setNoise(
            Math.max(
                0,
                Game.noise -
                delta * 45
            )
        );
    }
}

/* ============================================================
   CAMERA
   ============================================================ */

function updateCamera() {
    if (!Game.camera) {
        return;
    }

    Game.camera.rotation.order =
        "YXZ";

    Game.camera.rotation.y =
        Game.cameraYaw;

    Game.camera.rotation.x =
        Game.cameraPitch;
}

/* ============================================================
   BUTTON INTERACTION
   ============================================================ */

function distanceTo(
    a,
    b
) {
    return a.distanceTo(b);
}

function updateInteraction() {
    Game.interactionTarget =
        null;

    if (!Game.player) {
        return;
    }

    let closest =
        Infinity;

    for (const button of Game.buttons) {
        if (button.pressed) {
            continue;
        }

        const distance =
            distanceTo(
                Game.player.position,
                button.position
            );

        if (
            distance < 2.5 &&
            distance < closest
        ) {
            closest = distance;
            Game.interactionTarget =
                button;
        }
    }

    if (
        Game.keyObject &&
        !Game.keyObject.collected
    ) {
        const distance =
            distanceTo(
                Game.player.position,
                Game.keyObject.group.position
            );

        if (
            distance < 2.3 &&
            distance < closest
        ) {
            closest = distance;

            Game.interactionTarget = {
                type: "key",
                object: Game.keyObject
            };
        }
    }

    for (const note of Game.notes) {
        if (note.collected) {
            continue;
        }

        const distance =
            distanceTo(
                Game.player.position,
                note.mesh.position
            );

        if (
            distance < 1.8 &&
            distance < closest
        ) {
            closest = distance;

            Game.interactionTarget = {
                type: "note",
                object: note
            };
        }
    }

    if (
        Game.gate &&
        !Game.gate.open
    ) {
        const distance =
            distanceTo(
                Game.player.position,
                Game.exitPosition
            );

        if (
            distance < 4 &&
            distance < closest
        ) {
            closest = distance;

            Game.interactionTarget = {
                type: "gate"
            };
        }
    }

    if (!Game.interactionTarget) {
        setInteraction("");
        return;
    }

    const target =
        Game.interactionTarget;

    if (target.type === "key") {
        setInteraction(
            "PRESS E TO TAKE THE KEY"
        );
        return;
    }

    if (target.type === "note") {
        setInteraction(
            "PRESS E TO READ"
        );
        return;
    }

    if (target.type === "gate") {
        if (Game.keyCollected) {
            setInteraction(
                "PRESS E TO UNLOCK THE GATE"
            );
        } else {
            setInteraction(
                "THE GATE IS LOCKED"
            );
        }

        return;
    }

    setInteraction(
        `PRESS E TO PRESS BUTTON ${target.id}`
    );
}

function interact() {
    if (!Game.running || Game.paused) {
        return;
    }

    const target =
        Game.interactionTarget;

    if (!target) {
        return;
    }

    if (
        target.type === "key"
    ) {
        collectKey();
        return;
    }

    if (
        target.type === "note"
    ) {
        collectNote(
            target.object
        );
        return;
    }

    if (
        target.type === "gate"
    ) {
        if (Game.keyCollected) {
            unlockGate();
        } else {
            setInteraction(
                "FIND THE KEY FIRST"
            );
        }

        return;
    }

    if (
        target.mesh &&
        target.id
    ) {
        pressButton(target);
    }
}

/* ============================================================
   BUTTON PRESS
   ============================================================ */

function pressButton(button) {
    if (button.pressed) {
        return;
    }

    button.pressed = true;

    button.mesh.material =
        Materials.buttonPressed;

    button.mesh.position.y -= 0.12;

    Game.buttonsPressed++;

    setButtonState(
        button.id,
        "PRESSED"
    );

    playButtonSound();

    setObjective(
        Game.buttonsPressed >= 3
            ? "Find the key."
            : `Press the remaining buttons (${3 - Game.buttonsPressed})`
    );

    if (Game.buttonsPressed >= 3) {
        unlockKey();
    }
}

/* ============================================================
   KEY
   ============================================================ */

function unlockKey() {
    if (!Game.keyObject) {
        return;
    }

    Game.keyObject.group.visible =
        true;

    setObjective(
        "Find the key and unlock the gate."
    );

    playButtonSound();
}

function collectKey() {
    if (
        !Game.keyObject ||
        Game.keyObject.collected
    ) {
        return;
    }

    Game.keyObject.collected =
        true;

    Game.keyObject.group.visible =
        false;

    Game.keyCollected =
        true;

    setObjective(
        "Reach the gate."
    );

    playPickupSound();
}

/* ============================================================
   NOTES
   ============================================================ */

function collectNote(note) {
    if (note.collected) {
        return;
    }

    note.collected = true;
    note.mesh.visible = false;

    Game.notesCollected++;

    setNotesCount(
        Game.notesCollected
    );

    playPickupSound();

    const toast =
        $("noteToastText");

    if (toast) {
        toast.textContent =
            note.text;
    }

    show($("noteToast"));

    setTimeout(() => {
        hide($("noteToast"));
    }, 2800);
}

function showNotesLog() {
    const list =
        $("notesLogList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const collected =
        Game.notes.filter(
            note => note.collected
        );

    if (!collected.length) {
        const empty =
            document.createElement("div");

        empty.className =
            "notes-log-empty";

        empty.textContent =
            "No notes collected.";

        list.appendChild(empty);
    } else {
        for (const note of collected) {
            const item =
                document.createElement("div");

            item.className =
                "notes-log-item";

            item.textContent =
                note.text;

            list.appendChild(item);
        }
    }

    hide($("pauseScreen"));
    show($("notesLogScreen"));
}

/* ============================================================
   GATE
   ============================================================ */

function unlockGate() {
    if (
        !Game.gate ||
        Game.gate.open
    ) {
        return;
    }

    Game.gate.open =
        true;

    Game.gate.gate.position.y =
        6;

    playGateSound();

    setObjective(
        "Escape."
    );

    setInteraction(
        "THE GATE IS OPEN"
    );

    setTimeout(() => {
        if (Game.gate) {
            Game.gate.gate.visible =
                false;
        }
    }, 700);
}

/* ============================================================
   SEEKER AI
   ============================================================ */

function updateSeeker(delta) {
    if (
        !Game.seeker ||
        !Game.player
    ) {
        return;
    }

    const seeker =
        Game.seeker;

    const player =
        Game.player;

    const dx =
        player.position.x -
        seeker.position.x;

    const dz =
        player.position.z -
        seeker.position.z;

    const distance =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    Game.seekerTargetVisible =
        distance < 22;

    const hearingRange =
        10 +
        Game.noise * 0.12;

    if (
        distance < hearingRange ||
        Game.noise > 70
    ) {
        Game.seekerAlerted =
            true;
    }

    if (
        distance < 30 ||
        Game.elapsed > 15
    ) {
        Game.seekerAwake =
            true;
    }

    if (!Game.seekerAwake) {
        return;
    }

    let speed =
        Game.seekerSpeed;

    if (Game.seekerAlerted) {
        speed =
            Game.seekerChaseSpeed;
    }

    if (
        distance < 12
    ) {
        speed =
            Game.seekerAlertSpeed;
    }

    if (
        Game.seekerTargetVisible &&
        distance < 24
    ) {
        Game.seekerAlerted =
            true;
    }

    const length =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    if (length > 0.001) {
        const dirX =
            dx / length;

        const dirZ =
            dz / length;

        const moveX =
            dirX * speed * delta;

        const moveZ =
            dirZ * speed * delta;

        moveWithCollision(
            seeker,
            moveX,
            moveZ
        );

        seeker.group.rotation.y =
            Math.atan2(
                dirX,
                dirZ
            );
    }

    if (
        distance < 2.0
    ) {
        triggerDeath(
            "The Seeker caught you."
        );
    }

    if (
        distance < 18
    ) {
        const intensity =
            18 -
            distance;

        setSanity(
            Game.sanity -
            intensity *
            delta *
            0.65
        );

        playSeekerPulse();
    } else {
        setSanity(
            Math.min(
                100,
                Game.sanity +
                delta * 2
            )
        );
    }
}

/* ============================================================
   GAME TIMER
   ============================================================ */

function updateTimer(delta) {
    Game.remaining -= delta;

    setTimer(
        Game.remaining
    );

    if (
        Game.remaining <= 0
    ) {
        Game.remaining = 0;

        triggerDeath(
            "Time ran out."
        );
    }
}

/* ============================================================
   WIN CONDITION
   ============================================================ */

function checkWin() {
    if (
        !Game.keyCollected ||
        !Game.gate ||
        !Game.gate.open ||
        !Game.player
    ) {
        return;
    }

    const distance =
        Game.player.position.distanceTo(
            Game.exitPosition
        );

    if (
        distance < 5
    ) {
        showWin();
    }
}

/* ============================================================
   DEATH
   ============================================================ */

function triggerDeath(reason) {
    if (
        Game.dead ||
        Game.won
    ) {
        return;
    }

    Game.dead = true;

    if (
        document.pointerLockElement
    ) {
        document.exitPointerLock?.();
    }

    showDeath(reason);
}

/* ============================================================
   PAUSE
   ============================================================ */

function togglePause() {
    if (
        !Game.running ||
        Game.dead ||
        Game.won
    ) {
        return;
    }

    if (Game.paused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    Game.paused = true;

    show($("pauseScreen"));

    if (
        document.pointerLockElement
    ) {
        document.exitPointerLock?.();
    }
}

function resumeGame() {
    Game.paused = false;

    hide($("pauseScreen"));

    Game.clock.getDelta();

    if (
        Game.device === "pc" &&
        $("gameCanvas")
    ) {
        $("gameCanvas").requestPointerLock?.();
    }
}

/* ============================================================
   MINIMAP
   ============================================================ */

function createMinimap() {
    let map =
        document.getElementById(
            "minimap"
        );

    if (!map) {
        map =
            document.createElement("div");

        map.id = "minimap";

        map.style.position =
            "absolute";

        map.style.left =
            "18px";

        map.style.top =
            "18px";

        map.style.width =
            "170px";

        map.style.height =
            "170px";

        map.style.background =
            "rgba(0,0,0,.72)";

        map.style.border =
            "1px solid rgba(255,255,255,.3)";

        map.style.zIndex =
            "20";

        const gameScreen =
            $("gameScreen");

        if (gameScreen) {
            gameScreen.appendChild(map);
        }
    }

    let canvas =
        map.querySelector(
            "canvas"
        );

    if (!canvas) {
        canvas =
            document.createElement(
                "canvas"
            );

        canvas.width = 340;
        canvas.height = 340;

        canvas.style.width =
            "100%";

        canvas.style.height =
            "100%";

        map.appendChild(canvas);
    }

    Game.minimapCanvas =
        canvas;

    Game.minimapContext =
        canvas.getContext("2d");
}

function updateMinimap() {
    if (
        !Game.minimapContext ||
        !Game.player ||
        !Game.seeker
    ) {
        return;
    }

    const ctx =
        Game.minimapContext;

    const width =
        Game.minimapCanvas.width;

    const height =
        Game.minimapCanvas.height;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.fillStyle =
        "#080808";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    const scale =
        2.05;

    const convert = (
        x,
        z
    ) => ({
        x:
            width / 2 +
            x * scale,

        y:
            height / 2 +
            z * scale
    });

    ctx.strokeStyle =
        "rgba(255,255,255,.18)";

    ctx.lineWidth = 2;

    for (
        let x = -75;
        x <= 75;
        x += 15
    ) {
        const a =
            convert(x, -75);

        const b =
            convert(x, 75);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }

    for (
        let z = -75;
        z <= 75;
        z += 15
    ) {
        const a =
            convert(-75, z);

        const b =
            convert(75, z);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }

    ctx.strokeStyle =
        "rgba(255,255,255,.42)";

    ctx.lineWidth = 3;

    for (const wall of Game.walls) {
        const a =
            convert(
                wall.minX,
                wall.minZ
            );

        const b =
            convert(
                wall.maxX,
                wall.maxZ
            );

        ctx.strokeRect(
            a.x,
            a.y,
            b.x - a.x,
            b.y - a.y
        );
    }

    for (const button of Game.buttons) {
        const p =
            convert(
                button.position.x,
                button.position.z
            );

        ctx.fillStyle =
            button.pressed
                ? "#4b9b5c"
                : "#8f2525";

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            7,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    const gate =
        convert(
            Game.exitPosition.x,
            Game.exitPosition.z
        );

    ctx.fillStyle =
        Game.gate?.open
            ? "#69a76d"
            : "#777";

    ctx.fillRect(
        gate.x - 6,
        gate.y - 6,
        12,
        12
    );

    const player =
        convert(
            Game.player.position.x,
            Game.player.position.z
        );

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    ctx.rotate(
        -Game.cameraYaw
    );

    ctx.fillStyle =
        "#ffffff";

    ctx.beginPath();

    ctx.moveTo(
        0,
        -12
    );

    ctx.lineTo(
        -8,
        9
    );

    ctx.lineTo(
        0,
        5
    );

    ctx.lineTo(
        8,
        9
    );

    ctx.closePath();

    ctx.fill();

    ctx.restore();

    const seeker =
        convert(
            Game.seeker.position.x,
            Game.seeker.position.z
        );

    ctx.save();

    ctx.translate(
        seeker.x,
        seeker.y
    );

    const angle =
        Math.atan2(
            Game.player.position.x -
            Game.seeker.position.x,

            Game.player.position.z -
            Game.seeker.position.z
        );

    ctx.rotate(-angle);

    ctx.fillStyle =
        "#d43b3b";

    ctx.beginPath();

    ctx.moveTo(
        0,
        -12
    );

    ctx.lineTo(
        -8,
        8
    );

    ctx.lineTo(
        8,
        8
    );

    ctx.closePath();

    ctx.fill();

    ctx.restore();
}

/* ============================================================
   ENVIRONMENT UPDATE
   ============================================================ */

function updateEnvironment(delta) {
    if (
        Game.seeker &&
        Game.seeker.group
    ) {
        const pulse =
            1 +
            Math.sin(
                Game.elapsed * 2.5
            ) * 0.025;

        Game.seeker.group.scale.set(
            pulse,
            pulse,
            pulse
        );
    }

    if (
        Game.keyObject &&
        !Game.keyObject.collected
    ) {
        Game.keyObject.group.rotation.y +=
            delta * 1.5;

        Game.keyObject.group.position.y =
            1.4 +
            Math.sin(
                Game.elapsed * 3
            ) * 0.12;
    }

    for (
        const note of Game.notes
    ) {
        if (!note.collected) {
            note.mesh.rotation.z =
                Math.sin(
                    Game.elapsed * 0.7 +
                    note.id
                ) * 0.025;
        }
    }
}

/* ============================================================
   GAME LOOP
   ============================================================ */

function gameLoop() {
    requestAnimationFrame(
        gameLoop
    );

    if (
        !Game.renderer ||
        !Game.scene ||
        !Game.camera
    ) {
        return;
    }

    const delta =
        Math.min(
            Game.clock.getDelta(),
            0.05
        );

    if (
        Game.running &&
        !Game.paused &&
        !Game.dead &&
        !Game.won
    ) {
        Game.elapsed += delta;

        updateTimer(delta);
        updatePlayer(delta);
        updateCamera();
        updateInteraction();
        updateSeeker(delta);
        updateEnvironment(delta);
        updateFlashlight();
        updateMinimap();
        checkWin();
    }

    Game.renderer.render(
        Game.scene,
        Game.camera
    );
}

/* ============================================================
   RESIZE
   ============================================================ */

function resize() {
    if (
        !Game.renderer ||
        !Game.camera
    ) {
        return;
    }

    const width =
        Math.max(
            1,
            window.innerWidth
        );

    const height =
        Math.max(
            1,
            window.innerHeight
        );

    Game.camera.aspect =
        width / height;

    Game.camera.updateProjectionMatrix();

    Game.renderer.setSize(
        width,
        height,
        false
    );

    Game.renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );
}

window.addEventListener(
    "resize",
    resize
);

/* ============================================================
   RESET GAME
   ============================================================ */

function clearWorld() {
    if (!Game.scene) {
        return;
    }

    while (
        Game.scene.children.length
    ) {
        const object =
            Game.scene.children.pop();

        if (object.geometry) {
            object.geometry.dispose?.();
        }

        if (object.material) {
            if (
                Array.isArray(
                    object.material
                )
            ) {
                object.material.forEach(
                    material => {
                        material.dispose?.();
                    }
                );
            } else {
                object.material.dispose?.();
            }
        }
    }

    Game.walls = [];
    Game.doors = [];
    Game.buttons = [];
    Game.notes = [];
    Game.decorations = [];
    Game.lights = [];

    Game.gate = null;
    Game.keyObject = null;
    Game.flashlightObject = null;
    Game.flashlightTarget = null;
    Game.seeker = null;
    Game.player = null;
}

function resetState() {
    Game.running = false;
    Game.paused = false;
    Game.dead = false;
    Game.won = false;

    Game.elapsed = 0;
    Game.remaining = 180;

    Game.buttonsPressed = 0;
    Game.keyCollected = false;
    Game.gateUnlocked = false;

    Game.notesCollected = 0;

    Game.seekerAwake = false;
    Game.seekerAlerted = false;
    Game.seekerTargetVisible = false;

    Game.sanity = 100;
    Game.noise = 0;

    Game.flashlightBattery = 100;

    Game.interactionTarget = null;

    Game.keys.clear();

    setTimer(180);
    setSanity(100);
    setNoise(0);
    setNotesCount(0);

    setButtonState(1, "READY");
    setButtonState(2, "READY");
    setButtonState(3, "READY");

    hide($("noteToast"));
    hide($("dangerWarning"));
}

/* ============================================================
   WORLD BUILD
   ============================================================ */

function buildWorld() {
    clearWorld();

    createFloor();
    createOuterHouse();
    createInterior();
    createFurniture();
    createDecorations();

    createGate();
    createGameButtons();
    createKey();
    createNotes();

    createPlayer();
    createSeeker();
    createFlashlight();

    createMinimap();
}

/* ============================================================
   DEVICE DETECTION
   ============================================================ */

function detectDevice() {
    const touch =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0;

    const smallScreen =
        window.innerWidth < 800;

    Game.device =
        touch && smallScreen
            ? "mobile"
            : "pc";

    const mobileControls =
        $("mobileControls");

    if (
        mobileControls
    ) {
        if (Game.device === "mobile") {
            show(mobileControls);
        } else {
            hide(mobileControls);
        }
    }
}

/* ============================================================
   GAME START
   ============================================================ */

function startGame() {
    initializeAudio();

    Game.device =
        Game.device ||
        "pc";

    resetState();

    if (
        !Game.renderer
    ) {
        const rendererReady =
            createRenderer();

        if (!rendererReady) {
            return;
        }
    }

    createScene();
    createCamera();
    createLighting();

    buildWorld();

    showGame();

    Game.running = true;
    Game.paused = false;

    setObjective(
        "Find and press all three buttons."
    );

    setTimer(
        Game.remaining
    );

    setNotesCount(
        0
    );

    detectDevice();

    Game.clock.start();

    if (
        Game.device === "pc"
    ) {
        setTimeout(() => {
            if (
                Game.running &&
                !Game.paused
            ) {
                $("gameCanvas")?.requestPointerLock?.();
            }
        }, 150);
    }
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

function initializeGame() {
    try {
        bindInterface();
        bindKeyboard();
        bindMouse();
        bindTouch();

        detectDevice();

        const canvas =
            $("gameCanvas");

        if (
            canvas &&
            !(canvas instanceof HTMLCanvasElement)
        ) {
            const replacement =
                document.createElement(
                    "canvas"
                );

            replacement.id =
                "gameCanvas";

            replacement.className =
                canvas.className;

            canvas.replaceWith(
                replacement
            );
        }

        if (
            $("menuScreen")
        ) {
            show($("menuScreen"));
        }

        hide($("gameScreen"));
        hide($("pauseScreen"));
        hide($("deathScreen"));
        hide($("winScreen"));
        hide($("notesLogScreen"));

        setTimer(180);
        setSanity(100);
        setNoise(0);
        setNotesCount(0);

        setObjective(
            "Find and press all three buttons."
        );

        gameLoop();

    } catch (error) {
        /*
         * Do not create a fake error screen.
         * Keep the menu playable even if an optional
         * feature fails.
         */
        console.error(
            "THE SEEKER startup warning:",
            error
        );

        gameLoop();
    }
}

/* ============================================================
   START
   ============================================================ */

if (
    document.readyState === "loading"
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