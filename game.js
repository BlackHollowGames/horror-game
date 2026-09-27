/**
 * THE SEEKER — BlackHollow Games
 * game.js  ·  High-detail rebuild
 * Three.js horror prototype with noise AI, mobile controls, full HUD animations
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/controls/PointerLockControls.js';

// ═══════════════════════════════════════════════════════════
//  CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════

const CONFIG = {
    playerSpeed: 4.2,
    runMultiplier: 1.85,
    mouseSensitivity: 0.0022,
    touchLookSensitivity: 0.0035,
    gravity: 28,
    jumpForce: 8,
    flashlightIntensity: 2.8,
    flashlightDistance: 18,
    flashlightAngle: 0.42,
    maxSanity: 100,
    sanityDrainNearSeeker: 12,
    sanityDrainInDark: 3.5,
    noiseDecay: 0.65,
    runNoise: 28,
    walkNoise: 9,
    interactNoise: 45,
    buttonNoise: 85,
    seekerHearThreshold: 22,
    seekerSprintSpeed: 7.5,
    seekerWalkSpeed: 2.8,
    hideTime: 10,
    gameTime: 180,
    buttonCount: 3,
};

// ═══════════════════════════════════════════════════════════
//  DOM REFS
// ═══════════════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

const screens = {
    menu: $('menuScreen'),
    instructions: $('instructionsScreen'),
    settings: $('settingsScreen'),
    game: $('gameScreen'),
    pause: $('pauseScreen'),
    death: $('deathScreen'),
    win: $('winScreen'),
};

const hud = {
    objective: $('objective'),
    timer: $('timer'),
    button1: $('button1'),
    button2: $('button2'),
    button3: $('button3'),
    sanityFill: $('sanityFill'),
    noiseFill: $('noiseFill'),
    crosshair: $('crosshair'),
    interaction: $('interaction'),
    interactionText: $('interactionText'),
    hideTimer: $('hideTimer'),
    hideTimerValue: $('hideTimerValue'),
    dangerWarning: $('dangerWarning'),
    screamOverlay: $('screamOverlay'),
};

const mobile = {
    controls: $('mobileControls'),
    joystickZone: $('joystickZone'),
    joystickBase: $('joystickBase'),
    joystickKnob: $('joystickKnob'),
    runBtn: $('mobileRun'),
    interactBtn: $('mobileInteract'),
    flashBtn: $('mobileFlashlight'),
    lookZone: $('lookZone'),
};

const settings = {
    flashlight: $('flashlightSetting'),
    footstep: $('footstepSetting'),
    volume: $('volumeSetting'),
};

// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════

const state = {
    currentScreen: 'menu',
    isPlaying: false,
    isPaused: false,
    isDead: false,
    hasWon: false,
    isHiding: false,
    hideTimeLeft: 0,
    timeLeft: CONFIG.gameTime,
    sanity: CONFIG.maxSanity,
    noise: 0,
    buttonsPressed: [false, false, false],
    hasKey: false,
    flashlightOn: true,
    isRunning: false,
    isMobile: false,
    seekerAlert: false,
    seekerTarget: null,
    lastNoiseTime: 0,
    interactable: null,
    keys: {},
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    canJump: false,
    clock: new THREE.Clock(),
    delta: 0,
    elapsed: 0,
    animFrame: 0,
};

// Touch / joystick state
const touch = {
    joystickActive: false,
    joystickOrigin: { x: 0, y: 0 },
    joystickDelta: { x: 0, y: 0 },
    lookActive: false,
    lookLast: { x: 0, y: 0 },
    runHeld: false,
};

// ═══════════════════════════════════════════════════════════
//  THREE.JS CORE
// ═══════════════════════════════════════════════════════════

let renderer, scene, camera, controls;
let player, flashlight, ambientLight, fillLight;
let seeker, seekerMesh, seekerLight;
let buildingGroup, floor, walls = [];
let interactables = [];
let particles = [];
let dustSystem, fogParticles;
let audioCtx, masterGain;
let footstepOsc, ambientNoise;

function initThree() {
    const canvasParent = $('gameCanvas');

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasParent.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x080810, 0.045);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 120);
    camera.position.set(0, 1.65, 0);

    controls = new PointerLockControls(camera, renderer.domElement);

    // Lighting
    ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.15);
    scene.add(ambientLight);

    fillLight = new THREE.HemisphereLight(0x2a2a40, 0x0a0a10, 0.25);
    scene.add(fillLight);

    // Flashlight (spot + secondary soft)
    flashlight = new THREE.SpotLight(0xfff0d0, CONFIG.flashlightIntensity, CONFIG.flashlightDistance, CONFIG.flashlightAngle, 0.35, 1.2);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.set(1024, 1024);
    flashlight.shadow.bias = -0.0002;
    flashlight.position.set(0, 0, 0);
    camera.add(flashlight);
    scene.add(camera);

    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, 0, -1);
    camera.add(flashTarget);
    flashlight.target = flashTarget;

    // Soft fill from flashlight
    const softFlash = new THREE.PointLight(0xffe8c0, 0.35, 6);
    camera.add(softFlash);

    buildEnvironment();
    createSeeker();
    createDustParticles();
    createInteractables();

    window.addEventListener('resize', onResize);
}

// ═══════════════════════════════════════════════════════════
//  ENVIRONMENT — DETAILED BUILDING
// ═══════════════════════════════════════════════════════════

function buildEnvironment() {
    buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x1c1c22,
        roughness: 0.92,
        metalness: 0.05,
    });
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x121218,
        roughness: 0.85,
        metalness: 0.08,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
        color: 0x0e0e14,
        roughness: 0.95,
        metalness: 0.02,
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0x2a2218,
        roughness: 0.7,
        metalness: 0.15,
    });
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0x3a3a45,
        roughness: 0.4,
        metalness: 0.7,
    });

    // Floor
    floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    buildingGroup.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3.2;
    buildingGroup.add(ceiling);

    // Outer walls + rooms
    const rooms = [
        { x: 0, z: 0, w: 12, d: 12 },      // main hall
        { x: -10, z: 0, w: 8, d: 10 },     // left wing
        { x: 10, z: 0, w: 8, d: 10 },      // right wing
        { x: 0, z: -11, w: 10, d: 8 },     // back corridor
        { x: -8, z: 9, w: 6, d: 6 },       // small room
        { x: 8, z: 9, w: 6, d: 6 },
    ];

    // Simple wall builder
    function addWall(x1, z1, x2, z2, h = 3.2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.28), wallMat);
        mesh.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
        mesh.rotation.y = Math.atan2(dz, dx);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        buildingGroup.add(mesh);
        walls.push(mesh);

        // Collision box (approx)
        mesh.userData.collider = {
            minX: Math.min(x1, x2) - 0.2,
            maxX: Math.max(x1, x2) + 0.2,
            minZ: Math.min(z1, z2) - 0.2,
            maxZ: Math.max(z1, z2) + 0.2,
        };
    }

    // Outer perimeter
    addWall(-18, -18, 18, -18);
    addWall(18, -18, 18, 18);
    addWall(18, 18, -18, 18);
    addWall(-18, 18, -18, -18);

    // Interior dividers
    addWall(-6, -6, -6, 6);
    addWall(6, -6, 6, 6);
    addWall(-6, -6, 6, -6);
    addWall(-12, 2, -6, 2);
    addWall(6, 2, 12, 2);
    addWall(-4, 8, 4, 8);
    addWall(-10, -4, -10, 4);
    addWall(10, -4, 10, 4);

    // Pillars
    for (let i = 0; i < 6; i++) {
        const px = (Math.random() - 0.5) * 20;
        const pz = (Math.random() - 0.5) * 20;
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.32, 3.2, 8),
            accentMat
        );
        pillar.position.set(px, 1.6, pz);
        pillar.castShadow = true;
        buildingGroup.add(pillar);
    }

    // Debris / props
    for (let i = 0; i < 25; i++) {
        const size = 0.15 + Math.random() * 0.4;
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(size, size * 0.6, size * 0.8),
            Math.random() > 0.5 ? metalMat : accentMat
        );
        box.position.set(
            (Math.random() - 0.5) * 30,
            size * 0.3,
            (Math.random() - 0.5) * 30
        );
        box.rotation.y = Math.random() * Math.PI;
        box.castShadow = true;
        box.receiveShadow = true;
        buildingGroup.add(box);
    }

    // Dim ceiling lights (flickering later)
    for (let i = 0; i < 8; i++) {
        const pl = new THREE.PointLight(0x445566, 0.15 + Math.random() * 0.1, 8);
        pl.position.set(
            (Math.random() - 0.5) * 28,
            3.0,
            (Math.random() - 0.5) * 28
        );
        pl.userData.baseIntensity = pl.intensity;
        pl.userData.flickerSpeed = 0.5 + Math.random() * 2;
        buildingGroup.add(pl);
        walls.push(pl); // reuse for flicker update
    }

    // Floor grid detail (subtle lines)
    const gridHelper = new THREE.GridHelper(40, 40, 0x1a1a22, 0x121218);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    buildingGroup.add(gridHelper);
}

// ═══════════════════════════════════════════════════════════
//  SEEKER ENTITY
// ═══════════════════════════════════════════════════════════

function createSeeker() {
    seeker = new THREE.Group();
    seeker.position.set(12, 0, -12);

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 1.1, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0e,
        roughness: 0.3,
        metalness: 0.6,
        emissive: 0x110000,
        emissiveIntensity: 0.15,
    });
    seekerMesh = new THREE.Mesh(bodyGeo, bodyMat);
    seekerMesh.position.y = 1.0;
    seekerMesh.castShadow = true;
    seeker.add(seekerMesh);

    // Head
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        new THREE.MeshStandardMaterial({
            color: 0x050508,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x220000,
            emissiveIntensity: 0.4,
        })
    );
    head.position.y = 1.85;
    head.scale.set(1, 1.15, 0.9);
    seeker.add(head);

    // Eyes (glowing)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat);
    eyeL.position.set(-0.1, 1.9, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    seeker.add(eyeL, eyeR);

    // Point light on seeker
    seekerLight = new THREE.PointLight(0xff1100, 0.6, 5);
    seekerLight.position.y = 1.7;
    seeker.add(seekerLight);

    // Legs (simple)
    const legMat = bodyMat;
    for (let side of [-1, 1]) {
        const leg = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.12, 0.55, 3, 6),
            legMat
        );
        leg.position.set(side * 0.18, 0.4, 0);
        seeker.add(leg);
    }

    scene.add(seeker);

    seeker.userData = {
        velocity: new THREE.Vector3(),
        state: 'patrol', // patrol | alert | chase | search
        patrolTarget: new THREE.Vector3(),
        alertLevel: 0,
        lastHeard: 0,
        animPhase: 0,
    };
    pickNewPatrolTarget();
}

function pickNewPatrolTarget() {
    seeker.userData.patrolTarget.set(
        (Math.random() - 0.5) * 28,
        0,
        (Math.random() - 0.5) * 28
    );
}

function updateSeeker(dt) {
    const s = seeker.userData;
    s.animPhase += dt * (s.state === 'chase' ? 8 : 3);

    // Bob animation
    seekerMesh.position.y = 1.0 + Math.sin(s.animPhase) * 0.04;
    seeker.rotation.y += Math.sin(s.animPhase * 0.5) * 0.002;

    // Eye pulse
    seekerLight.intensity = 0.4 + Math.sin(state.elapsed * 4) * 0.25;

    const playerPos = camera.position.clone();
    playerPos.y = 0;
    const seekerPos = seeker.position.clone();
    seekerPos.y = 0;
    const dist = playerPos.distanceTo(seekerPos);

    // Noise reaction
    if (state.noise > CONFIG.seekerHearThreshold && !state.isHiding) {
        s.alertLevel = Math.min(1, s.alertLevel + dt * 1.5);
        s.lastHeard = state.elapsed;
        s.state = state.noise > 50 ? 'chase' : 'alert';
        s.patrolTarget.copy(playerPos);
        state.seekerAlert = true;
        showDanger(true);
    } else if (state.elapsed - s.lastHeard > 4) {
        s.alertLevel = Math.max(0, s.alertLevel - dt * 0.4);
        if (s.alertLevel < 0.15) {
            s.state = 'patrol';
            state.seekerAlert = false;
            showDanger(false);
        }
    }

    // Movement
    let speed = CONFIG.seekerWalkSpeed;
    if (s.state === 'chase') speed = CONFIG.seekerSprintSpeed;
    else if (s.state === 'alert') speed = CONFIG.seekerWalkSpeed * 1.4;

    const target = s.state === 'patrol' ? s.patrolTarget : playerPos;
    const dir = target.clone().sub(seekerPos).normalize();

    // Simple obstacle avoidance (push away from walls roughly)
    seeker.position.x += dir.x * speed * dt;
    seeker.position.z += dir.z * speed * dt;

    // Face movement
    if (dir.lengthSq() > 0.01) {
        const angle = Math.atan2(dir.x, dir.z);
        seeker.rotation.y = THREE.MathUtils.lerp(seeker.rotation.y, angle, dt * 4);
    }

    // Clamp inside bounds
    seeker.position.x = THREE.MathUtils.clamp(seeker.position.x, -17, 17);
    seeker.position.z = THREE.MathUtils.clamp(seeker.position.z, -17, 17);

    // Catch player
    if (dist < 1.35 && !state.isHiding && state.isPlaying && !state.isDead) {
        killPlayer('THE SEEKER FOUND YOU.');
    }

    // Sanity drain when close
    if (dist < 8 && !state.isHiding) {
        const drain = (1 - dist / 8) * CONFIG.sanityDrainNearSeeker * dt;
        state.sanity = Math.max(0, state.sanity - drain);
    }

    // New patrol if reached
    if (s.state === 'patrol' && seekerPos.distanceTo(s.patrolTarget) < 1.5) {
        pickNewPatrolTarget();
    }
}

// ═══════════════════════════════════════════════════════════
//  INTERACTABLES (Buttons, Key, Hide spots, Exit)
// ═══════════════════════════════════════════════════════════

function createInteractables() {
    interactables = [];

    const btnPositions = [
        new THREE.Vector3(-8, 1.2, 4),
        new THREE.Vector3(9, 1.2, -5),
        new THREE.Vector3(0, 1.2, -10),
    ];

    btnPositions.forEach((pos, i) => {
        const group = new THREE.Group();
        group.position.copy(pos);

        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.7, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x2a2a32, roughness: 0.6, metalness: 0.4 })
        );
        group.add(base);

        const btn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16),
            new THREE.MeshStandardMaterial({
                color: 0x881111,
                emissive: 0x440000,
                emissiveIntensity: 0.6,
                roughness: 0.3,
            })
        );
        btn.rotation.x = Math.PI / 2;
        btn.position.z = 0.12;
        group.add(btn);

        const light = new THREE.PointLight(0xff2200, 0.4, 3);
        light.position.z = 0.3;
        group.add(light);

        group.userData = {
            type: 'button',
            index: i,
            pressed: false,
            mesh: btn,
            light,
            pulse: Math.random() * Math.PI * 2,
        };
        scene.add(group);
        interactables.push(group);
    });

    // Key (appears after 3 buttons)
    const keyGroup = new THREE.Group();
    keyGroup.position.set(0, 0.9, 12);
    keyGroup.visible = false;

    const keyBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.35, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a00, emissiveIntensity: 0.3 })
    );
    keyGroup.add(keyBody);
    const keyHead = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.025, 8, 12),
        keyBody.material
    );
    keyHead.position.y = 0.22;
    keyHead.rotation.x = Math.PI / 2;
    keyGroup.add(keyHead);

    keyGroup.userData = { type: 'key', taken: false };
    scene.add(keyGroup);
    interactables.push(keyGroup);

    // Hide boxes
    const hideSpots = [
        new THREE.Vector3(-14, 0, 6),
        new THREE.Vector3(14, 0, -8),
        new THREE.Vector3(-5, 0, -14),
        new THREE.Vector3(5, 0, 14),
    ];
    hideSpots.forEach((pos) => {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.5, 1.1),
            new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 0.9 })
        );
        box.position.copy(pos);
        box.position.y = 0.75;
        box.castShadow = true;
        box.userData = { type: 'hide', occupied: false };
        scene.add(box);
        interactables.push(box);
    });

    // Exit gate
    const gate = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 3.0, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.6, roughness: 0.4 })
    );
    gate.position.set(0, 1.5, 17.5);
    gate.userData = { type: 'exit', locked: true };
    scene.add(gate);
    interactables.push(gate);
}

function updateInteractables(dt) {
    interactables.forEach((obj) => {
        const d = obj.userData;
        if (d.type === 'button' && !d.pressed) {
            d.pulse += dt * 3;
            const pulse = 0.5 + Math.sin(d.pulse) * 0.5;
            d.mesh.material.emissiveIntensity = 0.4 + pulse * 0.5;
            d.light.intensity = 0.25 + pulse * 0.35;
        }
        if (d.type === 'key' && obj.visible) {
            obj.rotation.y += dt * 1.5;
            obj.position.y = 0.9 + Math.sin(state.elapsed * 2) * 0.08;
        }
    });
}

function tryInteract() {
    if (!state.isPlaying || state.isDead || state.isHiding) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(interactables, true);

    if (hits.length === 0 || hits[0].distance > 2.8) {
        hideInteraction();
        return;
    }

    let obj = hits[0].object;
    while (obj && !obj.userData?.type) obj = obj.parent;
    if (!obj) return;

    const d = obj.userData;

    if (d.type === 'button' && !d.pressed) {
        d.pressed = true;
        state.buttonsPressed[d.index] = true;
        d.mesh.material.color.set(0x22aa44);
        d.mesh.material.emissive.set(0x115522);
        d.light.color.set(0x22ff44);
        d.light.intensity = 0.8;
        addNoise(CONFIG.buttonNoise);
        updateButtonHUD();
        triggerScreamOverlay();
        startHideCountdown();
        checkButtonsComplete();
        playTone(180, 0.3, 'sawtooth');
        setTimeout(() => playTone(90, 0.5, 'sawtooth'), 200);
    } else if (d.type === 'key' && !d.taken && obj.visible) {
        d.taken = true;
        state.hasKey = true;
        obj.visible = false;
        hud.objective.textContent = 'REACH THE EXIT GATE';
        animateObjective();
        playTone(520, 0.15, 'sine');
        setTimeout(() => playTone(780, 0.2, 'sine'), 120);
    } else if (d.type === 'hide') {
        enterHide(obj);
    } else if (d.type === 'exit') {
        if (state.hasKey) {
            winGame();
        } else {
            showInteraction('NEED THE KEY');
        }
    }
}

function checkButtonsComplete() {
    if (state.buttonsPressed.every(Boolean)) {
        const key = interactables.find((o) => o.userData.type === 'key');
        if (key) {
            key.visible = true;
            hud.objective.textContent = 'RETRIEVE THE KEY';
            animateObjective();
        }
    }
}

function enterHide(box) {
    state.isHiding = true;
    state.hideTimeLeft = CONFIG.hideTime;
    camera.position.copy(box.position);
    camera.position.y = 1.1;
    controls.unlock();
    hud.hideTimer.classList.remove('hidden');
    addNoise(5);
    playTone(120, 0.2, 'triangle');
}

function exitHide() {
    state.isHiding = false;
    hud.hideTimer.classList.add('hidden');
    camera.position.y = 1.65;
    if (!state.isMobile) controls.lock();
}

// ═══════════════════════════════════════════════════════════
//  PARTICLES / DUST / EFFECTS
// ═══════════════════════════════════════════════════════════

function createDustParticles() {
    const count = 400;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = Math.random() * 3.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        speeds[i] = 0.1 + Math.random() * 0.25;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.userData.speeds = speeds;

    const mat = new THREE.PointsMaterial({
        color: 0x888899,
        size: 0.035,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    dustSystem = new THREE.Points(geo, mat);
    scene.add(dustSystem);
}

function updateDust(dt) {
    if (!dustSystem) return;
    const pos = dustSystem.geometry.attributes.position.array;
    const speeds = dustSystem.geometry.userData.speeds;
    for (let i = 0; i < speeds.length; i++) {
        pos[i * 3 + 1] += speeds[i] * dt * 0.15;
        if (pos[i * 3 + 1] > 3.2) pos[i * 3 + 1] = 0;
        pos[i * 3] += Math.sin(state.elapsed + i) * 0.002;
    }
    dustSystem.geometry.attributes.position.needsUpdate = true;
}

function triggerScreamOverlay() {
    hud.screamOverlay.classList.add('active');
    setTimeout(() => hud.screamOverlay.classList.remove('active'), 1200);
}

function showDanger(on) {
    if (on) hud.dangerWarning.classList.add('visible');
    else hud.dangerWarning.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
//  AUDIO (Web Audio API — lightweight procedural)
// ═══════════════════════════════════════════════════════════

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = (settings.volume?.value || 45) / 100 * 0.4;
        masterGain.connect(audioCtx.destination);
    } catch (e) {
        console.warn('Audio unavailable');
    }
}

function playTone(freq, dur, type = 'sine') {
    if (!audioCtx || !settings.footstep?.checked) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

function playFootstep() {
    if (!settings.footstep?.checked) return;
    const f = 80 + Math.random() * 40;
    playTone(f, 0.08, 'triangle');
}

// ═══════════════════════════════════════════════════════════
//  INPUT — KEYBOARD + MOBILE
// ═══════════════════════════════════════════════════════════

function setupInput() {
    // Detect mobile
    state.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (state.isMobile) {
        mobile.controls.classList.remove('hidden');
        setupMobileControls();
    }

    document.addEventListener('keydown', (e) => {
        state.keys[e.code] = true;
        if (e.code === 'KeyE') tryInteract();
        if (e.code === 'KeyF') toggleFlashlight();
        if (e.code === 'Escape' && state.isPlaying) togglePause();
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.isRunning = true;
    });
    document.addEventListener('keyup', (e) => {
        state.keys[e.code] = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.isRunning = false;
    });

    // Pointer lock for desktop
    renderer?.domElement.addEventListener('click', () => {
        if (state.isPlaying && !state.isPaused && !state.isMobile && !state.isHiding) {
            controls.lock();
        }
    });

    controls?.addEventListener('unlock', () => {
        if (state.isPlaying && !state.isPaused && !state.isHiding && !state.isMobile) {
            // soft unlock — don't auto pause
        }
    });
}

function setupMobileControls() {
    // Joystick
    const zone = mobile.joystickZone;
    const knob = mobile.joystickKnob;
    const maxDist = 42;

    const onStart = (e) => {
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        const rect = zone.getBoundingClientRect();
        touch.joystickActive = true;
        touch.joystickOrigin.x = t.clientX - rect.left;
        touch.joystickOrigin.y = t.clientY - rect.top;
        knob.classList.add('active');
    };
    const onMove = (e) => {
        if (!touch.joystickActive) return;
        e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        const rect = zone.getBoundingClientRect();
        let dx = t.clientX - rect.left - touch.joystickOrigin.x;
        let dy = t.clientY - rect.top - touch.joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        touch.joystickDelta.x = dx / maxDist;
        touch.joystickDelta.y = dy / maxDist;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    const onEnd = () => {
        touch.joystickActive = false;
        touch.joystickDelta.x = 0;
        touch.joystickDelta.y = 0;
        knob.style.transform = 'translate(-50%, -50%)';
        knob.classList.remove('active');
    };

    zone.addEventListener('touchstart', onStart, { passive: false });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd);
    zone.addEventListener('touchcancel', onEnd);

    // Look zone
    mobile.lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touch.lookActive = true;
        touch.lookLast.x = e.touches[0].clientX;
        touch.lookLast.y = e.touches[0].clientY;
    }, { passive: false });
    mobile.lookZone.addEventListener('touchmove', (e) => {
        if (!touch.lookActive) return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - touch.lookLast.x;
        const dy = t.clientY - touch.lookLast.y;
        camera.rotation.y -= dx * CONFIG.touchLookSensitivity;
        camera.rotation.x -= dy * CONFIG.touchLookSensitivity;
        camera.rotation.x = Math.max(-1.4, Math.min(1.4, camera.rotation.x));
        touch.lookLast.x = t.clientX;
        touch.lookLast.y = t.clientY;
    }, { passive: false });
    mobile.lookZone.addEventListener('touchend', () => { touch.lookActive = false; });

    // Action buttons
    mobile.runBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touch.runHeld = true;
        state.isRunning = true;
        mobile.runBtn.classList.add('active');
    });
    mobile.runBtn.addEventListener('touchend', () => {
        touch.runHeld = false;
        state.isRunning = false;
        mobile.runBtn.classList.remove('active');
    });

    mobile.interactBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        tryInteract();
        mobile.interactBtn.classList.add('active');
        setTimeout(() => mobile.interactBtn.classList.remove('active'), 150);
    });

    mobile.flashBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleFlashlight();
        mobile.flashBtn.classList.add('active');
        setTimeout(() => mobile.flashBtn.classList.remove('active'), 150);
    });
}

// ═══════════════════════════════════════════════════════════
//  PLAYER MOVEMENT
// ═══════════════════════════════════════════════════════════

let footstepTimer = 0;

function updatePlayer(dt) {
    if (state.isHiding || state.isDead || state.isPaused) return;

    const speed = CONFIG.playerSpeed * (state.isRunning ? CONFIG.runMultiplier : 1);

    // Direction from keys or joystick
    state.direction.set(0, 0, 0);

    if (state.isMobile && touch.joystickActive) {
        state.direction.x = touch.joystickDelta.x;
        state.direction.z = touch.joystickDelta.y;
    } else {
        if (state.keys['KeyW'] || state.keys['ArrowUp']) state.direction.z -= 1;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) state.direction.z += 1;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.direction.x -= 1;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.direction.x += 1;
    }

    if (state.direction.lengthSq() > 0) {
        state.direction.normalize();

        // Apply camera yaw
        const yaw = camera.rotation.y;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        const mx = state.direction.x * cos + state.direction.z * sin;
        const mz = -state.direction.x * sin + state.direction.z * cos;

        camera.position.x += mx * speed * dt;
        camera.position.z += mz * speed * dt;

        // Noise
        addNoise(state.isRunning ? CONFIG.runNoise * dt : CONFIG.walkNoise * dt);

        // Footsteps
        footstepTimer -= dt;
        if (footstepTimer <= 0) {
            playFootstep();
            footstepTimer = state.isRunning ? 0.28 : 0.48;
        }

        // Head bob
        const bob = Math.sin(state.elapsed * (state.isRunning ? 14 : 9)) * (state.isRunning ? 0.025 : 0.012);
        camera.position.y = 1.65 + bob;
    } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.65, dt * 8);
        footstepTimer = 0;
    }

    // Bounds
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -17.5, 17.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -17.5, 17.5);

    // Sanity drain in dark
    if (!state.flashlightOn) {
        state.sanity = Math.max(0, state.sanity - CONFIG.sanityDrainInDark * dt);
    }

    if (state.sanity <= 0) {
        killPlayer('YOUR SANITY COLLAPSED.');
    }

    // Interaction ray
    checkInteractionPrompt();
}

function checkInteractionPrompt() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(interactables, true);

    if (hits.length && hits[0].distance < 2.8) {
        let obj = hits[0].object;
        while (obj && !obj.userData?.type) obj = obj.parent;
        if (!obj) { hideInteraction(); return; }

        const d = obj.userData;
        if (d.type === 'button' && !d.pressed) showInteraction('[E] PRESS BUTTON');
        else if (d.type === 'key' && !d.taken && obj.visible) showInteraction('[E] TAKE KEY');
        else if (d.type === 'hide') showInteraction('[E] HIDE');
        else if (d.type === 'exit') showInteraction(state.hasKey ? '[E] OPEN GATE' : 'LOCKED — NEED KEY');
        else hideInteraction();
    } else {
        hideInteraction();
    }
}

function showInteraction(text) {
    hud.interactionText.textContent = text;
    hud.interaction.classList.add('visible');
}
function hideInteraction() {
    hud.interaction.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
//  NOISE / SANITY / HUD UPDATES
// ═══════════════════════════════════════════════════════════

function addNoise(amount) {
    state.noise = Math.min(100, state.noise + amount);
    state.lastNoiseTime = state.elapsed;
}

function updateNoise(dt) {
    if (state.elapsed - state.lastNoiseTime > 0.4) {
        state.noise = Math.max(0, state.noise - CONFIG.noiseDecay * 40 * dt);
    }
    hud.noiseFill.style.width = state.noise + '%';
    // Color shift
    if (state.noise > 60) hud.noiseFill.style.background = 'linear-gradient(90deg, #aa2222, #ff3300)';
    else if (state.noise > 30) hud.noiseFill.style.background = 'linear-gradient(90deg, #886622, #cc8800)';
    else hud.noiseFill.style.background = 'linear-gradient(90deg, #4a4a4a, #888)';
}

function updateSanityHUD() {
    const pct = (state.sanity / CONFIG.maxSanity) * 100;
    hud.sanityFill.style.width = pct + '%';
    if (pct < 25) {
        hud.sanityFill.style.background = 'linear-gradient(90deg, #660000, #ff2200)';
        document.body.style.filter = `contrast(1.05) saturate(${0.7 + pct / 100})`;
    } else if (pct < 50) {
        hud.sanityFill.style.background = 'linear-gradient(90deg, #884400, #cc6600)';
        document.body.style.filter = '';
    } else {
        hud.sanityFill.style.background = 'linear-gradient(90deg, #b33030, #c9a227)';
        document.body.style.filter = '';
    }
}

function updateButtonHUD() {
    [hud.button1, hud.button2, hud.button3].forEach((el, i) => {
        if (state.buttonsPressed[i]) {
            el.classList.add('active');
            el.querySelector('i').style.background = '#2a8a4a';
        }
    });
}

function updateTimer(dt) {
    if (!state.isPlaying || state.isPaused || state.isDead || state.hasWon) return;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        killPlayer('TIME RAN OUT.');
    }
    const m = Math.floor(state.timeLeft / 60);
    const s = Math.floor(state.timeLeft % 60);
    hud.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (state.timeLeft < 30) hud.timer.style.color = '#ff3333';
    else hud.timer.style.color = '';
}

function updateHideTimer(dt) {
    if (!state.isHiding) return;
    state.hideTimeLeft -= dt;
    hud.hideTimerValue.textContent = Math.ceil(state.hideTimeLeft);
    if (state.hideTimeLeft <= 0) {
        exitHide();
    }
}

function animateObjective() {
    hud.objective.style.animation = 'none';
    void hud.objective.offsetWidth;
    hud.objective.style.animation = 'pulse-danger 0.6s ease';
}

// ═══════════════════════════════════════════════════════════
//  FLASHLIGHT
// ═══════════════════════════════════════════════════════════

function toggleFlashlight() {
    if (!settings.flashlight?.checked) return;
    state.flashlightOn = !state.flashlightOn;
    flashlight.intensity = state.flashlightOn ? CONFIG.flashlightIntensity : 0;
    playTone(state.flashlightOn ? 400 : 200, 0.06, 'square');
}

// ═══════════════════════════════════════════════════════════
//  SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════════

function showScreen(name) {
    Object.values(screens).forEach((s) => s?.classList.add('hidden'));
    if (screens[name]) screens[name].classList.remove('hidden');
    state.currentScreen = name;
}

function startGame() {
    // Reset state
    state.isPlaying = true;
    state.isPaused = false;
    state.isDead = false;
    state.hasWon = false;
    state.isHiding = false;
    state.timeLeft = CONFIG.gameTime;
    state.sanity = CONFIG.maxSanity;
    state.noise = 0;
    state.buttonsPressed = [false, false, false];
    state.hasKey = false;
    state.flashlightOn = true;
    state.seekerAlert = false;

    // Reset HUD
    hud.objective.textContent = 'FIND THE 3 BUTTONS';
    hud.timer.textContent = '03:00';
    hud.timer.style.color = '';
    [hud.button1, hud.button2, hud.button3].forEach((el) => {
        el.classList.remove('active');
        el.querySelector('i').style.background = '';
    });
    hud.sanityFill.style.width = '100%';
    hud.noiseFill.style.width = '0%';
    hud.hideTimer.classList.add('hidden');
    showDanger(false);
    document.body.style.filter = '';

    // Reset world
    camera.position.set(0, 1.65, 0);
    camera.rotation.set(0, 0, 0);
    seeker.position.set(12, 0, -12);
    seeker.userData.state = 'patrol';
    seeker.userData.alertLevel = 0;
    pickNewPatrolTarget();

    interactables.forEach((obj) => {
        const d = obj.userData;
        if (d.type === 'button') {
            d.pressed = false;
            d.mesh.material.color.set(0x881111);
            d.mesh.material.emissive.set(0x440000);
            d.light.color.set(0xff2200);
            d.light.intensity = 0.4;
        }
        if (d.type === 'key') {
            d.taken = false;
            obj.visible = false;
        }
    });

    flashlight.intensity = CONFIG.flashlightIntensity;

    showScreen('game');
    screens.game.classList.remove('hidden');
    screens.pause.classList.add('hidden');
    screens.death.classList.add('hidden');
    screens.win.classList.add('hidden');

    if (!state.isMobile) {
        setTimeout(() => controls.lock(), 100);
    }

    if (audioCtx?.state === 'suspended') audioCtx.resume();
    state.clock.start();
}

function togglePause() {
    if (!state.isPlaying || state.isDead || state.hasWon) return;
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
        screens.pause.classList.remove('hidden');
        controls.unlock();
    } else {
        screens.pause.classList.add('hidden');
        if (!state.isMobile && !state.isHiding) controls.lock();
    }
}

function killPlayer(reason) {
    state.isDead = true;
    state.isPlaying = false;
    controls.unlock();
    $('deathReason').textContent = reason || 'THE SEEKER FOUND YOU.';
    screens.death.classList.remove('hidden');
    triggerScreamOverlay();
    playTone(60, 1.2, 'sawtooth');
}

function winGame() {
    state.hasWon = true;
    state.isPlaying = false;
    controls.unlock();
    screens.win.classList.remove('hidden');
    playTone(440, 0.2, 'sine');
    setTimeout(() => playTone(554, 0.2, 'sine'), 150);
    setTimeout(() => playTone(659, 0.4, 'sine'), 300);
}

function quitToMenu() {
    state.isPlaying = false;
    state.isPaused = false;
    controls.unlock();
    showScreen('menu');
    screens.game.classList.add('hidden');
    screens.pause.classList.add('hidden');
    screens.death.classList.add('hidden');
    screens.win.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════

function animate() {
    requestAnimationFrame(animate);
    state.animFrame++;

    const dt = Math.min(state.clock.getDelta(), 0.05);
    state.delta = dt;
    state.elapsed += dt;

    if (state.isPlaying && !state.isPaused && !state.isDead && !state.hasWon) {
        updatePlayer(dt);
        updateSeeker(dt);
        updateInteractables(dt);
        updateDust(dt);
        updateNoise(dt);
        updateSanityHUD();
        updateTimer(dt);
        updateHideTimer(dt);

        // Flicker ceiling lights
        buildingGroup?.children.forEach((c) => {
            if (c.isPointLight && c.userData.baseIntensity) {
                const f = c.userData.baseIntensity;
                c.intensity = f * (0.85 + Math.sin(state.elapsed * c.userData.flickerSpeed) * 0.15);
            }
        });
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ═══════════════════════════════════════════════════════════
//  UI BUTTON WIRING
// ═══════════════════════════════════════════════════════════

function setupUI() {
    $('playButton')?.addEventListener('click', () => {
        if (!renderer) {
            initThree();
            setupInput();
            initAudio();
        }
        startGame();
    });

    $('instructionsButton')?.addEventListener('click', () => showScreen('instructions'));
    $('instructionsBack')?.addEventListener('click', () => showScreen('menu'));

    $('settingsButton')?.addEventListener('click', () => showScreen('settings'));
    $('settingsBack')?.addEventListener('click', () => showScreen('menu'));

    $('resumeButton')?.addEventListener('click', () => togglePause());
    $('quitButton')?.addEventListener('click', () => quitToMenu());

    $('retryButton')?.addEventListener('click', () => startGame());
    $('deathMenuButton')?.addEventListener('click', () => quitToMenu());

    $('winAgainButton')?.addEventListener('click', () => startGame());
    $('winMenuButton')?.addEventListener('click', () => quitToMenu());

    settings.volume?.addEventListener('input', () => {
        if (masterGain) masterGain.gain.value = (settings.volume.value / 100) * 0.4;
    });

    // Menu entrance animation
    const menuLeft = document.querySelector('.menu-left');
    const menuRight = document.querySelector('.menu-right');
    if (menuLeft) {
        menuLeft.style.opacity = '0';
        menuLeft.style.transform = 'translateX(-30px)';
        menuLeft.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
        requestAnimationFrame(() => {
            menuLeft.style.opacity = '1';
            menuLeft.style.transform = 'translateX(0)';
        });
    }
    if (menuRight) {
        menuRight.style.opacity = '0';
        menuRight.style.transform = 'translateX(30px)';
        menuRight.style.transition = 'opacity 0.7s ease 0.15s, transform 0.7s ease 0.15s';
        requestAnimationFrame(() => {
            menuRight.style.opacity = '1';
            menuRight.style.transform = 'translateX(0)';
        });
    }
}

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════

setupUI();
animate(); // starts the rAF loop (renders black until game starts)

console.log('%c THE SEEKER %c BlackHollow Games ', 'background:#c9a227;color:#000;font-weight:bold', 'background:#111;color:#c9a227');