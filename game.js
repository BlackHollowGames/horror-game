import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";


/* =========================================================
   ELEMENTS
========================================================= */

const menuScreen =
    document.getElementById("menuScreen");

const instructionsScreen =
    document.getElementById("instructionsScreen");

const settingsScreen =
    document.getElementById("settingsScreen");

const gameScreen =
    document.getElementById("gameScreen");

const gameCanvas =
    document.getElementById("gameCanvas");

const instructionsButton =
    document.getElementById("instructionsButton");

const instructionsBack =
    document.getElementById("instructionsBack");

const settingsButton =
    document.getElementById("settingsButton");

const settingsBack =
    document.getElementById("settingsBack");

const playButton =
    document.getElementById("playButton");

const flashlightSetting =
    document.getElementById("flashlightSetting");

const footstepSetting =
    document.getElementById("footstepSetting");

const volumeSetting =
    document.getElementById("volumeSetting");

const objective =
    document.getElementById("objective");

const timerElement =
    document.getElementById("timer");

const interactionText =
    document.getElementById("interactionText");

const noiseFill =
    document.getElementById("noiseFill");

const dangerWarning =
    document.getElementById("dangerWarning");

const pauseScreen =
    document.getElementById("pauseScreen");

const deathScreen =
    document.getElementById("deathScreen");

const winScreen =
    document.getElementById("winScreen");

const resumeButton =
    document.getElementById("resumeButton");

const quitButton =
    document.getElementById("quitButton");

const retryButton =
    document.getElementById("retryButton");

const deathMenuButton =
    document.getElementById("deathMenuButton");

const winAgainButton =
    document.getElementById("winAgainButton");

const winMenuButton =
    document.getElementById("winMenuButton");

const deathReason =
    document.getElementById("deathReason");

const buttonIndicators = [
    document.getElementById("button1"),
    document.getElementById("button2"),
    document.getElementById("button3")
];


/* =========================================================
   AUDIO
========================================================= */

const footstepAudio =
    new Audio("./footstep.mp3");

footstepAudio.preload = "auto";
footstepAudio.volume = 0.45;

let audioEnabled = true;
let masterVolume = 0.45;
let footstepTimer = 0;


/* =========================================================
   THREE.JS
========================================================= */

let scene;
let camera;
let renderer;
let clock;

let flashlight;
let demon;

const walls = [];
const interactables = [];
const hidingSpots = [];

let player;


/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;
let gamePaused = false;
let gameEnded = false;

let timeLeft = 180;

let buttonsFound = [
    false,
    false,
    false
];

let keyCollected = false;
let gateOpen = false;

let flashlightOn = true;

let noise = 0;

let demonState = "idle";

let demonTarget = null;
let demonLastHeard = null;

let demonSearchTimer = 0;
let demonHearCooldown = 0;

let keyObject = null;
let gateObject = null;


/* =========================================================
   CONSTANTS
========================================================= */

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.34;

const PLAYER_START =
    new THREE.Vector3(
        0,
        PLAYER_HEIGHT,
        18
    );

const GATE_POSITION =
    new THREE.Vector3(
        0,
        1.5,
        -20
    );


/* =========================================================
   MENU
========================================================= */

instructionsButton.addEventListener(
    "click",
    () => {
        menuScreen.classList.add("hidden");

        instructionsScreen.classList.remove(
            "hidden"
        );
    }
);

instructionsBack.addEventListener(
    "click",
    () => {
        instructionsScreen.classList.add(
            "hidden"
        );

        menuScreen.classList.remove(
            "hidden"
        );
    }
);

settingsButton.addEventListener(
    "click",
    () => {
        menuScreen.classList.add(
            "hidden"
        );

        settingsScreen.classList.remove(
            "hidden"
        );
    }
);

settingsBack.addEventListener(
    "click",
    () => {
        settingsScreen.classList.add(
            "hidden"
        );

        menuScreen.classList.remove(
            "hidden"
        );
    }
);

flashlightSetting.addEventListener(
    "change",
    () => {
        flashlightOn =
            flashlightSetting.checked;

        if (flashlight) {
            flashlight.visible =
                flashlightOn;
        }
    }
);

footstepSetting.addEventListener(
    "change",
    () => {
        audioEnabled =
            footstepSetting.checked;
    }
);

volumeSetting.addEventListener(
    "input",
    () => {
        masterVolume =
            Number(volumeSetting.value) / 100;

        footstepAudio.volume =
            masterVolume * 0.55;
    }
);

playButton.addEventListener(
    "click",
    startGame
);

retryButton.addEventListener(
    "click",
    restartGame
);

winAgainButton.addEventListener(
    "click",
    restartGame
);

deathMenuButton.addEventListener(
    "click",
    returnToMenu
);

winMenuButton.addEventListener(
    "click",
    returnToMenu
);

resumeButton.addEventListener(
    "click",
    resumeGame
);

quitButton.addEventListener(
    "click",
    returnToMenu
);


/* =========================================================
   KEYBOARD
========================================================= */

const keys = {};

document.addEventListener(
    "keydown",
    event => {

        keys[event.code] = true;

        if (
            event.code === "Escape" &&
            gameRunning &&
            !gameEnded
        ) {
            if (gamePaused) {
                resumeGame();
            } else {
                pauseGame();
            }
        }

        if (
            event.code === "KeyF" &&
            gameRunning &&
            !gamePaused &&
            !gameEnded
        ) {
            flashlightOn =
                !flashlightOn;

            flashlight.visible =
                flashlightOn;

            flashlightSetting.checked =
                flashlightOn;
        }

        if (
            event.code === "KeyE" &&
            gameRunning &&
            !gamePaused &&
            !gameEnded
        ) {
            interact();
        }
    }
);

document.addEventListener(
    "keyup",
    event => {
        keys[event.code] = false;
    }
);


/* =========================================================
   INITIALIZE
========================================================= */

initialize();


function initialize() {

    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x020304
        );

    scene.fog =
        new THREE.FogExp2(
            0x020304,
            0.035
        );


    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
            window.innerHeight,
            0.05,
            100
        );


    renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            powerPreference:
                "high-performance"
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
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

    gameCanvas.appendChild(
        renderer.domElement
    );


    clock =
        new THREE.Clock();


    createWorld();

    createPlayer();

    createDemon();

    createFlashlight();


    window.addEventListener(
        "resize",
        resizeGame
    );


    renderer.domElement.addEventListener(
        "click",
        () => {

            if (
                gameRunning &&
                !gamePaused &&
                !gameEnded
            ) {
                renderer.domElement
                    .requestPointerLock();
            }
        }
    );


    document.addEventListener(
        "mousemove",
        event => {

            if (
                document.pointerLockElement !==
                renderer.domElement
            ) {
                return;
            }

            if (
                !gameRunning ||
                gamePaused ||
                gameEnded
            ) {
                return;
            }

            camera.rotation.y -=
                event.movementX *
                0.002;

            camera.rotation.x -=
                event.movementY *
                0.002;

            camera.rotation.x =
                THREE.MathUtils.clamp(
                    camera.rotation.x,
                    -1.45,
                    1.45
                );
        }
    );


    animate();
}


/* =========================================================
   WORLD
========================================================= */

function createWorld() {

    const ambient =
        new THREE.HemisphereLight(
            0x667180,
            0x020202,
            0.28
        );

    scene.add(ambient);


    const moon =
        new THREE.DirectionalLight(
            0x8b98a6,
            0.22
        );

    moon.position.set(
        10,
        20,
        5
    );

    moon.castShadow = true;

    scene.add(moon);


    createFloor();

    createBuilding();

    createDecorations();

    createButtons();

    createGate();

    createHidingSpots();
}


function createFloor() {

    const geometry =
        new THREE.PlaneGeometry(
            60,
            60
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x151718,
            roughness: 0.95
        });

    const floor =
        new THREE.Mesh(
            geometry,
            material
        );

    floor.rotation.x =
        -Math.PI / 2;

    floor.receiveShadow = true;

    scene.add(floor);


    const grid =
        new THREE.GridHelper(
            60,
            60,
            0x292c2e,
            0x101112
        );

    grid.position.y =
        0.01;

    scene.add(grid);
}


function createBuilding() {

    const height = 4;


    addWall(
        0,
        height / 2,
        -24,
        50,
        height,
        1
    );

    addWall(
        -25,
        height / 2,
        0,
        1,
        height,
        50
    );

    addWall(
        25,
        height / 2,
        0,
        1,
        height,
        50
    );


    addWall(
        -18,
        height / 2,
        24,
        14,
        height,
        1
    );

    addWall(
        18,
        height / 2,
        24,
        14,
        height,
        1
    );


    addWall(
        -17,
        height / 2,
        15,
        1,
        height,
        18
    );

    addWall(
        17,
        height / 2,
        15,
        1,
        height,
        18
    );


    addWall(
        -17,
        height / 2,
        -6,
        1,
        height,
        18
    );

    addWall(
        17,
        height / 2,
        -6,
        1,
        height,
        18
    );


    addWall(
        -8,
        height / 2,
        -14,
        18,
        height,
        1
    );

    addWall(
        8,
        height / 2,
        -14,
        18,
        height,
        1
    );


    addWall(
        -8,
        height / 2,
        3,
        18,
        height,
        1
    );

    addWall(
        8,
        height / 2,
        3,
        18,
        height,
        1
    );


    addWall(
        0,
        height / 2,
        10,
        16,
        height,
        1
    );


    addWall(
        -8,
        height / 2,
        -21,
        16,
        height,
        1
    );

    addWall(
        8,
        height / 2,
        -21,
        16,
        height,
        1
    );
}


function addWall(
    x,
    y,
    z,
    width,
    height,
    depth
) {

    const geometry =
        new THREE.BoxGeometry(
            width,
            height,
            depth
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x272a2c,
            roughness: 0.9
        });

    const wall =
        new THREE.Mesh(
            geometry,
            material
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


/* =========================================================
   DECORATION
========================================================= */

function createDecorations() {

    const pillars = [
        [-21, 19],
        [21, 19],
        [-21, -2],
        [21, -2],
        [-13, -18],
        [13, -18],
        [-13, 7],
        [13, 7]
    ];


    for (const position of pillars) {
        createPillar(
            position[0],
            position[1]
        );
    }


    const crates = [
        [-20, 17],
        [-19, 15],
        [19, 17],
        [20, -4],
        [-14, -17],
        [14, -17],
        [-12, 6],
        [12, 6],
        [-20, -18],
        [20, 17]
    ];


    for (const position of crates) {
        createCrate(
            position[0],
            position[1]
        );
    }


    createCeilingLights();
}


function createPillar(
    x,
    z
) {

    const geometry =
        new THREE.CylinderGeometry(
            0.55,
            0.55,
            4,
            8
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x141617,
            roughness: 1
        });

    const pillar =
        new THREE.Mesh(
            geometry,
            material
        );

    pillar.position.set(
        x,
        2,
        z
    );

    pillar.castShadow = true;

    scene.add(pillar);
}


function createCrate(
    x,
    z
) {

    const geometry =
        new THREE.BoxGeometry(
            1.4,
            1.4,
            1.4
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x30302d,
            roughness: 1
        });

    const crate =
        new THREE.Mesh(
            geometry,
            material
        );

    crate.position.set(
        x,
        0.7,
        z
    );

    crate.rotation.y =
        Math.random();

    crate.castShadow = true;

    scene.add(crate);
}


function createCeilingLights() {

    const positions = [
        [-12, 18],
        [12, 18],
        [-12, 0],
        [12, 0],
        [0, -18]
    ];


    for (const position of positions) {

        const light =
            new THREE.PointLight(
                0x8f9aa5,
                1.15,
                12
            );

        light.position.set(
            position[0],
            3.7,
            position[1]
        );

        light.castShadow = true;

        scene.add(light);


        const bulb =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.7,
                    0.08,
                    0.7
                ),
                new THREE.MeshBasicMaterial({
                    color: 0xbac3c8
                })
            );

        bulb.position.copy(
            light.position
        );

        scene.add(bulb);
    }
}


/* =========================================================
   BUTTONS
========================================================= */

function createButtons() {

    createButton(
        -13,
        17,
        0
    );

    createButton(
        13,
        -1,
        1
    );

    createButton(
        -13,
        -18,
        2
    );
}


function createButton(
    x,
    z,
    index
) {

    const group =
        new THREE.Group();

    group.position.set(
        x,
        1.4,
        z
    );


    const panel =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.65,
                0.9,
                0.18
            ),
            new THREE.MeshStandardMaterial({
                color: 0x111213,
                roughness: 0.8
            })
        );


    const button =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.18,
                0.18,
                0.1,
                20
            ),
            new THREE.MeshStandardMaterial({
                color: 0x650000,
                emissive: 0x100000
            })
        );


    button.rotation.x =
        Math.PI / 2;

    button.position.z =
        -0.14;


    group.add(panel);
    group.add(button);

    scene.add(group);


    interactables.push({
        type: "button",
        index,
        object: group,
        buttonMesh: button,
        position: group.position,
        pressed: false
    });
}


/* =========================================================
   GATE
========================================================= */

function createGate() {

    gateObject =
        new THREE.Group();

    gateObject.position.copy(
        GATE_POSITION
    );


    for (
        let x = -3;
        x <= 3;
        x++
    ) {

        const bar =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.25,
                    3.4,
                    0.25
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x101112,
                    metalness: 0.7,
                    roughness: 0.4
                })
            );

        bar.position.x =
            x * 1.2;

        bar.castShadow = true;

        gateObject.add(bar);
    }


    const top =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                9,
                0.3,
                0.3
            ),
            new THREE.MeshStandardMaterial({
                color: 0x101112,
                metalness: 0.7
            })
        );

    top.position.y =
        1.65;

    gateObject.add(top);

    scene.add(gateObject);


    interactables.push({
        type: "gate",
        position: GATE_POSITION
    });
}


/* =========================================================
   HIDING SPOTS
========================================================= */

function createHidingSpots() {

    const positions = [
        [-20, 10],
        [20, 10],
        [-20, -14],
        [20, -14]
    ];


    for (const position of positions) {

        const box =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    2,
                    2,
                    1.5
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x0b0c0d,
                    roughness: 1
                })
            );

        box.position.set(
            position[0],
            1,
            position[1]
        );

        box.castShadow = true;

        scene.add(box);


        hidingSpots.push({
            object: box,
            position: box.position
        });
    }
}


/* =========================================================
   PLAYER
========================================================= */

function createPlayer() {

    player = {
        position:
            PLAYER_START.clone(),

        speed: 3.2,

        runSpeed: 5.8,

        bob: 0,

        hidden: false
    };


    camera.position.copy(
        player.position
    );
}


/* =========================================================
   DEMON
========================================================= */

function createDemon() {

    demon = {
        position:
            new THREE.Vector3(
                0,
                0,
                -5
            ),

        speed: 1.75,

        chaseSpeed: 3.2,

        state: "idle",

        lastHeard: null,

        searchTimer: 0
    };


    const demonGroup =
        new THREE.Group();


    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 1
        });


    const body =
        new THREE.Mesh(
            new THREE.CapsuleGeometry(
                0.55,
                1.4,
                4,
                10
            ),
            bodyMaterial
        );

    body.position.y =
        1;

    body.castShadow = true;

    demonGroup.add(body);


    const head =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.5,
                16,
                16
            ),
            bodyMaterial
        );

    head.position.y =
        2.05;

    head.scale.set(
        0.85,
        1.15,
        0.85
    );

    head.castShadow = true;

    demonGroup.add(head);


    const eyeMaterial =
        new THREE.MeshBasicMaterial({
            color: 0xff0000
        });


    const eyeGeometry =
        new THREE.SphereGeometry(
            0.055,
            8,
            8
        );


    const leftEye =
        new THREE.Mesh(
            eyeGeometry,
            eyeMaterial
        );

    leftEye.position.set(
        -0.17,
        2.12,
        -0.43
    );


    const rightEye =
        new THREE.Mesh(
            eyeGeometry,
            eyeMaterial
        );

    rightEye.position.set(
        0.17,
        2.12,
        -0.43
    );


    demonGroup.add(leftEye);
    demonGroup.add(rightEye);


    demonGroup.position.copy(
        demon.position
    );

    scene.add(demonGroup);

    demon.object =
        demonGroup;
}


/* =========================================================
   FLASHLIGHT
========================================================= */

function createFlashlight() {

    flashlight =
        new THREE.SpotLight(
            0xffffff,
            5,
            22,
            Math.PI / 7,
            0.45,
            1.2
        );

    flashlight.castShadow = true;

    scene.add(flashlight);

    scene.add(
        flashlight.target
    );
}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

    resetGameState();

    menuScreen.classList.add(
        "hidden"
    );

    instructionsScreen.classList.add(
        "hidden"
    );

    settingsScreen.classList.add(
        "hidden"
    );

    gameScreen.classList.remove(
        "hidden"
    );

    pauseScreen.classList.add(
        "hidden"
    );

    deathScreen.classList.add(
        "hidden"
    );

    winScreen.classList.add(
        "hidden"
    );


    gameRunning = true;
    gamePaused = false;
    gameEnded = false;


    camera.position.copy(
        PLAYER_START
    );

    camera.rotation.set(
        0,
        0,
        0
    );


    if (
        renderer.domElement.requestPointerLock
    ) {
        renderer.domElement
            .requestPointerLock();
    }


    updateObjective();
}


/* =========================================================
   RESET
========================================================= */

function resetGameState() {

    timeLeft = 180;

    buttonsFound = [
        false,
        false,
        false
    ];

    keyCollected = false;

    gateOpen = false;

    noise = 0;

    demonState = "idle";

    demonLastHeard = null;

    demonSearchTimer = 0;

    demonHearCooldown = 0;

    footstepTimer = 0;


    player.position.copy(
        PLAYER_START
    );

    player.hidden = false;


    demon.position.set(
        0,
        0,
        -5
    );


    if (gateObject) {
        gateObject.position.y =
            GATE_POSITION.y;
    }


    if (keyObject) {
        scene.remove(
            keyObject
        );

        keyObject = null;
    }


    for (
        const item of interactables
    ) {

        if (
            item.type === "button"
        ) {

            item.pressed = false;

            item.buttonMesh.material.color.set(
                0x650000
            );

            item.buttonMesh.material.emissive.set(
                0x100000
            );
        }
    }


    buttonIndicators.forEach(
        indicator => {
            indicator.classList.remove(
                "active"
            );
        }
    );


    dangerWarning.classList.remove(
        "show"
    );


    flashlightOn =
        flashlightSetting.checked;

    flashlight.visible =
        flashlightOn;
}


/* =========================================================
   MAIN LOOP
========================================================= */

function animate() {

    requestAnimationFrame(
        animate
    );


    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );


    if (
        gameRunning &&
        !gamePaused &&
        !gameEnded
    ) {

        updateGame(
            delta
        );
    }


    updateFlashlight();


    renderer.render(
        scene,
        camera
    );
}


/* =========================================================
   GAME UPDATE
========================================================= */

function updateGame(delta) {

    timeLeft -= delta;

    if (timeLeft <= 0) {

        timeLeft = 0;

        loseGame(
            "THE SEARCH HAS BEGUN."
        );

        return;
    }


    updateTimer();

    updatePlayer(delta);

    updateNoise(delta);

    updateDemon(delta);

    updateInteractions();

    updateObjective();
}


/* =========================================================
   TIMER
========================================================= */

function updateTimer() {

    const minutes =
        Math.floor(
            timeLeft / 60
        );

    const seconds =
        Math.floor(
            timeLeft % 60
        );


    timerElement.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


    if (timeLeft <= 30) {
        timerElement.style.color =
            "#ff2222";
    } else {
        timerElement.style.color =
            "#fff";
    }
}


/* =========================================================
   PLAYER MOVEMENT
========================================================= */

function updatePlayer(delta) {

    if (player.hidden) {
        return;
    }


    const input =
        new THREE.Vector3();


    if (keys["KeyW"]) {
        input.z -= 1;
    }

    if (keys["KeyS"]) {
        input.z += 1;
    }

    if (keys["KeyA"]) {
        input.x -= 1;
    }

    if (keys["KeyD"]) {
        input.x += 1;
    }


    const moving =
        input.lengthSq() > 0;


    const running =
        keys["ShiftLeft"] ||
        keys["ShiftRight"];


    if (moving) {

        input.normalize();


        const rotation =
            camera.rotation.y;


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
            new THREE.Vector3(0,1,0),
            rotation
        );

        right.applyAxisAngle(
            new THREE.Vector3(0,1,0),
            rotation
        );


        const movement =
            new THREE.Vector3();


        movement.addScaledVector(
            forward,
            -input.z
        );

        movement.addScaledVector(
            right,
            input.x
        );


        movement.normalize();


        const speed =
            running
                ? player.runSpeed
                : player.speed;


        const next =
            player.position
                .clone()
                .addScaledVector(
                    movement,
                    speed * delta
                );


        if (
            !collidesWithWalls(
                next
            )
        ) {

            player.position.copy(
                next
            );
        }


        player.position.x =
            THREE.MathUtils.clamp(
                player.position.x,
                -23,
                23
            );

        player.position.z =
            THREE.MathUtils.clamp(
                player.position.z,
                -22,
                22
            );


        player.bob +=
            delta *
            (running ? 13 : 8);


        camera.position.copy(
            player.position
        );


        camera.position.y =
            PLAYER_HEIGHT +
            Math.sin(
                player.bob
            ) *
            (running
                ? 0.055
                : 0.025);


        noise =
            Math.min(
                1,
                noise +
                delta *
                (running
                    ? 1.5
                    : 0.55)
            );


        updateFootsteps(
            delta,
            running
        );

    } else {

        noise =
            Math.max(
                0,
                noise -
                delta * 1.7
            );

        footstepTimer = 0;

        camera.position.copy(
            player.position
        );
    }
}


/* =========================================================
   FOOTSTEP AUDIO
========================================================= */

function updateFootsteps(
    delta,
    running
) {

    if (!audioEnabled) {
        return;
    }


    footstepTimer -= delta;


    if (footstepTimer > 0) {
        return;
    }


    footstepTimer =
        running
            ? 0.27
            : 0.42;


    footstepAudio.pause();

    footstepAudio.currentTime = 0;

    footstepAudio.volume =
        masterVolume *
        (running ? 0.6 : 0.42);


    footstepAudio
        .play()
        .catch(() => {
            /*
             * Browser autoplay rules can reject
             * audio until the user interacts.
             * The PLAY button supplies that
             * interaction, so this normally works.
             */
        });
}


/* =========================================================
   WALL COLLISION
========================================================= */

function collidesWithWalls(
    position
) {

    const playerBox =
        new THREE.Box3(
            new THREE.Vector3(
                position.x -
                    PLAYER_RADIUS,
                0,
                position.z -
                    PLAYER_RADIUS
            ),
            new THREE.Vector3(
                position.x +
                    PLAYER_RADIUS,
                2,
                position.z +
                    PLAYER_RADIUS
            )
        );


    for (
        const wall of walls
    ) {

        const box =
            new THREE.Box3()
                .setFromObject(
                    wall
                );


        if (
            playerBox.intersectsBox(
                box
            )
        ) {

            return true;
        }
    }


    if (!gateOpen) {

        const gateBox =
            new THREE.Box3(
                new THREE.Vector3(
                    -4.5,
                    0,
                    -21.5
                ),
                new THREE.Vector3(
                    4.5,
                    4,
                    -20.5
                )
            );


        if (
            playerBox.intersectsBox(
                gateBox
            )
        ) {

            return true;
        }
    }


    return false;
}


/* =========================================================
   NOISE
========================================================= */

function updateNoise(delta) {

    noiseFill.style.width =
        `${Math.round(noise * 100)}%`;


    demonHearCooldown =
        Math.max(
            0,
            demonHearCooldown -
                delta
        );


    if (
        noise > 0.65 &&
        demonState !== "chase"
    ) {

        demonHearPlayer();
    }
}


function demonHearPlayer() {

    if (
        demonHearCooldown > 0
    ) {
        return;
    }


    const distance =
        demon.position.distanceTo(
            player.position
        );


    if (distance > 15) {
        return;
    }


    demonHearCooldown = 1.8;

    demonState = "search";

    demonLastHeard =
        player.position.clone();

    demonSearchTimer = 7;


    dangerWarning.textContent =
        "IT HEARD YOU";

    dangerWarning.classList.add(
        "show"
    );


    setTimeout(
        () => {
            if (
                demonState !== "chase"
            ) {
                dangerWarning.classList.remove(
                    "show"
                );
            }
        },
        1000
    );
}


/* =========================================================
   DEMON AI
========================================================= */

function updateDemon(delta) {

    const distance =
        demon.position.distanceTo(
            player.position
        );


    if (
        distance < 9 &&
        canDemonSeePlayer()
    ) {

        demonState =
            "chase";
    }


    if (
        demonState === "idle"
    ) {

        demonIdle(delta);
    }


    if (
        demonState === "search"
    ) {

        demonSearch(delta);
    }


    if (
        demonState === "chase"
    ) {

        demonChase(delta);
    }


    const demonDistance =
        demon.position.distanceTo(
            player.position
        );


    if (
        demonDistance < 1.25 &&
        !player.hidden
    ) {

        loseGame(
            "THE SEEKER FOUND YOU."
        );

        return;
    }


    demon.object.position.copy(
        demon.position
    );


    const lookTarget =
        player.position.clone();

    lookTarget.y = 1.2;

    demon.object.lookAt(
        lookTarget
    );
}


function demonIdle(delta) {

    moveDemon(
        new THREE.Vector3(
            0,
            0,
            -5
        ),
        demon.speed,
        delta
    );
}


function demonSearch(delta) {

    if (!demonLastHeard) {

        demonState =
            "idle";

        return;
    }


    demonSearchTimer -=
        delta;


    moveDemon(
        demonLastHeard,
        2.45,
        delta
    );


    if (
        demon.position.distanceTo(
            demonLastHeard
        ) < 1.5
    ) {

        if (
            demonSearchTimer <= 0
        ) {

            demonState =
                "idle";

            demonLastHeard =
                null;
        }
    }


    if (
        canDemonSeePlayer()
    ) {

        demonState =
            "chase";
    }
}


function demonChase(delta) {

    demonTarget =
        player.position.clone();


    moveDemon(
        demonTarget,
        demon.chaseSpeed,
        delta
    );


    dangerWarning.textContent =
        "RUN";


    dangerWarning.classList.add(
        "show"
    );
}


function moveDemon(
    target,
    speed,
    delta
) {

    const direction =
        target
            .clone()
            .sub(
                demon.position
            );


    direction.y = 0;


    if (
        direction.lengthSq() <
        0.01
    ) {
        return;
    }


    direction.normalize();


    const next =
        demon.position
            .clone()
            .addScaledVector(
                direction,
                speed * delta
            );


    if (
        !collidesDemon(next)
    ) {

        demon.position.copy(
            next
        );
    }
}


function collidesDemon(
    position
) {

    const radius = 0.45;


    const box =
        new THREE.Box3(
            new THREE.Vector3(
                position.x - radius,
                0,
                position.z - radius
            ),
            new THREE.Vector3(
                position.x + radius,
                2.5,
                position.z + radius
            )
        );


    for (
        const wall of walls
    ) {

        const wallBox =
            new THREE.Box3()
                .setFromObject(
                    wall
                );


        if (
            box.intersectsBox(
                wallBox
            )
        ) {

            return true;
        }
    }


    return false;
}


/* =========================================================
   DEMON VISION
========================================================= */

function canDemonSeePlayer() {

    if (player.hidden) {
        return false;
    }


    const direction =
        player.position
            .clone()
            .sub(
                demon.position
            );


    const distance =
        direction.length();


    if (distance > 10) {
        return false;
    }


    direction.normalize();


    const ray =
        new THREE.Raycaster(
            demon.position.clone()
                .add(
                    new THREE.Vector3(
                        0,
                        1.5,
                        0
                    )
                ),
            direction,
            0,
            distance
        );


    const hits =
        ray.intersectObjects(
            walls,
            false
        );


    return hits.length === 0;
}


/* =========================================================
   INTERACTION
========================================================= */

function updateInteractions() {

    let closest = null;

    let closestDistance =
        Infinity;


    for (
        const item of interactables
    ) {

        if (
            item.type === "button" &&
            item.pressed
        ) {
            continue;
        }


        if (
            item.type === "gate" &&
            gateOpen
        ) {
            continue;
        }


        const distance =
            player.position.distanceTo(
                item.position
            );


        if (
            distance < 2.2 &&
            distance < closestDistance
        ) {

            closest =
                item;

            closestDistance =
                distance;
        }
    }


    if (!closest) {

        interactionText.classList.remove(
            "visible"
        );

        return;
    }


    if (
        closest.type === "button"
    ) {

        interactionText.textContent =
            `PRESS E — BUTTON ${closest.index + 1}`;
    }


    if (
        closest.type === "gate"
    ) {

        interactionText.textContent =
            keyCollected
                ? "PRESS E — OPEN GATE"
                : "THE GATE IS LOCKED";
    }


    interactionText.classList.add(
        "visible"
    );
}


/* =========================================================
   INTERACT
========================================================= */

function interact() {

    let closest = null;

    let closestDistance =
        Infinity;


    for (
        const item of interactables
    ) {

        if (
            item.type === "button" &&
            item.pressed
        ) {
            continue;
        }


        if (
            item.type === "gate" &&
            gateOpen
        ) {
            continue;
        }


        const distance =
            player.position.distanceTo(
                item.position
            );


        if (
            distance < 2.2 &&
            distance < closestDistance
        ) {

            closest =
                item;

            closestDistance =
                distance;
        }
    }


    if (!closest) {
        return;
    }


    if (
        closest.type === "button"
    ) {

        pressButton(
            closest
        );
    }


    if (
        closest.type === "gate"
    ) {

        openGate();
    }
}


/* =========================================================
   BUTTON
========================================================= */

function pressButton(
    item
) {

    item.pressed = true;

    buttonsFound[
        item.index
    ] = true;


    item.buttonMesh
        .material
        .color
        .set(
            0xd9ff00
        );


    item.buttonMesh
        .material
        .emissive
        .set(
            0x667700
        );


    buttonIndicators[
        item.index
    ].classList.add(
        "active"
    );


    noise = 1;


    const count =
        buttonsFound.filter(
            Boolean
        ).length;


    if (count === 3) {

        objective.textContent =
            "GET THE KEY";


        createKey();

    } else {

        objective.textContent =
            `FIND THE 3 BUTTONS — ${count}/3`;
    }
}


/* =========================================================
   KEY
========================================================= */

function createKey() {

    if (keyObject) {
        return;
    }


    keyObject =
        new THREE.Group();


    keyObject.position.set(
        0,
        1.1,
        -9
    );


    const material =
        new THREE.MeshStandardMaterial({
            color: 0xd9ff00,
            metalness: 0.85,
            roughness: 0.25,
            emissive: 0x333500
        });


    const shaft =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.12,
                0.12,
                0.8
            ),
            material
        );


    const ring =
        new THREE.Mesh(
            new THREE.TorusGeometry(
                0.24,
                0.07,
                8,
                16
            ),
            material
        );


    ring.rotation.x =
        Math.PI / 2;

    ring.position.z =
        0.45;


    keyObject.add(
        shaft
    );

    keyObject.add(
        ring
    );


    scene.add(
        keyObject
    );


    interactables.push({
        type: "key",
        object: keyObject,
        position: keyObject.position,
        collected: false
    });
}


/* =========================================================
   OBJECTIVE
========================================================= */

function updateObjective() {

    const key =
        interactables.find(
            item =>
                item.type === "key"
        );


    if (
        key &&
        !key.collected &&
        player.position.distanceTo(
            key.position
        ) < 1.5
    ) {

        key.collected = true;

        keyCollected = true;

        scene.remove(
            key.object
        );

        keyObject = null;

        objective.textContent =
            "REACH THE GATE";
    }


    if (
        keyCollected &&
        !gateOpen &&
        player.position.distanceTo(
            GATE_POSITION
        ) < 3
    ) {

        objective.textContent =
            "OPEN THE GATE";
    }


    if (
        gateOpen &&
        player.position.z < -22
    ) {

        winGame();
    }
}


/* =========================================================
   OPEN GATE
========================================================= */

function openGate() {

    if (!keyCollected) {

        objective.textContent =
            "YOU NEED THE KEY";

        return;
    }


    if (gateOpen) {
        return;
    }


    gateOpen = true;


    objective.textContent =
        "ESCAPE";


    noise = 1;


    const startY =
        gateObject.position.y;


    const gateAnimation =
        () => {

            if (
                gateObject.position.y <
                startY + 5
            ) {

                gateObject.position.y +=
                    0.08;

                requestAnimationFrame(
                    gateAnimation
                );
            }
        };


    gateAnimation();
}


/* =========================================================
   FLASHLIGHT
========================================================= */

function updateFlashlight() {

    if (!flashlight) {
        return;
    }


    flashlight.position.copy(
        camera.position
    );


    const direction =
        new THREE.Vector3();


    camera.getWorldDirection(
        direction
    );


    flashlight.target.position.copy(
        camera.position
            .clone()
            .add(
                direction.multiplyScalar(
                    10
                )
            )
    );
}


/* =========================================================
   PAUSE
========================================================= */

function pauseGame() {

    if (
        !gameRunning ||
        gameEnded
    ) {
        return;
    }


    gamePaused = true;

    pauseScreen.classList.remove(
        "hidden"
    );

    document.exitPointerLock?.();
}


function resumeGame() {

    if (
        !gameRunning ||
        gameEnded
    ) {
        return;
    }


    gamePaused = false;

    pauseScreen.classList.add(
        "hidden"
    );


    renderer.domElement
        .requestPointerLock?.();
}


/* =========================================================
   DEATH
========================================================= */

function loseGame(
    reason
) {

    if (gameEnded) {
        return;
    }


    gameEnded = true;

    gameRunning = false;


    document.exitPointerLock?.();


    deathReason.textContent =
        reason;


    deathScreen.classList.remove(
        "hidden"
    );


    dangerWarning.classList.remove(
        "show"
    );
}


/* =========================================================
   WIN
========================================================= */

function winGame() {

    if (gameEnded) {
        return;
    }


    gameEnded = true;

    gameRunning = false;


    document.exitPointerLock?.();


    winScreen.classList.remove(
        "hidden"
    );


    dangerWarning.classList.remove(
        "show"
    );
}


/* =========================================================
   RESTART
========================================================= */

function restartGame() {

    deathScreen.classList.add(
        "hidden"
    );

    winScreen.classList.add(
        "hidden"
    );

    pauseScreen.classList.add(
        "hidden"
    );


    startGame();
}


/* =========================================================
   RETURN TO MENU
========================================================= */

function returnToMenu() {

    gameRunning = false;

    gamePaused = false;

    gameEnded = false;


    document.exitPointerLock?.();


    pauseScreen.classList.add(
        "hidden"
    );

    deathScreen.classList.add(
        "hidden"
    );

    winScreen.classList.add(
        "hidden"
    );

    gameScreen.classList.add(
        "hidden"
    );

    instructionsScreen.classList.add(
        "hidden"
    );

    settingsScreen.classList.add(
        "hidden"
    );

    menuScreen.classList.remove(
        "hidden"
    );
}


/* =========================================================
   RESIZE
========================================================= */

function resizeGame() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();


    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}