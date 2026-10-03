/* ==========================================================================
   THE SEEKER
   game.js
   Complete browser horror game controller
   ========================================================================== */

import * as THREE from "three";

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */

const CONFIG = {
    game: {
        title: "THE SEEKER",
        version: "1.0.0",
        roomScale: 10,
        worldSize: 240,
        wallHeight: 8,
        wallThickness: 1,
        floorY: 0,
        playerHeight: 2.0,
        playerRadius: 0.45,
        playerSpeed: 5.0,
        playerRunSpeed: 8.2,
        crouchSpeed: 2.4,
        demonSpeed: 3.4,
        demonChaseSpeed: 5.0,
        demonHearDistance: 18,
        demonSightDistance: 55,
        demonSightAngle: Math.PI * 0.62,
        interactionDistance: 3.2,
        buttonDistance: 2.8,
        gateDistance: 4.0,
        startingSanity: 100,
        sanityDrain: 1.3,
        sanityRecover: 0.35,
        noiseDecay: 2.8,
        maxNoise: 100,
        setupTime: 180,
        hideTime: 7,
        flashlightBattery: 100,
        flashlightDrain: 2.2,
        flashlightRecharge: 0
    },

    colors: {
        background: 0x020202,
        floor: 0x111111,
        floorAlt: 0x151515,
        wall: 0x242424,
        wallDark: 0x171717,
        ceiling: 0x090909,
        trim: 0x343434,
        gold: 0xc9a227,
        red: 0xb33030,
        green: 0x2a8a4a,
        white: 0xe8e8e8,
        blue: 0x567da5,
        demon: 0x7e1111
    },

    audio: {
        footstep: "footstep.mp3",
        volume: 0.7
    }
};

/* ==========================================================================
   GLOBAL STATE
   ========================================================================== */

const STATE = {
    initialized: false,
    running: false,
    paused: false,
    dead: false,
    won: false,

    device: "pc",

    setupRemaining: CONFIG.game.setupTime,
    gameTime: 0,

    sanity: CONFIG.game.startingSanity,
    noise: 0,
    hideRemaining: 0,

    flashlightOn: true,
    flashlightBattery: CONFIG.game.flashlightBattery,

    buttons: {
        1: false,
        2: false,
        3: false
    },

    keyFound: false,
    gateOpen: false,

    notes: [],
    collectedNotes: 0,

    lastTime: 0,
    delta: 0,

    footstepTimer: 0,
    footstepIndex: 0,

    objective: "Find the three buttons.",
    interaction: "",

    demonState: "idle",
    demonAlert: false,

    currentRoom: "Main Hall",

    keys: new Set(),

    joystick: {
        active: false,
        x: 0,
        y: 0,
        pointerId: null
    },

    look: {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0
    }
};

/* ==========================================================================
   THREE.JS REFERENCES
   ========================================================================== */

let scene = null;
let camera = null;
let renderer = null;

let player = null;
let playerBody = null;
let playerFlashlight = null;
let playerFlashTarget = null;

let demon = null;
let demonBody = null;
let demonHead = null;

let gate = null;
let keyObject = null;

let worldGroup = null;
let collisionObjects = [];
let interactiveObjects = [];

let clock = null;

/* ==========================================================================
   DOM REFERENCES
   ========================================================================== */

const DOM = {};

function cacheDOM() {
    DOM.loadError = document.getElementById("loadError");

    DOM.menuScreen = document.getElementById("menuScreen");
    DOM.instructionsScreen = document.getElementById("instructionsScreen");
    DOM.settingsScreen = document.getElementById("settingsScreen");

    DOM.gameScreen = document.getElementById("gameScreen");
    DOM.canvas = document.getElementById("gameCanvas");

    DOM.playButton = document.getElementById("playButton");
    DOM.instructionsButton = document.getElementById("instructionsButton");
    DOM.settingsButton = document.getElementById("settingsButton");

    DOM.instructionsBack = document.getElementById("instructionsBack");
    DOM.settingsBack = document.getElementById("settingsBack");

    DOM.flashlightSetting = document.getElementById("flashlightSetting");
    DOM.footstepSetting = document.getElementById("footstepSetting");
    DOM.volumeSetting = document.getElementById("volumeSetting");

    DOM.objective = document.getElementById("objective");
    DOM.notesCount = document.getElementById("notesCount");
    DOM.timer = document.getElementById("timer");

    DOM.button1 = document.getElementById("button1");
    DOM.button2 = document.getElementById("button2");
    DOM.button3 = document.getElementById("button3");

    DOM.sanityFill = document.getElementById("sanityFill");
    DOM.noiseFill = document.getElementById("noiseFill");

    DOM.crosshair = document.getElementById("crosshair");

    DOM.interaction = document.getElementById("interaction");
    DOM.interactionText = document.getElementById("interactionText");

    DOM.hideTimer = document.getElementById("hideTimer");
    DOM.hideTimerValue = document.getElementById("hideTimerValue");

    DOM.dangerWarning = document.getElementById("dangerWarning");

    DOM.noteToast = document.querySelector(".note-toast");
    DOM.noteToastText = document.getElementById("noteToastText");

    DOM.screamOverlay = document.getElementById("screamOverlay");

    DOM.mobileControls = document.getElementById("mobileControls");
    DOM.joystickZone = document.getElementById("joystickZone");
    DOM.joystickBase = document.getElementById("joystickBase");
    DOM.joystickKnob = document.getElementById("joystickKnob");

    DOM.mobileRun = document.getElementById("mobileRun");
    DOM.mobileInteract = document.getElementById("mobileInteract");
    DOM.mobileFlashlight = document.getElementById("mobileFlashlight");
    DOM.lookZone = document.getElementById("lookZone");

    DOM.pauseScreen = document.getElementById("pauseScreen");
    DOM.resumeButton = document.getElementById("resumeButton");
    DOM.notesLogButton = document.getElementById("notesLogButton");
    DOM.quitButton = document.getElementById("quitButton");

    DOM.notesLogScreen = document.getElementById("notesLogScreen");
    DOM.notesLogList = document.getElementById("notesLogList");
    DOM.notesLogBack = document.getElementById("notesLogBack");

    DOM.deathScreen = document.getElementById("deathScreen");
    DOM.deathReason = document.getElementById("deathReason");
    DOM.retryButton = document.getElementById("retryButton");
    DOM.deathMenuButton = document.getElementById("deathMenuButton");

    DOM.winScreen = document.getElementById("winScreen");
    DOM.winTitle = document.getElementById("winTitle");
    DOM.winText = document.getElementById("winText");
    DOM.winAgainButton = document.getElementById("winAgainButton");
    DOM.winMenuButton = document.getElementById("winMenuButton");

    createExtraDOM();
}

/* ==========================================================================
   EXTRA DOM
   ========================================================================== */

function createExtraDOM() {
    createDeviceSelector();
    createMinimap();
    createBatteryHUD();
    createDemonHUD();
    createToastContainer();
    createMobileDeviceNotice();
}

/* --------------------------------------------------------------------------
   DEVICE SELECTOR
   -------------------------------------------------------------------------- */

function createDeviceSelector() {
    if (document.getElementById("deviceSelector")) return;

    const selector = document.createElement("div");
    selector.id = "deviceSelector";
    selector.className = "overlay hidden";

    selector.innerHTML = `
        <div class="device-panel">
            <div class="device-kicker">CONTROL SETUP</div>
            <div class="device-title">CHOOSE YOUR DEVICE</div>

            <div class="device-options">
                <button class="device-option" id="devicePC">
                    <span class="device-option-icon">⌨</span>
                    <strong>PC</strong>
                    <small>Keyboard + Mouse</small>
                </button>

                <button class="device-option" id="deviceMobile">
                    <span class="device-option-icon">▣</span>
                    <strong>MOBILE</strong>
                    <small>Touch Controls</small>
                </button>
            </div>

            <button class="device-cancel" id="deviceCancel">
                BACK
            </button>
        </div>
    `;

    document.body.appendChild(selector);

    selector.querySelector("#devicePC").addEventListener("click", () => {
        STATE.device = "pc";
        hideElement(selector);
        startGame();
    });

    selector.querySelector("#deviceMobile").addEventListener("click", () => {
        STATE.device = "mobile";
        hideElement(selector);
        startGame();
    });

    selector.querySelector("#deviceCancel").addEventListener("click", () => {
        hideElement(selector);
    });
}

/* --------------------------------------------------------------------------
   MINIMAP
   -------------------------------------------------------------------------- */

function createMinimap() {
    if (document.getElementById("seekerMinimap")) return;

    const minimap = document.createElement("div");
    minimap.id = "seekerMinimap";

    minimap.innerHTML = `
        <div class="minimap-header">
            <span>HOUSE MAP</span>
            <span id="minimapRoom">MAIN HALL</span>
        </div>

        <div class="minimap-body">
            <div class="minimap-grid"></div>

            <div id="playerMarker" class="minimap-marker player-marker">
                ▲
            </div>

            <div id="demonMarker" class="minimap-marker demon-marker">
                ▲
            </div>

            <div id="minimapGate" class="minimap-gate">
                G
            </div>
        </div>

        <div class="minimap-legend">
            <span><i class="legend-player"></i> YOU</span>
            <span><i class="legend-demon"></i> SEEKER</span>
        </div>
    `;

    document.body.appendChild(minimap);
}

/* --------------------------------------------------------------------------
   BATTERY HUD
   -------------------------------------------------------------------------- */

function createBatteryHUD() {
    if (document.getElementById("flashlightBatteryHUD")) return;

    const element = document.createElement("div");
    element.id = "flashlightBatteryHUD";

    element.innerHTML = `
        <div class="battery-label">FLASHLIGHT</div>
        <div class="battery-bar">
            <div id="batteryFill"></div>
        </div>
        <div id="batteryText">100%</div>
    `;

    const hud = document.getElementById("hud");

    if (hud) {
        hud.appendChild(element);
    } else {
        document.body.appendChild(element);
    }
}

/* --------------------------------------------------------------------------
   DEMON HUD
   -------------------------------------------------------------------------- */

function createDemonHUD() {
    if (document.getElementById("demonStatusHUD")) return;

    const element = document.createElement("div");
    element.id = "demonStatusHUD";

    element.innerHTML = `
        <span id="demonStatusDot"></span>
        <span id="demonStatusText">THE SEEKER IS WAITING</span>
    `;

    document.body.appendChild(element);
}

/* --------------------------------------------------------------------------
   TOAST CONTAINER
   -------------------------------------------------------------------------- */

function createToastContainer() {
    if (document.getElementById("seekerToastContainer")) return;

    const element = document.createElement("div");
    element.id = "seekerToastContainer";

    document.body.appendChild(element);
}

/* --------------------------------------------------------------------------
   MOBILE NOTICE
   -------------------------------------------------------------------------- */

function createMobileDeviceNotice() {
    if (document.getElementById("mobileDeviceNotice")) return;

    const element = document.createElement("div");
    element.id = "mobileDeviceNotice";
    element.className = "hidden";

    element.textContent = "TOUCH CONTROLS ENABLED";

    document.body.appendChild(element);
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

function initializeGame() {
    if (STATE.initialized) return;

    try {
        cacheDOM();

        if (!DOM.canvas) {
            throw new Error("Game canvas was not found.");
        }

        if (!(DOM.canvas instanceof HTMLCanvasElement)) {
            throw new Error("gameCanvas is not a real HTML canvas element.");
        }

        setupMenu();
        setupSettings();
        setupInstructions();
        setupGameControls();
        setupOverlayControls();

        STATE.initialized = true;

        hideElement(DOM.gameScreen);

    } catch (error) {
        console.error("[THE SEEKER] Initialization error:", error);
        showLoadError(error);
    }
}

/* ==========================================================================
   ERROR HANDLING
   ========================================================================== */

function showLoadError(error) {
    const message =
        error && error.message
            ? error.message
            : "Unknown initialization error.";

    console.error("[THE SEEKER]", message);

    if (DOM.loadError) {
        DOM.loadError.classList.remove("hidden");

        const box = DOM.loadError.querySelector(".box");

        if (box) {
            box.innerHTML = `
                <h2>The game could not initialize.</h2>
                <p>${escapeHTML(message)}</p>
                <small>Check the browser console for details.</small>
            `;
        }
    } else {
        const fallback = document.createElement("div");

        fallback.style.position = "fixed";
        fallback.style.inset = "0";
        fallback.style.zIndex = "999999";
        fallback.style.background = "#050505";
        fallback.style.color = "#eee";
        fallback.style.display = "grid";
        fallback.style.placeItems = "center";
        fallback.style.fontFamily = "Arial, sans-serif";
        fallback.style.padding = "30px";
        fallback.innerHTML = `
            <div>
                <h1>The game could not initialize.</h1>
                <p>${escapeHTML(message)}</p>
                <p>Check the browser console for details.</p>
            </div>
        `;

        document.body.appendChild(fallback);
    }
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ==========================================================================
   MENU
   ========================================================================== */

function setupMenu() {
    if (DOM.playButton) {
        DOM.playButton.addEventListener("click", () => {
            showDeviceSelector();
        });
    }

    if (DOM.instructionsButton) {
        DOM.instructionsButton.addEventListener("click", () => {
            showScreen(DOM.instructionsScreen);
        });
    }

    if (DOM.settingsButton) {
        DOM.settingsButton.addEventListener("click", () => {
            showScreen(DOM.settingsScreen);
        });
    }

    if (DOM.instructionsBack) {
        DOM.instructionsBack.addEventListener("click", () => {
            showScreen(DOM.menuScreen);
        });
    }

    if (DOM.settingsBack) {
        DOM.settingsBack.addEventListener("click", () => {
            showScreen(DOM.menuScreen);
        });
    }
}

function showDeviceSelector() {
    const selector = document.getElementById("deviceSelector");

    if (!selector) {
        startGame();
        return;
    }

    showElement(selector);
}

function showScreen(screen) {
    const screens = [
        DOM.menuScreen,
        DOM.instructionsScreen,
        DOM.settingsScreen
    ];

    for (const item of screens) {
        if (item) {
            item.classList.add("hidden");
        }
    }

    if (screen) {
        screen.classList.remove("hidden");
    }
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */

const SETTINGS = {
    flashlight: true,
    footsteps: true,
    volume: 0.7
};

function setupSettings() {
    if (DOM.flashlightSetting) {
        DOM.flashlightSetting.addEventListener("click", () => {
            SETTINGS.flashlight = !SETTINGS.flashlight;
            DOM.flashlightSetting.textContent =
                SETTINGS.flashlight ? "ON" : "OFF";
        });
    }

    if (DOM.footstepSetting) {
        DOM.footstepSetting.addEventListener("click", () => {
            SETTINGS.footsteps = !SETTINGS.footsteps;
            DOM.footstepSetting.textContent =
                SETTINGS.footsteps ? "ON" : "OFF";
        });
    }

    if (DOM.volumeSetting) {
        DOM.volumeSetting.addEventListener("input", event => {
            const value = Number(event.target.value);

            if (Number.isFinite(value)) {
                SETTINGS.volume = Math.max(0, Math.min(1, value));
            }
        });
    }
}

/* ==========================================================================
   START GAME
   ========================================================================== */

async function startGame() {
    if (STATE.running) return;

    try {
        resetState();

        showElement(DOM.gameScreen);
        hideElement(DOM.menuScreen);
        hideElement(DOM.instructionsScreen);
        hideElement(DOM.settingsScreen);

        configureDevice();

        await setupThree();

        buildWorld();

        setupPlayer();

        setupDemon();

        setupGate();

        setupKey();

        setupButtons();

        setupNotes();

        setupLights();

        setupAudio();

        updateObjective("Find the three buttons.");

        STATE.running = true;
        STATE.paused = false;

        requestPointerLock();

        startGameLoop();

        showToast("The house is quiet.", "normal");

    } catch (error) {
        console.error("[THE SEEKER] Game startup error:", error);
        showLoadError(error);
    }
}

/* ==========================================================================
   RESET
   ========================================================================== */

function resetState() {
    STATE.running = false;
    STATE.paused = false;
    STATE.dead = false;
    STATE.won = false;

    STATE.setupRemaining = CONFIG.game.setupTime;
    STATE.gameTime = 0;

    STATE.sanity = CONFIG.game.startingSanity;
    STATE.noise = 0;
    STATE.hideRemaining = 0;

    STATE.flashlightOn = SETTINGS.flashlight;
    STATE.flashlightBattery = CONFIG.game.flashlightBattery;

    STATE.buttons[1] = false;
    STATE.buttons[2] = false;
    STATE.buttons[3] = false;

    STATE.keyFound = false;
    STATE.gateOpen = false;

    STATE.notes.length = 0;
    STATE.collectedNotes = 0;

    STATE.objective = "Find the three buttons.";
    STATE.interaction = "";

    STATE.demonState = "idle";
    STATE.demonAlert = false;

    STATE.currentRoom = "Main Hall";

    STATE.keys.clear();

    STATE.footstepTimer = 0;
    STATE.footstepIndex = 0;

    if (worldGroup) {
        scene?.remove(worldGroup);
    }

    worldGroup = null;
    collisionObjects = [];
    interactiveObjects = [];

    player = null;
    playerBody = null;
    playerFlashlight = null;
    playerFlashTarget = null;

    demon = null;
    demonBody = null;
    demonHead = null;

    gate = null;
    keyObject = null;
}

/* ==========================================================================
   DEVICE
   ========================================================================== */

function configureDevice() {
    document.body.classList.remove("device-pc");
    document.body.classList.remove("device-mobile");

    if (STATE.device === "mobile") {
        document.body.classList.add("device-mobile");

        showElement(DOM.mobileControls);
        showElement(document.getElementById("mobileDeviceNotice"));
    } else {
        document.body.classList.add("device-pc");

        hideElement(DOM.mobileControls);
        hideElement(document.getElementById("mobileDeviceNotice"));
    }
}

/* ==========================================================================
   THREE SETUP
   ========================================================================== */

async function setupThree() {
    if (!scene) {
        scene = new THREE.Scene();
    } else {
        scene.clear();
    }

    scene.background = new THREE.Color(CONFIG.colors.background);

    scene.fog = new THREE.FogExp2(
        CONFIG.colors.background,
        0.012
    );

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(
        72,
        Math.max(window.innerWidth / Math.max(window.innerHeight, 1), 0.1),
        0.05,
        500
    );

    /*
     * IMPORTANT:
     * Do not call getContext() ourselves.
     * Three.WebGLRenderer handles the WebGL context.
     *
     * The old version could fail when a non-canvas object was assigned
     * to the canvas variable. This version verifies the DOM canvas first.
     */

    if (!(DOM.canvas instanceof HTMLCanvasElement)) {
        throw new Error(
            "gameCanvas must be an HTMLCanvasElement."
        );
    }

    if (renderer) {
        try {
            renderer.dispose();
        } catch (error) {
            console.warn(error);
        }
    }

    renderer = new THREE.WebGLRenderer({
        canvas: DOM.canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(
        Math.max(window.innerWidth, 1),
        Math.max(window.innerHeight, 1),
        false
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;

    renderer.domElement.tabIndex = 0;

    renderer.domElement.addEventListener(
        "contextmenu",
        event => event.preventDefault()
    );

    window.addEventListener("resize", onResize);

    setupPointerLock();
}

/* ==========================================================================
   WORLD
   ========================================================================== */

function buildWorld() {
    worldGroup = new THREE.Group();
    worldGroup.name = "SEEKER_WORLD";

    scene.add(worldGroup);

    buildFloor();
    buildCeiling();
    buildExteriorWalls();

    buildMainHall();
    buildEastWing();
    buildWestWing();
    buildBasementWing();
    buildUpperCorridor();
    buildRooms();
    buildFurniture();
    buildDecorations();
    buildWindows();

    buildWorldLighting();
}

/* ==========================================================================
   FLOOR
   ========================================================================== */

function buildFloor() {
    const size = CONFIG.game.worldSize;

    const geometry = new THREE.PlaneGeometry(
        size,
        size,
        32,
        32
    );

    const material = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.floor,
        roughness: 0.9,
        metalness: 0.05
    });

    const floor = new THREE.Mesh(
        geometry,
        material
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.game.floorY;

    floor.receiveShadow = true;

    worldGroup.add(floor);
}

/* ==========================================================================
   CEILING
   ========================================================================== */

function buildCeiling() {
    const size = CONFIG.game.worldSize;

    const geometry = new THREE.PlaneGeometry(
        size,
        size
    );

    const material = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.ceiling,
        roughness: 1
    });

    const ceiling = new THREE.Mesh(
        geometry,
        material
    );

    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = CONFIG.game.wallHeight;

    worldGroup.add(ceiling);
}

/* ==========================================================================
   WALL HELPERS
   ========================================================================== */

function createWall(
    x,
    y,
    z,
    width,
    height = CONFIG.game.wallHeight,
    depth = CONFIG.game.wallThickness,
    options = {}
) {
    const geometry = new THREE.BoxGeometry(
        width,
        height,
        depth
    );

    const material = new THREE.MeshStandardMaterial({
        color: options.color ?? CONFIG.colors.wall,
        roughness: options.roughness ?? 0.88,
        metalness: options.metalness ?? 0
    });

    const mesh = new THREE.Mesh(
        geometry,
        material
    );

    mesh.position.set(x, y + height / 2, z);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData.collision = options.collision !== false;

    worldGroup.add(mesh);

    if (mesh.userData.collision) {
        collisionObjects.push(mesh);
    }

    return mesh;
}

function createRoom(
    x,
    z,
    width,
    depth,
    options = {}
) {
    const wallHeight =
        options.height ?? CONFIG.game.wallHeight;

    const thickness =
        options.thickness ?? CONFIG.game.wallThickness;

    createWall(
        x,
        0,
        z - depth / 2,
        width,
        wallHeight,
        thickness,
        options
    );

    createWall(
        x,
        0,
        z + depth / 2,
        width,
        wallHeight,
        thickness,
        options
    );

    createWall(
        x - width / 2,
        0,
        z,
        thickness,
        wallHeight,
        depth,
        options
    );

    createWall(
        x + width / 2,
        0,
        z,
        thickness,
        wallHeight,
        depth,
        options
    );
}

/* ==========================================================================
   EXTERIOR
   ========================================================================== */

function buildExteriorWalls() {
    const s = CONFIG.game.worldSize / 2;
    const h = CONFIG.game.wallHeight;
    const t = CONFIG.game.wallThickness;

    createWall(0, 0, -s, CONFIG.game.worldSize, h, t);
    createWall(0, 0, s, CONFIG.game.worldSize, h, t);
    createWall(-s, 0, 0, t, h, CONFIG.game.worldSize);
    createWall(s, 0, 0, t, h, CONFIG.game.worldSize);
}

/* ==========================================================================
   MAIN HALL
   ========================================================================== */

function buildMainHall() {
    createWall(
        -35,
        0,
        -15,
        70,
        CONFIG.game.wallHeight,
        1
    );

    createWall(
        35,
        0,
        -15,
        70,
        CONFIG.game.wallHeight,
        1
    );

    createWall(
        -70,
        0,
        20,
        1,
        CONFIG.game.wallHeight,
        70
    );

    createWall(
        70,
        0,
        20,
        1,
        CONFIG.game.wallHeight,
        70
    );

    createWall(
        0,
        0,
        55,
        140,
        CONFIG.game.wallHeight,
        1
    );

    addFloorRug(0, 8, 16, 55);

    addTable(0, 18);
    addChair(-5, 18, Math.PI / 2);
    addChair(5, 18, -Math.PI / 2);

    addTable(0, -5);
}

/* ==========================================================================
   EAST WING
   ========================================================================== */

function buildEastWing() {
    createRoom(
        100,
        -35,
        45,
        45
    );

    createRoom(
        100,
        25,
        45,
        45
    );

    createRoom(
        100,
        85,
        45,
        35
    );

    addBed(100, -35);
    addTable(92, 25);
    addCabinet(110, 25);

    addBed(100, 85);
}

/* ==========================================================================
   WEST WING
   ========================================================================== */

function buildWestWing() {
    createRoom(
        -100,
        -35,
        45,
        45
    );

    createRoom(
        -100,
        25,
        45,
        45
    );

    createRoom(
        -100,
        85,
        45,
        35
    );

    addBed(-100, -35);
    addTable(-92, 25);
    addCabinet(-110, 25);
    addBed(-100, 85);
}

/* ==========================================================================
   BASEMENT WING
   ========================================================================== */

function buildBasementWing() {
    createRoom(
        0,
        85,
        60,
        35
    );

    createRoom(
        0,
        125,
        60,
        25
    );

    addTable(0, 90);
    addCabinet(-20, 125);
}

/* ==========================================================================
   UPPER CORRIDOR
   ========================================================================== */

function buildUpperCorridor() {
    createWall(
        0,
        0,
        -100,
        140,
        CONFIG.game.wallHeight,
        1
    );

    createWall(
        0,
        0,
        -130,
        140,
        CONFIG.game.wallHeight,
        1
    );

    createWall(
        -70,
        0,
        -115,
        1,
        CONFIG.game.wallHeight,
        30
    );

    createWall(
        70,
        0,
        -115,
        1,
        CONFIG.game.wallHeight,
        30
    );
}

/* ==========================================================================
   ROOMS
   ========================================================================== */

function buildRooms() {
    createRoom(-40, 30, 25, 25);
    createRoom(40, 30, 25, 25);

    createRoom(-40, -35, 25, 25);
    createRoom(40, -35, 25, 25);

    createRoom(-40, 75, 25, 25);
    createRoom(40, 75, 25, 25);

    createRoom(-40, 115, 25, 25);
    createRoom(40, 115, 25, 25);

    createRoom(-40, -115, 25, 25);
    createRoom(40, -115, 25, 25);
}

/* ==========================================================================
   FURNITURE
   ========================================================================== */

function addTable(x, z) {
    const group = new THREE.Group();

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.45, 2.5),
        new THREE.MeshStandardMaterial({
            color: 0x29231a,
            roughness: 0.8
        })
    );

    top.position.y = 2.2;

    group.add(top);

    const legGeometry = new THREE.BoxGeometry(
        0.35,
        2.2,
        0.35
    );

    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            const leg = new THREE.Mesh(
                legGeometry,
                top.material
            );

            leg.position.set(
                sx * 1.8,
                1.1,
                sz * 0.8
            );

            group.add(leg);
        }
    }

    group.position.set(x, 0, z);

    group.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    worldGroup.add(group);

    collisionObjects.push(group);

    return group;
}

function addChair(x, z, rotation = 0) {
    const group = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({
        color: 0x252525,
        roughness: 0.85
    });

    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.3, 1.7),
        material
    );

    seat.position.y = 1.1;

    group.add(seat);

    const back = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 2.2, 0.3),
        material
    );

    back.position.set(
        0,
        2.1,
        -0.7
    );

    group.add(back);

    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    group.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
        }
    });

    worldGroup.add(group);
    collisionObjects.push(group);

    return group;
}

function addBed(x, z) {
    const group = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({
        color: 0x242424,
        roughness: 0.9
    });

    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.9, 12),
        material
    );

    frame.position.y = 0.65;

    group.add(frame);

    const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(6.7, 0.75, 11.5),
        new THREE.MeshStandardMaterial({
            color: 0x3b3b3b,
            roughness: 1
        })
    );

    mattress.position.y = 1.35;

    group.add(mattress);

    group.position.set(x, 0, z);

    group.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    worldGroup.add(group);
    collisionObjects.push(group);

    return group;
}

function addCabinet(x, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 5, 1.5),
        new THREE.MeshStandardMaterial({
            color: 0x202020,
            roughness: 0.9
        })
    );

    mesh.position.set(x, 2.5, z);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    worldGroup.add(mesh);
    collisionObjects.push(mesh);

    return mesh;
}

/* ==========================================================================
   RUGS
   ========================================================================== */

function addFloorRug(x, z, width, depth) {
    const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshStandardMaterial({
            color: 0x1c1714,
            roughness: 1
        })
    );

    rug.rotation.x = -Math.PI / 2;
    rug.position.set(x, 0.012, z);

    worldGroup.add(rug);

    return rug;
}

/* ==========================================================================
   DECORATIONS
   ========================================================================== */

function buildDecorations() {
    for (let i = 0; i < 32; i++) {
        const x =
            -CONFIG.game.worldSize / 2 +
            12 +
            ((i * 37) % 216);

        const z =
            -CONFIG.game.worldSize / 2 +
            12 +
            ((i * 61) % 216);

        if (Math.abs(x) < 12 && Math.abs(z) < 15) {
            continue;
        }

        addCrate(x, z);
    }

    for (let i = 0; i < 18; i++) {
        const x =
            -100 +
            ((i * 17) % 200);

        const z =
            -110 +
            ((i * 31) % 180);

        addPillar(x, z);
    }
}

function addCrate(x, z) {
    const size = 2.2 + Math.random() * 1.2;

    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(
            size,
            size,
            size
        ),
        new THREE.MeshStandardMaterial({
            color: 0x2b241d,
            roughness: 0.95
        })
    );

    crate.position.set(
        x,
        size / 2,
        z
    );

    crate.rotation.y =
        Math.random() * Math.PI;

    crate.castShadow = true;
    crate.receiveShadow = true;

    worldGroup.add(crate);

    collisionObjects.push(crate);
}

function addPillar(x, z) {
    const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.8,
            0.95,
            7,
            12
        ),
        new THREE.MeshStandardMaterial({
            color: 0x202020,
            roughness: 0.85
        })
    );

    pillar.position.set(
        x,
        3.5,
        z
    );

    pillar.castShadow = true;
    pillar.receiveShadow = true;

    worldGroup.add(pillar);

    collisionObjects.push(pillar);
}

/* ==========================================================================
   WINDOWS
   ========================================================================== */

function buildWindows() {
    const positions = [
        [-70, 4, -20],
        [70, 4, -20],
        [-70, 4, 25],
        [70, 4, 25],
        [-100, 4, -60],
        [100, 4, -60]
    ];

    for (const [x, y, z] of positions) {
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 0.25),
            new THREE.MeshStandardMaterial({
                color: 0x303030,
                roughness: 0.7
            })
        );

        frame.position.set(x, y, z);

        worldGroup.add(frame);

        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(3.4, 3.4),
            new THREE.MeshStandardMaterial({
                color: 0x17232c,
                roughness: 0.2,
                metalness: 0.3,
                emissive: 0x061018,
                emissiveIntensity: 0.3
            })
        );

        glass.position.set(
            x,
            y,
            z - 0.15
        );

        worldGroup.add(glass);
    }
}

/* ==========================================================================
   LIGHTING
   ========================================================================== */

function buildWorldLighting() {
    const ambient = new THREE.AmbientLight(
        0x7b8794,
        0.14
    );

    scene.add(ambient);

    const moon = new THREE.DirectionalLight(
        0x9baeca,
        0.28
    );

    moon.position.set(
        -50,
        80,
        -60
    );

    moon.castShadow = true;

    moon.shadow.mapSize.set(
        2048,
        2048
    );

    moon.shadow.camera.left = -120;
    moon.shadow.camera.right = 120;
    moon.shadow.camera.top = 120;
    moon.shadow.camera.bottom = -120;

    scene.add(moon);

    const lights = [
        [-40, 6, -35],
        [40, 6, -35],
        [-40, 6, 35],
        [40, 6, 35],
        [0, 6, 20],
        [0, 6, 85],
        [-100, 6, -35],
        [100, 6, -35]
    ];

    for (const [x, y, z] of lights) {
        addRoomLight(x, y, z);
    }
}

function addRoomLight(x, y, z) {
    const light = new THREE.PointLight(
        0xb9c7d6,
        0.45,
        22,
        2
    );

    light.position.set(x, y, z);

    light.castShadow = true;

    light.shadow.mapSize.set(
        512,
        512
    );

    worldGroup.add(light);

    const fixture = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshBasicMaterial({
            color: 0xd8e3ed
        })
    );

    fixture.position.set(x, y, z);

    worldGroup.add(fixture);
}

/* ==========================================================================
   PLAYER
   ========================================================================== */

function setupPlayer() {
    player = {
        position: new THREE.Vector3(
            0,
            CONFIG.game.playerHeight,
            38
        ),

        velocity: new THREE.Vector3(),

        yaw: 0,
        pitch: 0,

        speed: CONFIG.game.playerSpeed,

        running: false,
        crouching: false,

        height: CONFIG.game.playerHeight
    };

    camera.position.copy(player.position);

    camera.rotation.order = "YXZ";

    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    playerBody = new THREE.Group();
    playerBody.position.copy(player.position);

    scene.add(playerBody);

    setupFlashlight();

    createPlayerDebugMarker();
}

function createPlayerDebugMarker() {
    if (!playerBody) return;

    const geometry = new THREE.ConeGeometry(
        0.15,
        0.4,
        8
    );

    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff
    });

    const marker = new THREE.Mesh(
        geometry,
        material
    );

    marker.rotation.x = Math.PI / 2;
    marker.position.y = -1.7;

    playerBody.add(marker);
}

/* ==========================================================================
   FLASHLIGHT
   ========================================================================== */

function setupFlashlight() {
    playerFlashTarget = new THREE.Object3D();

    playerFlashTarget.position.set(
        0,
        0,
        -15
    );

    camera.add(playerFlashTarget);

    playerFlashlight = new THREE.SpotLight(
        0xffffff,
        3.5,
        55,
        Math.PI / 8,
        0.45,
        1.4
    );

    playerFlashlight.position.set(
        0.1,
        -0.05,
        0
    );

    playerFlashlight.target =
        playerFlashTarget;

    playerFlashlight.castShadow = true;

    playerFlashlight.shadow.mapSize.set(
        1024,
        1024
    );

    camera.add(playerFlashlight);

    scene.add(camera);
}

/* ==========================================================================
   DEMON
   ========================================================================== */

function setupDemon() {
    demon = {
        position: new THREE.Vector3(
            0,
            1.8,
            -115
        ),

        velocity: new THREE.Vector3(),

        state: "waiting",

        speed: CONFIG.game.demonSpeed,

        targetPosition: new THREE.Vector3(),

        lastKnownPlayer: new THREE.Vector3(),

        searchTimer: 0,

        alertTimer: 0,

        pathTimer: 0,

        hearingCooldown: 0
    };

    demonBody = new THREE.Group();

    demonBody.position.copy(
        demon.position
    );

    scene.add(demonBody);

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: CONFIG.colors.demon,
            roughness: 0.8,
            metalness: 0.1
        });

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(
            0.8,
            2.2,
            8,
            16
        ),
        bodyMaterial
    );

    body.position.y = 1.6;

    body.castShadow = true;

    demonBody.add(body);

    demonBody = demonBody;

    demonHead = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.9,
            16,
            16
        ),
        bodyMaterial
    );

    demonHead.position.y = 3.4;

    demonHead.castShadow = true;

    demonBody.add(demonHead);

    addDemonEyes();

    const point = new THREE.PointLight(
        0x5e0a0a,
        0.5,
        12
    );

    point.position.y = 2.2;

    demonBody.add(point);
}

function addDemonEyes() {
    const eyeMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xff3030
        });

    const eyeGeometry =
        new THREE.SphereGeometry(
            0.09,
            8,
            8
        );

    const leftEye = new THREE.Mesh(
        eyeGeometry,
        eyeMaterial
    );

    leftEye.position.set(
        -0.28,
        3.48,
        -0.75
    );

    demonBody.add(leftEye);

    const rightEye = new THREE.Mesh(
        eyeGeometry,
        eyeMaterial
    );

    rightEye.position.set(
        0.28,
        3.48,
        -0.75
    );

    demonBody.add(rightEye);
}

/* ==========================================================================
   GATE
   ========================================================================== */

function setupGate() {
    gate = new THREE.Group();

    gate.position.set(
        0,
        0,
        -138
    );

    const frameMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x252525,
            roughness: 0.8
        });

    const barMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x5a4612,
            metalness: 0.8,
            roughness: 0.3
        });

    const leftPost = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.2,
            8,
            1.2
        ),
        frameMaterial
    );

    leftPost.position.x = -6;
    leftPost.position.y = 4;

    gate.add(leftPost);

    const rightPost = leftPost.clone();

    rightPost.position.x = 6;

    gate.add(rightPost);

    for (let i = -4; i <= 4; i += 2) {
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.45,
                7,
                0.45
            ),
            barMaterial
        );

        bar.position.set(
            i,
            3.5,
            0
        );

        gate.add(bar);
    }

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(
            13,
            0.8,
            1.2
        ),
        frameMaterial
    );

    top.position.y = 7.5;

    gate.add(top);

    gate.traverse(object => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    worldGroup.add(gate);

    collisionObjects.push(gate);
}

/* ==========================================================================
   KEY
   ========================================================================== */

function setupKey() {
    keyObject = new THREE.Group();

    const metalMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xc9a227,
            metalness: 0.85,
            roughness: 0.25,
            emissive: 0x332500,
            emissiveIntensity: 0.3
        });

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
            0.45,
            0.1,
            8,
            24
        ),
        metalMaterial
    );

    ring.rotation.x = Math.PI / 2;

    keyObject.add(ring);

    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.15,
            0.15,
            1.5
        ),
        metalMaterial
    );

    shaft.position.z = 0.7;

    keyObject.add(shaft);

    const tooth1 = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.15,
            0.15,
            0.35
        ),
        metalMaterial
    );

    tooth1.position.set(
        0,
        0,
        1.25
    );

    keyObject.add(tooth1);

    const tooth2 = tooth1.clone();

    tooth2.position.z = 1.45;

    keyObject.add(tooth2);

    keyObject.position.set(
        0,
        2.8,
        92
    );

    worldGroup.add(keyObject);

    interactiveObjects.push({
        type: "key",
        object: keyObject
    });
}

/* ==========================================================================
   BUTTONS
   ========================================================================== */

function setupButtons() {
    createButtonObject(
        1,
        -92,
        24,
        "WEST BUTTON"
    );

    createButtonObject(
        2,
        92,
        24,
        "EAST BUTTON"
    );

    createButtonObject(
        3,
        0,
        92,
        "LOWER BUTTON"
    );
}

function createButtonObject(
    id,
    x,
    z,
    label
) {
    const group = new THREE.Group();

    group.userData.buttonId = id;
    group.userData.type = "button";
    group.userData.label = label;

    const box = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.5,
            1.5,
            0.5
        ),
        new THREE.MeshStandardMaterial({
            color: 0x242424,
            roughness: 0.8
        })
    );

    box.position.y = 1.4;

    group.add(box);

    const button = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.38,
            0.38,
            0.18,
            20
        ),
        new THREE.MeshStandardMaterial({
            color: CONFIG.colors.red,
            emissive: 0x250000,
            emissiveIntensity: 0.25
        })
    );

    button.rotation.x = Math.PI / 2;

    button.position.set(
        0,
        1.4,
        -0.3
    );

    group.add(button);

    group.position.set(
        x,
        0,
        z
    );

    group.userData.buttonMesh = button;

    worldGroup.add(group);

    interactiveObjects.push({
        type: "button",
        id,
        object: group,
        mesh: button
    });
}

/* ==========================================================================
   NOTES
   ========================================================================== */

function setupNotes() {
    const noteData = [
        {
            x: -40,
            y: 1.7,
            z: -35,
            text: "The house is much larger than it looks from outside."
        },
        {
            x: 40,
            y: 1.7,
            z: 35,
            text: "The three switches control the old gate."
        },
        {
            x: 0,
            y: 1.7,
            z: 90,
            text: "Do not stay in one place for too long."
        },
        {
            x: -100,
            y: 1.7,
            z: 25,
            text: "Something in the halls reacts to sound."
        }
    ];

    for (let i = 0; i < noteData.length; i++) {
        createNote(
            i + 1,
            noteData[i]
        );
    }
}

function createNote(id, data) {
    const group = new THREE.Group();

    const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(
            1.1,
            1.4
        ),
        new THREE.MeshStandardMaterial({
            color: 0xcfc7ae,
            roughness: 1,
            side: THREE.DoubleSide
        })
    );

    paper.rotation.x = -Math.PI / 2;

    group.add(paper);

    group.position.set(
        data.x,
        data.y,
        data.z
    );

    group.userData.noteId = id;
    group.userData.text = data.text;

    worldGroup.add(group);

    interactiveObjects.push({
        type: "note",
        id,
        object: group,
        text: data.text
    });
}

/* ==========================================================================
   AUDIO
   ========================================================================== */

const AUDIO = {
    footstep: null,
    initialized: false
};

function setupAudio() {
    try {
        if (!AUDIO.footstep) {
            AUDIO.footstep = new Audio(
                CONFIG.audio.footstep
            );

            AUDIO.footstep.preload = "auto";
            AUDIO.footstep.volume =
                SETTINGS.volume * CONFIG.audio.volume;
        }

        AUDIO.initialized = true;

    } catch (error) {
        console.warn(
            "[THE SEEKER] Audio setup failed:",
            error
        );
    }
}

function playFootstep() {
    if (!SETTINGS.footsteps) return;
    if (!AUDIO.footstep) return;

    try {
        const sound = AUDIO.footstep.cloneNode();

        sound.volume =
            SETTINGS.volume * 0.5;

        sound.currentTime = 0;

        const promise = sound.play();

        if (promise && promise.catch) {
            promise.catch(() => {});
        }

    } catch (error) {
        console.warn(
            "[THE SEEKER] Footstep playback failed:",
            error
        );
    }
}

/* ==========================================================================
   GAME CONTROLS
   ========================================================================== */

function setupGameControls() {
    window.addEventListener(
        "keydown",
        event => {
            handleKeyDown(event);
        }
    );

    window.addEventListener(
        "keyup",
        event => {
            handleKeyUp(event);
        }
    );

    setupMobileControls();
}

function handleKeyDown(event) {
    const key = event.key.toLowerCase();

    STATE.keys.add(key);

    if (
        key === "escape" &&
        STATE.running &&
        !STATE.dead &&
        !STATE.won
    ) {
        togglePause();
    }

    if (key === "e") {
        tryInteract();
    }

    if (key === "f") {
        toggleFlashlight();
    }

    if (key === "shift") {
        if (STATE.device === "pc") {
            STATE.keys.add("run");
        }
    }

    if (key === "control") {
        STATE.keys.add("crouch");
    }
}

function handleKeyUp(event) {
    const key = event.key.toLowerCase();

    STATE.keys.delete(key);

    if (key === "shift") {
        STATE.keys.delete("run");
    }

    if (key === "control") {
        STATE.keys.delete("crouch");
    }
}

/* ==========================================================================
   MOBILE CONTROLS
   ========================================================================== */

function setupMobileControls() {
    if (!DOM.joystickZone) return;

    DOM.joystickZone.addEventListener(
        "pointerdown",
        event => {
            event.preventDefault();

            STATE.joystick.active = true;
            STATE.joystick.pointerId =
                event.pointerId;

            DOM.joystickZone.setPointerCapture(
                event.pointerId
            );

            updateJoystick(event);
        }
    );

    DOM.joystickZone.addEventListener(
        "pointermove",
        event => {
            if (
                !STATE.joystick.active ||
                STATE.joystick.pointerId !== event.pointerId
            ) {
                return;
            }

            updateJoystick(event);
        }
    );

    const stopJoystick = event => {
        if (
            STATE.joystick.pointerId !== event.pointerId
        ) {
            return;
        }

        STATE.joystick.active = false;
        STATE.joystick.pointerId = null;
        STATE.joystick.x = 0;
        STATE.joystick.y = 0;

        resetJoystickVisual();
    };

    DOM.joystickZone.addEventListener(
        "pointerup",
        stopJoystick
    );

    DOM.joystickZone.addEventListener(
        "pointercancel",
        stopJoystick
    );

    if (DOM.mobileRun) {
        DOM.mobileRun.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();
                STATE.keys.add("run");
            }
        );

        DOM.mobileRun.addEventListener(
            "pointerup",
            event => {
                event.preventDefault();
                STATE.keys.delete("run");
            }
        );

        DOM.mobileRun.addEventListener(
            "pointercancel",
            () => {
                STATE.keys.delete("run");
            }
        );
    }

    if (DOM.mobileInteract) {
        DOM.mobileInteract.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();
                tryInteract();
            }
        );
    }

    if (DOM.mobileFlashlight) {
        DOM.mobileFlashlight.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();
                toggleFlashlight();
            }
        );
    }

    if (DOM.lookZone) {
        DOM.lookZone.addEventListener(
            "pointerdown",
            event => {
                event.preventDefault();

                STATE.look.active = true;
                STATE.look.pointerId =
                    event.pointerId;

                STATE.look.lastX =
                    event.clientX;

                STATE.look.lastY =
                    event.clientY;

                DOM.lookZone.setPointerCapture(
                    event.pointerId
                );
            }
        );

        DOM.lookZone.addEventListener(
            "pointermove",
            event => {
                if (
                    !STATE.look.active ||
                    STATE.look.pointerId !== event.pointerId
                ) {
                    return;
                }

                const dx =
                    event.clientX -
                    STATE.look.lastX;

                const dy =
                    event.clientY -
                    STATE.look.lastY;

                STATE.look.lastX =
                    event.clientX;

                STATE.look.lastY =
                    event.clientY;

                rotateCamera(
                    dx * 0.004,
                    dy * 0.004
                );
            }
        );

        const stopLook = event => {
            if (
                STATE.look.pointerId !== event.pointerId
            ) {
                return;
            }

            STATE.look.active = false;
            STATE.look.pointerId = null;
        };

        DOM.lookZone.addEventListener(
            "pointerup",
            stopLook
        );

        DOM.lookZone.addEventListener(
            "pointercancel",
            stopLook
        );
    }
}

function updateJoystick(event) {
    if (!DOM.joystickBase) return;

    const rect =
        DOM.joystickBase.getBoundingClientRect();

    const centerX =
        rect.left + rect.width / 2;

    const centerY =
        rect.top + rect.height / 2;

    let dx =
        event.clientX -
        centerX;

    let dy =
        event.clientY -
        centerY;

    const radius =
        Math.min(rect.width, rect.height) / 2;

    const distance =
        Math.sqrt(dx * dx + dy * dy);

    if (distance > radius) {
        const scale =
            radius / distance;

        dx *= scale;
        dy *= scale;
    }

    STATE.joystick.x =
        dx / radius;

    STATE.joystick.y =
        dy / radius;

    if (DOM.joystickKnob) {
        DOM.joystickKnob.style.transform =
            `translate(${dx}px, ${dy}px)`;
    }
}

function resetJoystickVisual() {
    if (DOM.joystickKnob) {
        DOM.joystickKnob.style.transform =
            "translate(0px, 0px)";
    }
}

/* ==========================================================================
   POINTER LOCK
   ========================================================================== */

function setupPointerLock() {
    if (!renderer?.domElement) return;

    renderer.domElement.addEventListener(
        "click",
        () => {
            if (
                STATE.device === "pc" &&
                STATE.running &&
                !STATE.paused
            ) {
                requestPointerLock();
            }
        }
    );

    document.addEventListener(
        "mousemove",
        event => {
            if (
                STATE.device !== "pc" ||
                document.pointerLockElement !== renderer?.domElement ||
                !STATE.running ||
                STATE.paused
            ) {
                return;
            }

            rotateCamera(
                event.movementX * 0.0025,
                event.movementY * 0.0025
            );
        }
    );
}

function requestPointerLock() {
    if (
        STATE.device !== "pc" ||
        !renderer?.domElement
    ) {
        return;
    }

    if (
        document.pointerLockElement !==
        renderer.domElement
    ) {
        try {
            renderer.domElement.requestPointerLock();
        } catch (error) {
            console.warn(
                "[THE SEEKER] Pointer lock unavailable:",
                error
            );
        }
    }
}

function rotateCamera(yawDelta, pitchDelta) {
    if (!camera || !player) return;

    player.yaw -= yawDelta;
    player.pitch -= pitchDelta;

    const limit =
        Math.PI / 2 - 0.08;

    player.pitch =
        Math.max(
            -limit,
            Math.min(limit, player.pitch)
        );

    camera.rotation.order = "YXZ";

    camera.rotation.y =
        player.yaw;

    camera.rotation.x =
        player.pitch;
}

/* ==========================================================================
   GAME LOOP
   ========================================================================== */

function startGameLoop() {
    if (!renderer || !scene || !camera) {
        throw new Error(
            "Renderer, scene, or camera is missing."
        );
    }

    requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    if (!STATE.running) {
        return;
    }

    const current =
        performance.now();

    if (!STATE.lastTime) {
        STATE.lastTime = current;
    }

    STATE.delta =
        Math.min(
            (current - STATE.lastTime) / 1000,
            0.05
        );

    STATE.lastTime = current;

    if (
        STATE.paused ||
        STATE.dead ||
        STATE.won
    ) {
        renderGame();
        return;
    }

    updateGame(
        STATE.delta
    );

    renderGame();
}

function updateGame(delta) {
    STATE.gameTime += delta;

    updateSetupTimer(delta);

    updatePlayer(delta);

    updateDemon(delta);

    updateInteractions();

    updateSanity(delta);

    updateNoise(delta);

    updateFlashlight(delta);

    updateHideTimer(delta);

    updateObjectiveState();

    updateHUD();

    updateMinimap();

    updateDemonHUD();

    updateRoomName();

    updateAudioEffects(delta);

    checkWinCondition();
}

/* ==========================================================================
   PLAYER UPDATE
   ========================================================================== */

function updatePlayer(delta) {
    if (!player) return;

    const movement =
        getMovementInput();

    const moving =
        movement.lengthSq() > 0.001;

    const running =
        STATE.keys.has("run") &&
        !STATE.keys.has("crouch") &&
        moving;

    const crouching =
        STATE.keys.has("crouch");

    player.running = running;
    player.crouching = crouching;

    let speed =
        CONFIG.game.playerSpeed;

    if (crouching) {
        speed =
            CONFIG.game.crouchSpeed;
    } else if (running) {
        speed =
            CONFIG.game.playerRunSpeed;
    }

    const forward =
        new THREE.Vector3(
            0,
            0,
            -1
        );

    const right =
        new THREE.Vector3(
            1,
            0,
            0
        );

    forward.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        player.yaw
    );

    right.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        player.yaw
    );

    const desired =
        new THREE.Vector3();

    desired.addScaledVector(
        forward,
        -movement.z
    );

    desired.addScaledVector(
        right,
        movement.x
    );

    if (desired.lengthSq() > 1) {
        desired.normalize();
    }

    desired.multiplyScalar(speed);

    const acceleration =
        moving ? 18 : 25;

    player.velocity.x =
        THREE.MathUtils.damp(
            player.velocity.x,
            desired.x,
            acceleration,
            delta
        );

    player.velocity.z =
        THREE.MathUtils.damp(
            player.velocity.z,
            desired.z,
            acceleration,
            delta
        );

    const oldPosition =
        player.position.clone();

    player.position.x +=
        player.velocity.x * delta;

    if (
        checkPlayerCollision()
    ) {
        player.position.x =
            oldPosition.x;
    }

    player.position.z +=
        player.velocity.z * delta;

    if (
        checkPlayerCollision()
    ) {
        player.position.z =
            oldPosition.z;
    }

    player.position.y =
        crouching
            ? 1.15
            : CONFIG.game.playerHeight;

    camera.position.copy(
        player.position
    );

    updateFootsteps(
        delta,
        moving,
        running
    );

    updatePlayerBody();
}

function getMovementInput() {
    let x = 0;
    let z = 0;

    if (STATE.device === "mobile") {
        x = STATE.joystick.x;
        z = STATE.joystick.y;
    } else {
        if (
            STATE.keys.has("a") ||
            STATE.keys.has("arrowleft")
        ) {
            x -= 1;
        }

        if (
            STATE.keys.has("d") ||
            STATE.keys.has("arrowright")
        ) {
            x += 1;
        }

        if (
            STATE.keys.has("w") ||
            STATE.keys.has("arrowup")
        ) {
            z -= 1;
        }

        if (
            STATE.keys.has("s") ||
            STATE.keys.has("arrowdown")
        ) {
            z += 1;
        }
    }

    return new THREE.Vector3(
        x,
        0,
        z
    );
}

function updatePlayerBody() {
    if (!playerBody) return;

    playerBody.position.copy(
        player.position
    );
}

function checkPlayerCollision() {
    if (!player) return false;

    const playerPosition =
        new THREE.Vector3(
            player.position.x,
            1,
            player.position.z
        );

    for (
        const object
        of collisionObjects
    ) {
        if (!object) continue;
        if (!object.visible) continue;

        const box =
            new THREE.Box3().setFromObject(
                object
            );

        box.expandByScalar(
            CONFIG.game.playerRadius
        );

        if (
            box.containsPoint(
                playerPosition
            )
        ) {
            return true;
        }
    }

    return false;
}

/* ==========================================================================
   FOOTSTEPS
   ========================================================================== */

function updateFootsteps(
    delta,
    moving,
    running
) {
    if (!moving) {
        STATE.footstepTimer = 0;
        return;
    }

    const interval =
        running
            ? 0.28
            : player.crouching
                ? 0.65
                : 0.48;

    STATE.footstepTimer += delta;

    if (
        STATE.footstepTimer >= interval
    ) {
        STATE.footstepTimer = 0;

        playFootstep();

        addNoise(
            running
                ? 28
                : player.crouching
                    ? 4
                    : 13
        );
    }
}

/* ==========================================================================
   SETUP TIMER
   ========================================================================== */

function updateSetupTimer(delta) {
    if (
        STATE.setupRemaining <= 0
    ) {
        return;
    }

    STATE.setupRemaining =
        Math.max(
            0,
            STATE.setupRemaining - delta
        );

    if (
        STATE.setupRemaining <= 0 &&
        demon
    ) {
        demon.state = "searching";
        STATE.demonState = "searching";

        showToast(
            "Something is moving inside the house.",
            "danger"
        );

        updateObjective(
            "Find the three buttons and stay quiet."
        );
    }
}

/* ==========================================================================
   DEMON AI
   ========================================================================== */

function updateDemon(delta) {
    if (!demon || !demonBody) return;

    if (
        STATE.setupRemaining > 0
    ) {
        demon.state = "waiting";
        STATE.demonState = "waiting";

        return;
    }

    demon.hearingCooldown =
        Math.max(
            0,
            demon.hearingCooldown - delta
        );

    const distance =
        demon.position.distanceTo(
            player.position
        );

    const canSee =
        canDemonSeePlayer();

    const heard =
        canDemonHearPlayer();

    if (
        canSee ||
        heard ||
        STATE.noise > 55
    ) {
        demon.state = "chasing";
        demon.alertTimer = 4;
        demon.lastKnownPlayer.copy(
            player.position
        );
    } else if (
        demon.alertTimer > 0
    ) {
        demon.alertTimer -= delta;
        demon.state = "searching";
    } else if (
        demon.state === "chasing"
    ) {
        demon.state = "searching";
    }

    STATE.demonState =
        demon.state;

    if (
        demon.state === "chasing"
    ) {
        demon.speed =
            CONFIG.game.demonChaseSpeed;

        demon.targetPosition.copy(
            player.position
        );

    } else if (
        demon.state === "searching"
    ) {
        demon.speed =
            CONFIG.game.demonSpeed;

        if (
            demon.pathTimer <= 0
        ) {
            demon.pathTimer =
                3 + Math.random() * 3;

            chooseSearchPoint();
        }

        demon.pathTimer -= delta;

    } else {
        return;
    }

    moveDemon(delta);

    if (
        distance < 2.2
    ) {
        triggerDeath(
            "The Seeker caught up with you."
        );
    }
}

function canDemonSeePlayer() {
    if (!player || !demon) return false;

    const distance =
        demon.position.distanceTo(
            player.position
        );

    if (
        distance >
        CONFIG.game.demonSightDistance
    ) {
        return false;
    }

    if (
        STATE.hideRemaining > 0
    ) {
        return false;
    }

    const direction =
        new THREE.Vector3()
            .subVectors(
                player.position,
                demon.position
            )
            .normalize();

    const demonForward =
        new THREE.Vector3(
            0,
            0,
            -1
        );

    demonForward.applyQuaternion(
        demonBody.quaternion
    );

    const angle =
        demonForward.angleTo(
            direction
        );

    if (
        angle >
        CONFIG.game.demonSightAngle
    ) {
        return false;
    }

    const ray =
        new THREE.Raycaster(
            demon.position.clone()
                .add(new THREE.Vector3(0, 2, 0)),
            direction,
            0,
            distance
        );

    const targets =
        collisionObjects.filter(
            object =>
                object &&
                object.visible &&
                object !== gate
        );

    const hits =
        ray.intersectObjects(
            targets,
            true
        );

    if (hits.length > 0) {
        return false;
    }

    return true;
}

function canDemonHearPlayer() {
    if (!player || !demon) return false;

    if (
        demon.hearingCooldown > 0
    ) {
        return false;
    }

    const distance =
        demon.position.distanceTo(
            player.position
        );

    if (
        distance >
        CONFIG.game.demonHearDistance
    ) {
        return false;
    }

    if (
        STATE.noise < 15
    ) {
        return false;
    }

    demon.hearingCooldown = 1.2;

    return true;
}

function chooseSearchPoint() {
    if (!demon) return;

    if (
        demon.lastKnownPlayer.lengthSq() > 0
    ) {
        demon.targetPosition.copy(
            demon.lastKnownPlayer
        );

        return;
    }

    demon.targetPosition.set(
        (Math.random() - 0.5) *
            CONFIG.game.worldSize *
            0.8,
        1.8,
        (Math.random() - 0.5) *
            CONFIG.game.worldSize *
            0.8
    );
}

function moveDemon(delta) {
    const current =
        demon.position;

    const target =
        demon.targetPosition;

    const direction =
        new THREE.Vector3()
            .subVectors(
                target,
                current
            );

    direction.y = 0;

    if (
        direction.lengthSq() < 0.2
    ) {
        return;
    }

    direction.normalize();

    const next =
        current.clone();

    next.x +=
        direction.x *
        demon.speed *
        delta;

    next.z +=
        direction.z *
        demon.speed *
        delta;

    if (
        !checkDemonCollision(next)
    ) {
        demon.position.copy(
            next
        );
    } else {
        const side =
            new THREE.Vector3(
                -direction.z,
                0,
                direction.x
            );

        const alternative =
            current.clone()
                .addScaledVector(
                    side,
                    demon.speed * delta
                );

        if (
            !checkDemonCollision(
                alternative
            )
        ) {
            demon.position.copy(
                alternative
            );
        }
    }

    demonBody.position.copy(
        demon.position
    );

    const lookTarget =
        new THREE.Vector3(
            player.position.x,
            demon.position.y,
            player.position.z
        );

    demonBody.lookAt(
        lookTarget
    );
}

function checkDemonCollision(position) {
    const point =
        new THREE.Vector3(
            position.x,
            1,
            position.z
        );

    for (
        const object
        of collisionObjects
    ) {
        if (!object || !object.visible) continue;

        const box =
            new THREE.Box3().setFromObject(
                object
            );

        box.expandByScalar(0.55);

        if (
            box.containsPoint(point)
        ) {
            return true;
        }
    }

    return false;
}

/* ==========================================================================
   INTERACTION
   ========================================================================== */

function updateInteractions() {
    if (!player) return;

    let closest = null;
    let closestDistance =
        Infinity;

    for (
        const interactive
        of interactiveObjects
    ) {
        if (!interactive?.object) continue;

        if (
            interactive.type === "button" &&
            STATE.buttons[interactive.id]
        ) {
            continue;
        }

        if (
            interactive.type === "key" &&
            STATE.keyFound
        ) {
            continue;
        }

        const position =
            new THREE.Vector3();

        interactive.object.getWorldPosition(
            position
        );

        const distance =
            player.position.distanceTo(
                position
            );

        if (
            distance <
            CONFIG.game.interactionDistance &&
            distance <
            closestDistance
        ) {
            closest =
                interactive;

            closestDistance =
                distance;
        }
    }

    if (closest) {
        let text = "INTERACT";

        if (
            closest.type === "button"
        ) {
            text =
                `PRESS E — BUTTON ${closest.id}`;
        }

        if (
            closest.type === "key"
        ) {
            text =
                "PRESS E — TAKE KEY";
        }

        if (
            closest.type === "note"
        ) {
            text =
                "PRESS E — READ NOTE";
        }

        if (
            closest.type === "gate"
        ) {
            text =
                "PRESS E — OPEN GATE";
        }

        STATE.interaction =
            text;

        showInteraction(text);

    } else {
        STATE.interaction = "";

        hideInteraction();
    }
}

function tryInteract() {
    if (
        !STATE.running ||
        STATE.paused ||
        STATE.dead ||
        STATE.won
    ) {
        return;
    }

    const nearest =
        findNearestInteractive();

    if (!nearest) {
        return;
    }

    switch (nearest.type) {
        case "button":
            activateButton(
                nearest.id,
                nearest
            );
            break;

        case "key":
            collectKey();
            break;

        case "note":
            collectNote(
                nearest
            );
            break;

        case "gate":
            attemptGate();
            break;

        default:
            break;
    }
}

function findNearestInteractive() {
    if (!player) return null;

    let nearest = null;
    let distance = Infinity;

    for (
        const interactive
        of interactiveObjects
    ) {
        if (!interactive?.object) continue;

        if (
            interactive.type === "button" &&
            STATE.buttons[interactive.id]
        ) {
            continue;
        }

        if (
            interactive.type === "key" &&
            STATE.keyFound
        ) {
            continue;
        }

        const position =
            new THREE.Vector3();

        interactive.object.getWorldPosition(
            position
        );

        const d =
            player.position.distanceTo(
                position
            );

        if (
            d <
            CONFIG.game.interactionDistance &&
            d <
            distance
        ) {
            nearest =
                interactive;

            distance = d;
        }
    }

    if (
        gate &&
        !STATE.gateOpen
    ) {
        const gatePosition =
            new THREE.Vector3();

        gate.getWorldPosition(
            gatePosition
        );

        const gateDistance =
            player.position.distanceTo(
                gatePosition
            );

        if (
            gateDistance <
                CONFIG.game.gateDistance &&
            gateDistance <
                distance
        ) {
            nearest = {
                type: "gate",
                object: gate
            };
        }
    }

    return nearest;
}

/* ==========================================================================
   BUTTON ACTIVATION
   ========================================================================== */

function activateButton(
    id,
    interactive
) {
    if (
        STATE.buttons[id]
    ) {
        return;
    }

    STATE.buttons[id] = true;

    if (
        interactive?.mesh
    ) {
        interactive.mesh.material.color.setHex(
            CONFIG.colors.green
        );

        interactive.mesh.material.emissive.setHex(
            0x061d0c
        );

        interactive.mesh.material.emissiveIntensity =
            0.8;
    }

    updateButtonHUD();

    addNoise(35);

    if (
        Object.values(
            STATE.buttons
        ).every(Boolean)
    ) {
        STATE.keyFound = false;

        updateObjective(
            "All three buttons are active. Find the key."
        );

        revealKey();

        showToast(
            "A lock somewhere in the house released.",
            "success"
        );

    } else {
        const remaining =
            Object.values(
                STATE.buttons
            ).filter(
                value => !value
            ).length;

        updateObjective(
            `Find the remaining ${remaining} button${remaining === 1 ? "" : "s"}.`
        );

        showToast(
            `Button ${id} activated.`,
            "success"
        );
    }
}

function revealKey() {
    if (!keyObject) return;

    keyObject.visible = true;

    const light =
        new THREE.PointLight(
            0xffd45a,
            1.2,
            8
        );

    light.position.copy(
        keyObject.position
    );

    worldGroup.add(light);
}

function updateButtonHUD() {
    setButtonState(
        DOM.button1,
        STATE.buttons[1]
    );

    setButtonState(
        DOM.button2,
        STATE.buttons[2]
    );

    setButtonState(
        DOM.button3,
        STATE.buttons[3]
    );
}

function setButtonState(element, active) {
    if (!element) return;

    element.textContent =
        active
            ? "ACTIVE"
            : "OFF";

    element.classList.toggle(
        "active",
        active
    );
}

/* ==========================================================================
   KEY
   ========================================================================== */

function collectKey() {
    if (
        !Object.values(
            STATE.buttons
        ).every(Boolean)
    ) {
        showToast(
            "The key is locked until all three buttons are active.",
            "danger"
        );

        return;
    }

    STATE.keyFound = true;

    if (keyObject) {
        keyObject.visible = false;
    }

    updateObjective(
        "You have the key. Reach the gate."
    );

    addNoise(20);

    showToast(
        "You found the gate key.",
        "success"
    );
}

/* ==========================================================================
   GATE
   ========================================================================== */

function attemptGate() {
    if (STATE.gateOpen) {
        return;
    }

    if (!STATE.keyFound) {
        showToast(
            "The gate is locked.",
            "danger"
        );

        return;
    }

    STATE.gateOpen = true;

    animateGateOpen();

    updateObjective(
        "Escape through the gate."
    );

    showToast(
        "The gate is opening.",
        "success"
    );

    addNoise(55);
}

function animateGateOpen() {
    if (!gate) return;

    const startY =
        gate.rotation.y;

    const startTime =
        performance.now();

    const duration = 1800;

    function animate() {
        if (!gate) return;

        const elapsed =
            performance.now() -
            startTime;

        const progress =
            Math.min(
                elapsed / duration,
                1
            );

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );

        gate.rotation.y =
            startY +
            eased *
            Math.PI *
            0.75;

        if (
            progress < 1
        ) {
            requestAnimationFrame(
                animate
            );
        } else {
            gate.visible = false;

            collisionObjects =
                collisionObjects.filter(
                    object =>
                        object !== gate
                );
        }
    }

    animate();
}

/* ==========================================================================
   NOTES
   ========================================================================== */

function collectNote(note) {
    if (!note) return;

    if (
        STATE.notes.includes(
            note.id
        )
    ) {
        return;
    }

    STATE.notes.push(
        note.id
    );

    STATE.collectedNotes =
        STATE.notes.length;

    showNoteToast(
        note.text
    );

    updateHUD();

    addNoise(3);
}

function showNoteToast(text) {
    if (
        DOM.noteToast &&
        DOM.noteToastText
    ) {
        DOM.noteToastText.textContent =
            text;

        DOM.noteToast.classList.remove(
            "hidden"
        );

        clearTimeout(
            DOM.noteToast._timeout
        );

        DOM.noteToast._timeout =
            setTimeout(
                () => {
                    DOM.noteToast?.classList.add(
                        "hidden"
                    );
                },
                5000
            );
    }

    addNoteToLog(text);
}

function addNoteToLog(text) {
    if (!DOM.notesLogList) return;

    const item =
        document.createElement("div");

    item.className =
        "notes-log-entry";

    item.textContent =
        text;

    DOM.notesLogList.appendChild(
        item
    );
}

/* ==========================================================================
   OBJECTIVE
   ========================================================================== */

function updateObjective(text) {
    STATE.objective = text;

    setObjectiveText(text);
}

function setObjectiveText(text) {
    if (DOM.objective) {
        DOM.objective.textContent =
            text;
    }
}

function updateObjectiveState() {
    if (
        STATE.won ||
        STATE.dead
    ) {
        return;
    }

    if (
        !STATE.buttons[1] ||
        !STATE.buttons[2] ||
        !STATE.buttons[3]
    ) {
        return;
    }

    if (
        !STATE.keyFound
    ) {
        if (
            STATE.objective !==
            "All three buttons are active. Find the key."
        ) {
            updateObjective(
                "All three buttons are active. Find the key."
            );
        }

        return;
    }

    if (
        !STATE.gateOpen
    ) {
        updateObjective(
            "You have the key. Reach the gate."
        );
    }
}

/* ==========================================================================
   SANITY
   ========================================================================== */

function updateSanity(delta) {
    if (!player || !demon) return;

    const demonDistance =
        player.position.distanceTo(
            demon.position
        );

    if (
        STATE.demonState === "chasing" &&
        demonDistance < 40
    ) {
        const intensity =
            1 -
            Math.min(
                demonDistance / 40,
                1
            );

        STATE.sanity -=
            CONFIG.game.sanityDrain *
            intensity *
            delta;
    } else if (
        STATE.demonState === "waiting"
    ) {
        STATE.sanity +=
            CONFIG.game.sanityRecover *
            delta;
    } else {
        STATE.sanity +=
            CONFIG.game.sanityRecover *
            0.4 *
            delta;
    }

    STATE.sanity =
        Math.max(
            0,
            Math.min(
                100,
                STATE.sanity
            )
        );

    if (
        STATE.sanity < 20
    ) {
        STATE.dangerEffect = true;
    } else {
        STATE.dangerEffect = false;
    }
}

/* ==========================================================================
   NOISE
   ========================================================================== */

function addNoise(amount) {
    STATE.noise =
        Math.min(
            CONFIG.game.maxNoise,
            STATE.noise + amount
        );
}

function updateNoise(delta) {
    STATE.noise =
        Math.max(
            0,
            STATE.noise -
                CONFIG.game.noiseDecay *
                delta
        );
}

/* ==========================================================================
   FLASHLIGHT
   ========================================================================== */

function toggleFlashlight() {
    if (!SETTINGS.flashlight) {
        showToast(
            "Flashlight disabled in settings.",
            "danger"
        );

        return;
    }

    if (
        STATE.flashlightBattery <= 0
    ) {
        showToast(
            "The flashlight battery is empty.",
            "danger"
        );

        return;
    }

    STATE.flashlightOn =
        !STATE.flashlightOn;

    updateFlashlightVisual();
}

function updateFlashlight(delta) {
    if (
        !SETTINGS.flashlight
    ) {
        STATE.flashlightOn = false;
    }

    if (
        STATE.flashlightOn &&
        STATE.flashlightBattery > 0
    ) {
        STATE.flashlightBattery -=
            CONFIG.game.flashlightDrain *
            delta;

        if (
            STATE.flashlightBattery <= 0
        ) {
            STATE.flashlightBattery = 0;
            STATE.flashlightOn = false;

            showToast(
                "The flashlight battery is empty.",
                "danger"
            );
        }
    }

    updateFlashlightVisual();
}

function updateFlashlightVisual() {
    if (!playerFlashlight) return;

    playerFlashlight.visible =
        STATE.flashlightOn &&
        STATE.flashlightBattery > 0;

    playerFlashlight.intensity =
        STATE.flashlightOn
            ? 3.5
            : 0;

    const fill =
        document.getElementById(
            "batteryFill"
        );

    const text =
        document.getElementById(
            "batteryText"
        );

    const battery =
        Math.max(
            0,
            Math.round(
                STATE.flashlightBattery
            )
        );

    if (fill) {
        fill.style.width =
            `${battery}%`;
    }

    if (text) {
        text.textContent =
            `${battery}%`;
    }
}

/* ==========================================================================
   HIDING
   ========================================================================== */

function updateHideTimer(delta) {
    if (
        STATE.hideRemaining <= 0
    ) {
        hideElement(
            DOM.hideTimer
        );

        return;
    }

    STATE.hideRemaining =
        Math.max(
            0,
            STATE.hideRemaining -
                delta
        );

    showElement(
        DOM.hideTimer
    );

    if (DOM.hideTimerValue) {
        DOM.hideTimerValue.textContent =
            Math.ceil(
                STATE.hideRemaining
            );
    }

    if (
        STATE.hideRemaining <= 0
    ) {
        showToast(
            "You are exposed again.",
            "danger"
        );
    }
}

/* ==========================================================================
   ROOM DETECTION
   ========================================================================== */

function updateRoomName() {
    if (!player) return;

    const x = player.position.x;
    const z = player.position.z;

    let room = "MAIN HALL";

    if (x < -70) {
        room = "WEST WING";
    } else if (x > 70) {
        room = "EAST WING";
    } else if (z > 70) {
        room = "LOWER WING";
    } else if (z < -80) {
        room = "UPPER CORRIDOR";
    }

    STATE.currentRoom =
        room;

    const element =
        document.getElementById(
            "minimapRoom"
        );

    if (element) {
        element.textContent =
            room;
    }
}

/* ==========================================================================
   MINIMAP
   ========================================================================== */

function updateMinimap() {
    if (!player || !demon) return;

    const playerMarker =
        document.getElementById(
            "playerMarker"
        );

    const demonMarker =
        document.getElementById(
            "demonMarker"
        );

    if (!playerMarker || !demonMarker) {
        return;
    }

    const mapSize =
        CONFIG.game.worldSize;

    const mapX =
        value =>
            50 +
            (value / mapSize) *
            100;

    const mapY =
        value =>
            50 +
            (value / mapSize) *
            100;

    const px =
        Math.max(
            4,
            Math.min(
                96,
                mapX(player.position.x)
            )
        );

    const py =
        Math.max(
            4,
            Math.min(
                96,
                mapY(player.position.z)
            )
        );

    const dx =
        Math.max(
            4,
            Math.min(
                96,
                mapX(demon.position.x)
            )
        );

    const dy =
        Math.max(
            4,
            Math.min(
                96,
                mapY(demon.position.z)
            )
        );

    playerMarker.style.left =
        `${px}%`;

    playerMarker.style.top =
        `${py}%`;

    demonMarker.style.left =
        `${dx}%`;

    demonMarker.style.top =
        `${dy}%`;

    playerMarker.style.transform =
        `translate(-50%, -50%) rotate(${
            player.yaw
        }rad)`;

    demonMarker.style.transform =
        `translate(-50%, -50%) rotate(${
            demonBody?.rotation.y || 0
        }rad)`;
}

/* ==========================================================================
   DEMON HUD
   ========================================================================== */

function updateDemonHUD() {
    const text =
        document.getElementById(
            "demonStatusText"
        );

    const dot =
        document.getElementById(
            "demonStatusDot"
        );

    if (!text || !dot) return;

    let message =
        "THE SEEKER IS WAITING";

    if (
        STATE.demonState === "searching"
    ) {
        message =
            "THE SEEKER IS SEARCHING";
    }

    if (
        STATE.demonState === "chasing"
    ) {
        message =
            "THE SEEKER HEARS YOU";
    }

    text.textContent =
        message;

    dot.className =
        STATE.demonState === "chasing"
            ? "danger"
            : STATE.demonState === "searching"
                ? "searching"
                : "";
}

/* ==========================================================================
   HUD
   ========================================================================== */

function updateHUD() {
    updateButtonHUD();

    if (DOM.notesCount) {
        DOM.notesCount.textContent =
            String(
                STATE.collectedNotes
            );
    }

    updateSanityHUD();
    updateNoiseHUD();
    updateTimerHUD();
    updateFlashlightVisual();
}

function updateSanityHUD() {
    if (!DOM.sanityFill) return;

    DOM.sanityFill.style.width =
        `${STATE.sanity}%`;
}

function updateNoiseHUD() {
    if (!DOM.noiseFill) return;

    DOM.noiseFill.style.width =
        `${STATE.noise}%`;
}

function updateTimerHUD() {
    if (!DOM.timer) return;

    const total =
        Math.max(
            0,
            Math.ceil(
                STATE.setupRemaining
            )
        );

    if (
        total > 0
    ) {
        const minutes =
            Math.floor(
                total / 60
            );

        const seconds =
            total % 60;

        DOM.timer.textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    } else {
        DOM.timer.textContent =
            "THE SEEKER IS ACTIVE";
    }
}

function showInteraction(text) {
    if (
        DOM.interaction &&
        DOM.interactionText
    ) {
        DOM.interactionText.textContent =
            text;

        DOM.interaction.classList.remove(
            "hidden"
        );
    }
}

function hideInteraction() {
    if (DOM.interaction) {
        DOM.interaction.classList.add(
            "hidden"
        );
    }
}

/* ==========================================================================
   AUDIO / ATMOSPHERE EFFECTS
   ========================================================================== */

function updateAudioEffects(delta) {
    if (
        !renderer ||
        !camera
    ) {
        return;
    }

    if (
        STATE.demonState === "chasing"
    ) {
        const distance =
            player?.position.distanceTo(
                demon?.position
            ) ?? 999;

        const strength =
            Math.max(
                0,
                1 -
                    distance / 40
            );

        if (DOM.dangerWarning) {
            DOM.dangerWarning.style.opacity =
                String(
                    Math.min(
                        1,
                        strength * 1.2
                    )
                );
        }

    } else if (
        DOM.dangerWarning
    ) {
        DOM.dangerWarning.style.opacity =
            "0";
    }
}

/* ==========================================================================
   PAUSE
   ========================================================================== */

function setupOverlayControls() {
    if (DOM.resumeButton) {
        DOM.resumeButton.addEventListener(
            "click",
            () => {
                resumeGame();
            }
        );
    }

    if (DOM.notesLogButton) {
        DOM.notesLogButton.addEventListener(
            "click",
            () => {
                showNotesLog();
            }
        );
    }

    if (DOM.quitButton) {
        DOM.quitButton.addEventListener(
            "click",
            () => {
                quitToMenu();
            }
        );
    }

    if (DOM.notesLogBack) {
        DOM.notesLogBack.addEventListener(
            "click",
            () => {
                hideElement(
                    DOM.notesLogScreen
                );

                showElement(
                    DOM.pauseScreen
                );
            }
        );
    }

    if (DOM.retryButton) {
        DOM.retryButton.addEventListener(
            "click",
            () => {
                hideElement(
                    DOM.deathScreen
                );

                startGame();
            }
        );
    }

    if (DOM.deathMenuButton) {
        DOM.deathMenuButton.addEventListener(
            "click",
            () => {
                quitToMenu();
            }
        );
    }

    if (DOM.winAgainButton) {
        DOM.winAgainButton.addEventListener(
            "click",
            () => {
                hideElement(
                    DOM.winScreen
                );

                startGame();
            }
        );
    }

    if (DOM.winMenuButton) {
        DOM.winMenuButton.addEventListener(
            "click",
            () => {
                quitToMenu();
            }
        );
    }
}

function togglePause() {
    if (
        !STATE.running ||
        STATE.dead ||
        STATE.won
    ) {
        return;
    }

    if (STATE.paused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    STATE.paused = true;

    showElement(
        DOM.pauseScreen
    );

    if (
        document.pointerLockElement
    ) {
        try {
            document.exitPointerLock();
        } catch (error) {
            console.warn(error);
        }
    }
}

function resumeGame() {
    STATE.paused = false;

    hideElement(
        DOM.pauseScreen
    );

    hideElement(
        DOM.notesLogScreen
    );

    requestPointerLock();
}

function showNotesLog() {
    hideElement(
        DOM.pauseScreen
    );

    showElement(
        DOM.notesLogScreen
    );

    if (
        DOM.notesLogList &&
        STATE.notes.length === 0
    ) {
        DOM.notesLogList.innerHTML = "";

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "notes-log-empty";

        empty.textContent =
            "No notes collected.";

        DOM.notesLogList.appendChild(
            empty
        );
    }
}

/* ==========================================================================
   DEATH
   ========================================================================== */

function triggerDeath(reason) {
    if (
        STATE.dead ||
        STATE.won
    ) {
        return;
    }

    STATE.dead = true;
    STATE.running = true;

    if (DOM.deathReason) {
        DOM.deathReason.textContent =
            reason;
    }

    showElement(
        DOM.deathScreen
    );

    hideElement(
        DOM.pauseScreen
    );

    if (
        document.pointerLockElement
    ) {
        try {
            document.exitPointerLock();
        } catch (error) {}
    }

    showToast(
        reason,
        "danger"
    );
}

/* ==========================================================================
   WIN
   ========================================================================== */

function checkWinCondition() {
    if (
        !STATE.gateOpen ||
        STATE.won ||
        STATE.dead ||
        !player
    ) {
        return;
    }

    if (
        player.position.z <
        -132
    ) {
        triggerWin();
    }
}

function triggerWin() {
    if (
        STATE.won
    ) {
        return;
    }

    STATE.won = true;

    STATE.objective =
        "Escape complete.";

    if (DOM.winTitle) {
        DOM.winTitle.textContent =
            "YOU ESCAPED";
    }

    if (DOM.winText) {
        const minutes =
            Math.floor(
                STATE.gameTime / 60
            );

        const seconds =
            Math.floor(
                STATE.gameTime % 60
            );

        DOM.winText.textContent =
            `You escaped in ${minutes}:${String(seconds).padStart(2, "0")}.`;
    }

    showElement(
        DOM.winScreen
    );

    if (
        document.pointerLockElement
    ) {
        try {
            document.exitPointerLock();
        } catch (error) {}
    }
}

/* ==========================================================================
   QUIT
   ========================================================================== */

function quitToMenu() {
    STATE.running = false;
    STATE.paused = false;

    hideElement(
        DOM.gameScreen
    );

    hideElement(
        DOM.pauseScreen
    );

    hideElement(
        DOM.notesLogScreen
    );

    hideElement(
        DOM.deathScreen
    );

    hideElement(
        DOM.winScreen
    );

    hideElement(
        DOM.mobileControls
    );

    hideElement(
        document.getElementById(
            "seekerMinimap"
        )
    );

    hideElement(
        document.getElementById(
            "flashlightBatteryHUD"
        )
    );

    hideElement(
        document.getElementById(
            "demonStatusHUD"
        )
    );

    showScreen(
        DOM.menuScreen
    );

    if (
        document.pointerLockElement
    ) {
        try {
            document.exitPointerLock();
        } catch (error) {}
    }

    if (
        renderer?.domElement
    ) {
        renderer.domElement.style.display =
            "";
    }
}

/* ==========================================================================
   TOASTS
   ========================================================================== */

function showToast(
    message,
    type = "normal"
) {
    const container =
        document.getElementById(
            "seekerToastContainer"
        );

    if (!container) return;

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `seeker-toast ${type}`;

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    requestAnimationFrame(
        () => {
            toast.classList.add(
                "visible"
            );
        }
    );

    setTimeout(
        () => {
            toast.classList.remove(
                "visible"
            );

            setTimeout(
                () => {
                    toast.remove();
                },
                300
            );
        },
        3500
    );
}

/* ==========================================================================
   RENDER
   ========================================================================== */

function renderGame() {
    if (
        !renderer ||
        !scene ||
        !camera
    ) {
        return;
    }

    renderer.render(
        scene,
        camera
    );
}

/* ==========================================================================
   RESIZE
   ========================================================================== */

function onResize() {
    if (
        !camera ||
        !renderer
    ) {
        return;
    }

    const width =
        Math.max(
            window.innerWidth,
            1
        );

    const height =
        Math.max(
            window.innerHeight,
            1
        );

    camera.aspect =
        width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(
        width,
        height,
        false
    );

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            2
        )
    );
}

/* ==========================================================================
   UTILITY DOM FUNCTIONS
   ========================================================================== */

function showElement(element) {
    if (!element) return;

    element.classList.remove(
        "hidden"
    );
}

function hideElement(element) {
    if (!element) return;

    element.classList.add(
        "hidden"
    );
}

/* ==========================================================================
   DEBUG HELPERS
   ========================================================================== */

window.SeekerGame = {
    state: STATE,

    player: () =>
        player,

    demon: () =>
        demon,

    scene: () =>
        scene,

    renderer: () =>
        renderer,

    activateButton,

    collectKey,

    attemptGate,

    pause: pauseGame,

    resume: resumeGame,

    reset: () => {
        quitToMenu();
        resetState();
    }
};

/* ==========================================================================
   STARTUP
   ========================================================================== */

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

/* ==========================================================================
   END
   ========================================================================== */