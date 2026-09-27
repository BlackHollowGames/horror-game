
/**
 * THE SEEKER — BlackHollow Games
 * game.js  ·  Fixed button wiring + full systems
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════

const CONFIG = {
    playerSpeed: 4.2,
    runMultiplier: 1.85,
    mouseSensitivity: 0.0022,
    touchLookSensitivity: 0.0035,
    flashlightIntensity: 2.8,
    flashlightDistance: 18,
    flashlightAngle: 0.42,
    maxSanity: 100,
    sanityDrainNearSeeker: 12,
    sanityDrainInDark: 3.5,
    noiseDecay: 0.65,
    runNoise: 28,
    walkNoise: 9,
    buttonNoise: 85,
    seekerHearThreshold: 22,
    seekerSprintSpeed: 7.5,
    seekerWalkSpeed: 2.8,
    hideTime: 10,
    gameTime: 160,
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
    lastNoiseTime: 0,
    keys: {},
    clock: new THREE.Clock(false),
    elapsed: 0,
    threeReady: false,
};

const touch = {
    joystickActive: false,
    joystickOrigin: { x: 0, y: 0 },
    joystickDelta: { x: 0, y: 0 },
    lookActive: false,
    lookLast: { x: 0, y: 0 },
    runHeld: false,
};

// ═══════════════════════════════════════════════════════════
//  DOM HELPERS (safe)
// ═══════════════════════════════════════════════════════════

function $(id) {
    return document.getElementById(id);
}

function showScreen(name) {
    const ids = {
        menu: 'menuScreen',
        instructions: 'instructionsScreen',
        settings: 'settingsScreen',
        game: 'gameScreen',
    };
    // Hide top-level screens only
    Object.values(ids).forEach((id) => {
        const el = $(id);
        if (el) el.classList.add('hidden');
    });
    const target = $(ids[name]);
    if (target) target.classList.remove('hidden');
    state.currentScreen = name;

    // Always hide overlays when switching top screens
    ['pauseScreen', 'deathScreen', 'winScreen'].forEach((id) => {
        const el = $(id);
        if (el) el.classList.add('hidden');
    });
}

// ═══════════════════════════════════════════════════════════
//  THREE.JS
// ═══════════════════════════════════════════════════════════

let renderer, scene, camera, controls;
let flashlight, seeker, seekerMesh, seekerLight;
let buildingGroup, dustSystem;
let interactables = [];
let audioCtx, masterGain;
let footstepTimer = 0;

function initThree() {
    if (state.threeReady) return;

    const canvasParent = $('gameCanvas');
    if (!canvasParent) {
        console.error('gameCanvas not found');
        return;
    }

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasParent.innerHTML = '';
    canvasParent.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x080810, 0.045);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 120);
    camera.position.set(0, 1.65, 0);

    controls = new PointerLockControls(camera, renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x1a1a2e, 0.15));
    scene.add(new THREE.HemisphereLight(0x2a2a40, 0x0a0a10, 0.25));

    flashlight = new THREE.SpotLight(0xfff0d0, CONFIG.flashlightIntensity, CONFIG.flashlightDistance, CONFIG.flashlightAngle, 0.35, 1.2);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.set(1024, 1024);
    flashlight.shadow.bias = -0.0002;
    camera.add(flashlight);
    scene.add(camera);

    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, 0, -1);
    camera.add(flashTarget);
    flashlight.target = flashTarget;

    const softFlash = new THREE.PointLight(0xffe8c0, 0.35, 6);
    camera.add(softFlash);

    buildEnvironment();
    createSeeker();
    createDustParticles();
    createInteractables();

    window.addEventListener('resize', onResize);
    state.threeReady = true;
    console.log('[THE SEEKER] Three.js ready');
}

// ═══════════════════════════════════════════════════════════
//  ENVIRONMENT
// ═══════════════════════════════════════════════════════════

function buildEnvironment() {
    buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.92, metalness: 0.05 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.85, metalness: 0.08 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0e0e14, roughness: 0.95 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.7, metalness: 0.15 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3a45, roughness: 0.4, metalness: 0.7 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    buildingGroup.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3.2;
    buildingGroup.add(ceiling);

    function addWall(x1, z1, x2, z2, h = 3.2) {
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.28), wallMat);
        mesh.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
        mesh.rotation.y = Math.atan2(dz, dx);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        buildingGroup.add(mesh);
    }

    addWall(-18, -18, 18, -18);
    addWall(18, -18, 18, 18);
    addWall(18, 18, -18, 18);
    addWall(-18, 18, -18, -18);
    addWall(-6, -6, -6, 6);
    addWall(6, -6, 6, 6);
    addWall(-6, -6, 6, -6);
    addWall(-12, 2, -6, 2);
    addWall(6, 2, 12, 2);
    addWall(-4, 8, 4, 8);
    addWall(-10, -4, -10, 4);
    addWall(10, -4, 10, 4);

    for (let i = 0; i < 6; i++) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 3.2, 8), accentMat);
        pillar.position.set((Math.random() - 0.5) * 20, 1.6, (Math.random() - 0.5) * 20);
        pillar.castShadow = true;
        buildingGroup.add(pillar);
    }

    for (let i = 0; i < 20; i++) {
        const size = 0.15 + Math.random() * 0.35;
        const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.6, size * 0.8), Math.random() > 0.5 ? metalMat : accentMat);
        box.position.set((Math.random() - 0.5) * 30, size * 0.3, (Math.random() - 0.5) * 30);
        box.rotation.y = Math.random() * Math.PI;
        box.castShadow = true;
        buildingGroup.add(box);
    }

    for (let i = 0; i < 8; i++) {
        const pl = new THREE.PointLight(0x445566, 0.12 + Math.random() * 0.1, 8);
        pl.position.set((Math.random() - 0.5) * 28, 3.0, (Math.random() - 0.5) * 28);
        pl.userData.baseIntensity = pl.intensity;
        pl.userData.flickerSpeed = 0.5 + Math.random() * 2;
        buildingGroup.add(pl);
    }

    const grid = new THREE.GridHelper(40, 40, 0x1a1a22, 0x121218);
    grid.position.y = 0.01;
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    buildingGroup.add(grid);
}

// ═══════════════════════════════════════════════════════════
//  SEEKER
// ═══════════════════════════════════════════════════════════

function createSeeker() {
    seeker = new THREE.Group();
    seeker.position.set(12, 0, -12);

    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0e, roughness: 0.3, metalness: 0.6,
        emissive: 0x110000, emissiveIntensity: 0.15,
    });

    seekerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), bodyMat);
    seekerMesh.position.y = 1.0;
    seekerMesh.castShadow = true;
    seeker.add(seekerMesh);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        new THREE.MeshStandardMaterial({
            color: 0x050508, roughness: 0.2, metalness: 0.8,
            emissive: 0x220000, emissiveIntensity: 0.4,
        })
    );
    head.position.y = 1.85;
    head.scale.set(1, 1.15, 0.9);
    seeker.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat);
    eyeL.position.set(-0.1, 1.9, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    seeker.add(eyeL, eyeR);

    seekerLight = new THREE.PointLight(0xff1100, 0.6, 5);
    seekerLight.position.y = 1.7;
    seeker.add(seekerLight);

    for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 3, 6), bodyMat);
        leg.position.set(side * 0.18, 0.4, 0);
        seeker.add(leg);
    }

    scene.add(seeker);
    seeker.userData = {
        state: 'patrol',
        patrolTarget: new THREE.Vector3(),
        alertLevel: 0,
        lastHeard: 0,
        animPhase: 0,
    };
    pickNewPatrolTarget();
}

function pickNewPatrolTarget() {
    seeker.userData.patrolTarget.set(
        (Math.random() - 0.5) * 28, 0, (Math.random() - 0.5) * 28
    );
}

function updateSeeker(dt) {
    if (!seeker) return;
    const s = seeker.userData;
    s.animPhase += dt * (s.state === 'chase' ? 8 : 3);
    seekerMesh.position.y = 1.0 + Math.sin(s.animPhase) * 0.04;
    seekerLight.intensity = 0.4 + Math.sin(state.elapsed * 4) * 0.25;

    const playerPos = camera.position.clone(); playerPos.y = 0;
    const seekerPos = seeker.position.clone(); seekerPos.y = 0;
    const dist = playerPos.distanceTo(seekerPos);

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

    let speed = CONFIG.seekerWalkSpeed;
    if (s.state === 'chase') speed = CONFIG.seekerSprintSpeed;
    else if (s.state === 'alert') speed = CONFIG.seekerWalkSpeed * 1.4;

    const target = s.state === 'patrol' ? s.patrolTarget : playerPos;
    const dir = target.clone().sub(seekerPos).normalize();
    seeker.position.x += dir.x * speed * dt;
    seeker.position.z += dir.z * speed * dt;

    if (dir.lengthSq() > 0.01) {
        const angle = Math.atan2(dir.x, dir.z);
        seeker.rotation.y = THREE.MathUtils.lerp(seeker.rotation.y, angle, dt * 4);
    }

    seeker.position.x = THREE.MathUtils.clamp(seeker.position.x, -17, 17);
    seeker.position.z = THREE.MathUtils.clamp(seeker.position.z, -17, 17);

    if (dist < 1.35 && !state.isHiding && state.isPlaying && !state.isDead) {
        killPlayer('THE SEEKER FOUND YOU.');
    }

    if (dist < 8 && !state.isHiding) {
        state.sanity = Math.max(0, state.sanity - (1 - dist / 8) * CONFIG.sanityDrainNearSeeker * dt);
    }

    if (s.state === 'patrol' && seekerPos.distanceTo(s.patrolTarget) < 1.5) {
        pickNewPatrolTarget();
    }
}

// ═══════════════════════════════════════════════════════════
//  INTERACTABLES
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
                color: 0x881111, emissive: 0x440000, emissiveIntensity: 0.6, roughness: 0.3,
            })
        );
        btn.rotation.x = Math.PI / 2;
        btn.position.z = 0.12;
        group.add(btn);

        const light = new THREE.PointLight(0xff2200, 0.4, 3);
        light.position.z = 0.3;
        group.add(light);

        group.userData = { type: 'button', index: i, pressed: false, mesh: btn, light, pulse: Math.random() * 6 };
        scene.add(group);
        interactables.push(group);
    });

    // Key
    const keyGroup = new THREE.Group();
    keyGroup.position.set(0, 0.9, 12);
    keyGroup.visible = false;
    const keyMat = new THREE.MeshStandardMaterial({
        color: 0xc9a227, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a00, emissiveIntensity: 0.3,
    });
    keyGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.04), keyMat));
    const keyHead = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 12), keyMat);
    keyHead.position.y = 0.22;
    keyHead.rotation.x = Math.PI / 2;
    keyGroup.add(keyHead);
    keyGroup.userData = { type: 'key', taken: false };
    scene.add(keyGroup);
    interactables.push(keyGroup);

    // Hide boxes
    [[-14, 6], [14, -8], [-5, -14], [5, 14]].forEach(([x, z]) => {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.5, 1.1),
            new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 0.9 })
        );
        box.position.set(x, 0.75, z);
        box.castShadow = true;
        box.userData = { type: 'hide' };
        scene.add(box);
        interactables.push(box);
    });

    // Exit
    const gate = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 3.0, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.6, roughness: 0.4 })
    );
    gate.position.set(0, 1.5, 17.5);
    gate.userData = { type: 'exit' };
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
    if (!state.isPlaying || state.isDead || state.isHiding || !camera) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(interactables, true);

    if (!hits.length || hits[0].distance > 2.8) {
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
        const objEl = $('objective');
        if (objEl) objEl.textContent = 'REACH THE EXIT GATE';
        playTone(520, 0.15, 'sine');
        setTimeout(() => playTone(780, 0.2, 'sine'), 120);
    } else if (d.type === 'hide') {
        enterHide(obj);
    } else if (d.type === 'exit') {
        if (state.hasKey) winGame();
        else showInteraction('NEED THE KEY');
    }
}

function checkButtonsComplete() {
    if (state.buttonsPressed.every(Boolean)) {
        const key = interactables.find((o) => o.userData.type === 'key');
        if (key) {
            key.visible = true;
            const objEl = $('objective');
            if (objEl) objEl.textContent = 'RETRIEVE THE KEY';
        }
    }
}

function enterHide(box) {
    state.isHiding = true;
    state.hideTimeLeft = CONFIG.hideTime;
    camera.position.copy(box.position);
    camera.position.y = 1.1;
    if (controls) controls.unlock();
    const ht = $('hideTimer');
    if (ht) ht.classList.remove('hidden');
    addNoise(5);
    playTone(120, 0.2, 'triangle');
}

function exitHide() {
    state.isHiding = false;
    const ht = $('hideTimer');
    if (ht) ht.classList.add('hidden');
    camera.position.y = 1.65;
    if (!state.isMobile && controls) controls.lock();
}

function startHideCountdown() {
    // hide timer is started via enterHide or we force a visual warning
    // buttons already trigger scream; player must manually hide
}

// ═══════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════

function createDustParticles() {
    const count = 300;
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
        color: 0x888899, size: 0.035, transparent: true, opacity: 0.35,
        depthWrite: false, blending: THREE.AdditiveBlending,
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
    const el = $('screamOverlay');
    if (!el) return;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 1200);
}

function showDanger(on) {
    const el = $('dangerWarning');
    if (!el) return;
    if (on) el.classList.add('visible');
    else el.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════════════════════════

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        const vol = $('volumeSetting');
        masterGain.gain.value = ((vol ? +vol.value : 45) / 100) * 0.4;
        masterGain.connect(audioCtx.destination);
    } catch (e) {
        console.warn('Audio unavailable');
    }
}

function playTone(freq, dur, type = 'sine') {
    if (!audioCtx) return;
    const foot = $('footstepSetting');
    if (foot && !foot.checked) return;
    try {
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
    } catch (_) {}
}

function playFootstep() {
    playTone(80 + Math.random() * 40, 0.08, 'triangle');
}

// ═══════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════

function setupInput() {
    state.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (state.isMobile) {
        const mc = $('mobileControls');
        if (mc) mc.classList.remove('hidden');
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

    if (renderer) {
        renderer.domElement.addEventListener('click', () => {
            if (state.isPlaying && !state.isPaused && !state.isMobile && !state.isHiding && controls) {
                controls.lock();
            }
        });
    }
}

function setupMobileControls() {
    const zone = $('joystickZone');
    const knob = $('joystickKnob');
    if (!zone || !knob) return;
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
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
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

    const lookZone = $('lookZone');
    if (lookZone) {
        lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touch.lookActive = true;
            touch.lookLast.x = e.touches[0].clientX;
            touch.lookLast.y = e.touches[0].clientY;
        }, { passive: false });
        lookZone.addEventListener('touchmove', (e) => {
            if (!touch.lookActive || !camera) return;
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
        lookZone.addEventListener('touchend', () => { touch.lookActive = false; });
    }

    const runBtn = $('mobileRun');
    if (runBtn) {
        runBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            state.isRunning = true;
            runBtn.classList.add('active');
        });
        runBtn.addEventListener('touchend', () => {
            state.isRunning = false;
            runBtn.classList.remove('active');
        });
    }

    const interactBtn = $('mobileInteract');
    if (interactBtn) {
        interactBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            tryInteract();
            interactBtn.classList.add('active');
            setTimeout(() => interactBtn.classList.remove('active'), 150);
        });
    }

    const flashBtn = $('mobileFlashlight');
    if (flashBtn) {
        flashBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            toggleFlashlight();
            flashBtn.classList.add('active');
            setTimeout(() => flashBtn.classList.remove('active'), 150);
        });
    }
}

// ═══════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════

function updatePlayer(dt) {
    if (state.isHiding || state.isDead || state.isPaused || !camera) return;

    const speed = CONFIG.playerSpeed * (state.isRunning ? CONFIG.runMultiplier : 1);
    const dir = new THREE.Vector3();

    if (state.isMobile && touch.joystickActive) {
        dir.x = touch.joystickDelta.x;
        dir.z = touch.joystickDelta.y;
    } else {
        if (state.keys['KeyW'] || state.keys['ArrowUp']) dir.z -= 1;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) dir.z += 1;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) dir.x -= 1;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) dir.x += 1;
    }

    if (dir.lengthSq() > 0) {
        dir.normalize();
        const yaw = camera.rotation.y;
        const sin = Math.sin(yaw), cos = Math.cos(yaw);
        const mx = dir.x * cos + dir.z * sin;
        const mz = -dir.x * sin + dir.z * cos;
        camera.position.x += mx * speed * dt;
        camera.position.z += mz * speed * dt;

        addNoise(state.isRunning ? CONFIG.runNoise * dt : CONFIG.walkNoise * dt);

        footstepTimer -= dt;
        if (footstepTimer <= 0) {
            playFootstep();
            footstepTimer = state.isRunning ? 0.28 : 0.48;
        }

        const bob = Math.sin(state.elapsed * (state.isRunning ? 14 : 9)) * (state.isRunning ? 0.025 : 0.012);
        camera.position.y = 1.65 + bob;
    } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.65, dt * 8);
        footstepTimer = 0;
    }

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -17.5, 17.5);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -17.5, 17.5);

    if (!state.flashlightOn) {
        state.sanity = Math.max(0, state.sanity - CONFIG.sanityDrainInDark * dt);
    }
    if (state.sanity <= 0) killPlayer('YOUR SANITY COLLAPSED.');

    checkInteractionPrompt();
}

function checkInteractionPrompt() {
    if (!camera) return;
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
    const el = $('interaction');
    const txt = $('interactionText');
    if (txt) txt.textContent = text;
    if (el) el.classList.add('visible');
}
function hideInteraction() {
    const el = $('interaction');
    if (el) el.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
//  HUD / NOISE / SANITY
// ═══════════════════════════════════════════════════════════

function addNoise(amount) {
    state.noise = Math.min(100, state.noise + amount);
    state.lastNoiseTime = state.elapsed;
}

function updateNoise(dt) {
    if (state.elapsed - state.lastNoiseTime > 0.4) {
        state.noise = Math.max(0, state.noise - CONFIG.noiseDecay * 40 * dt);
    }
    const fill = $('noiseFill');
    if (fill) {
        fill.style.width = state.noise + '%';
        if (state.noise > 60) fill.style.background = 'linear-gradient(90deg, #aa2222, #ff3300)';
        else if (state.noise > 30) fill.style.background = 'linear-gradient(90deg, #886622, #cc8800)';
        else fill.style.background = 'linear-gradient(90deg, #4a4a4a, #888)';
    }
}

function updateSanityHUD() {
    const fill = $('sanityFill');
    if (!fill) return;
    const pct = (state.sanity / CONFIG.maxSanity) * 100;
    fill.style.width = pct + '%';
    if (pct < 25) fill.style.background = 'linear-gradient(90deg, #660000, #ff2200)';
    else if (pct < 50) fill.style.background = 'linear-gradient(90deg, #884400, #cc6600)';
    else fill.style.background = 'linear-gradient(90deg, #b33030, #c9a227)';
}

function updateButtonHUD() {
    ['button1', 'button2', 'button3'].forEach((id, i) => {
        const el = $(id);
        if (!el) return;
        if (state.buttonsPressed[i]) {
            el.classList.add('active');
            const iEl = el.querySelector('i');
            if (iEl) iEl.style.background = '#2a8a4a';
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
    const el = $('timer');
    if (el) {
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        el.style.color = state.timeLeft < 30 ? '#ff3333' : '';
    }
}

function updateHideTimer(dt) {
    if (!state.isHiding) return;
    state.hideTimeLeft -= dt;
    const el = $('hideTimerValue');
    if (el) el.textContent = Math.ceil(Math.max(0, state.hideTimeLeft));
    if (state.hideTimeLeft <= 0) exitHide();
}

function toggleFlashlight() {
    const setting = $('flashlightSetting');
    if (setting && !setting.checked) return;
    state.flashlightOn = !state.flashlightOn;
    if (flashlight) flashlight.intensity = state.flashlightOn ? CONFIG.flashlightIntensity : 0;
    playTone(state.flashlightOn ? 400 : 200, 0.06, 'square');
}

// ═══════════════════════════════════════════════════════════
//  GAME FLOW
// ═══════════════════════════════════════════════════════════

function startGame() {
    console.log('[THE SEEKER] startGame called');

    // Init Three if needed
    if (!state.threeReady) {
        try {
            initThree();
            setupInput();
            initAudio();
        } catch (err) {
            console.error('Failed to init Three.js', err);
            alert('Failed to start 3D engine. Check console.');
            return;
        }
    }

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
    state.elapsed = 0;

    // Reset HUD
    const objEl = $('objective');
    if (objEl) objEl.textContent = 'FIND THE 3 BUTTONS';
    const timerEl = $('timer');
    if (timerEl) { timerEl.textContent = '03:00'; timerEl.style.color = ''; }
    ['button1', 'button2', 'button3'].forEach((id) => {
        const el = $(id);
        if (el) {
            el.classList.remove('active');
            const iEl = el.querySelector('i');
            if (iEl) iEl.style.background = '';
        }
    });
    const sanity = $('sanityFill'); if (sanity) sanity.style.width = '100%';
    const noise = $('noiseFill'); if (noise) noise.style.width = '0%';
    const ht = $('hideTimer'); if (ht) ht.classList.add('hidden');
    showDanger(false);

    // Reset world
    if (camera) {
        camera.position.set(0, 1.65, 0);
        camera.rotation.set(0, 0, 0);
    }
    if (seeker) {
        seeker.position.set(12, 0, -12);
        seeker.userData.state = 'patrol';
        seeker.userData.alertLevel = 0;
        pickNewPatrolTarget();
    }
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
    if (flashlight) flashlight.intensity = CONFIG.flashlightIntensity;

    // Show game screen
    showScreen('game');
    const pause = $('pauseScreen'); if (pause) pause.classList.add('hidden');
    const death = $('deathScreen'); if (death) death.classList.add('hidden');
    const win = $('winScreen'); if (win) win.classList.add('hidden');

    if (!state.isMobile && controls) {
        setTimeout(() => {
            try { controls.lock(); } catch (_) {}
        }, 150);
    }

    if (audioCtx?.state === 'suspended') audioCtx.resume();
    state.clock.start();
    console.log('[THE SEEKER] Game started');
}

function togglePause() {
    if (!state.isPlaying || state.isDead || state.hasWon) return;
    state.isPaused = !state.isPaused;
    const pause = $('pauseScreen');
    if (state.isPaused) {
        if (pause) pause.classList.remove('hidden');
        if (controls) controls.unlock();
    } else {
        if (pause) pause.classList.add('hidden');
        if (!state.isMobile && !state.isHiding && controls) controls.lock();
    }
}

function killPlayer(reason) {
    state.isDead = true;
    state.isPlaying = false;
    if (controls) controls.unlock();
    const reasonEl = $('deathReason');
    if (reasonEl) reasonEl.textContent = reason || 'THE SEEKER FOUND YOU.';
    const death = $('deathScreen');
    if (death) death.classList.remove('hidden');
    triggerScreamOverlay();
    playTone(60, 1.2, 'sawtooth');
}

function winGame() {
    state.hasWon = true;
    state.isPlaying = false;
    if (controls) controls.unlock();
    const win = $('winScreen');
    if (win) win.classList.remove('hidden');
    playTone(440, 0.2, 'sine');
    setTimeout(() => playTone(554, 0.2, 'sine'), 150);
    setTimeout(() => playTone(659, 0.4, 'sine'), 300);
}

function quitToMenu() {
    state.isPlaying = false;
    state.isPaused = false;
    if (controls) controls.unlock();
    showScreen('menu');
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(state.clock.getDelta(), 0.05);
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

        if (buildingGroup) {
            buildingGroup.children.forEach((c) => {
                if (c.isPointLight && c.userData.baseIntensity) {
                    c.intensity = c.userData.baseIntensity * (0.85 + Math.sin(state.elapsed * c.userData.flickerSpeed) * 0.15);
                }
            });
        }
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
//  UI BUTTONS — ROBUST WIRING
// ═══════════════════════════════════════════════════════════

function setupUI() {
    // PLAY
    const playBtn = $('playButton');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[THE SEEKER] PLAY clicked');
            startGame();
        });
        console.log('[THE SEEKER] PLAY button wired');
    } else {
        console.error('[THE SEEKER] playButton NOT FOUND in DOM');
    }

    // HOW TO PLAY
    const instrBtn = $('instructionsButton');
    if (instrBtn) {
        instrBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('instructions');
        });
    }
    const instrBack = $('instructionsBack');
    if (instrBack) {
        instrBack.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('menu');
        });
    }

    // SETTINGS
    const setBtn = $('settingsButton');
    if (setBtn) {
        setBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('settings');
        });
    }
    const setBack = $('settingsBack');
    if (setBack) {
        setBack.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('menu');
        });
    }

    // PAUSE
    const resumeBtn = $('resumeButton');
    if (resumeBtn) resumeBtn.addEventListener('click', (e) => { e.preventDefault(); togglePause(); });
    const quitBtn = $('quitButton');
    if (quitBtn) quitBtn.addEventListener('click', (e) => { e.preventDefault(); quitToMenu(); });

    // DEATH
    const retryBtn = $('retryButton');
    if (retryBtn) retryBtn.addEventListener('click', (e) => { e.preventDefault(); startGame(); });
    const deathMenu = $('deathMenuButton');
    if (deathMenu) deathMenu.addEventListener('click', (e) => { e.preventDefault(); quitToMenu(); });

    // WIN
    const winAgain = $('winAgainButton');
    if (winAgain) winAgain.addEventListener('click', (e) => { e.preventDefault(); startGame(); });
    const winMenu = $('winMenuButton');
    if (winMenu) winMenu.addEventListener('click', (e) => { e.preventDefault(); quitToMenu(); });

    // Volume
    const vol = $('volumeSetting');
    if (vol) {
        vol.addEventListener('input', () => {
            if (masterGain) masterGain.gain.value = (+vol.value / 100) * 0.4;
        });
    }

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

function boot() {
    console.log('[THE SEEKER] Booting...');
    setupUI();
    animate();
    console.log('%c THE SEEKER %c BlackHollow Games ', 'background:#c9a227;color:#000;font-weight:bold', 'background:#111;color:#c9a227');
}

// Ensure DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}